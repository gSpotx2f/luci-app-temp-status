'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', {'type': 'text/css'},
`
:root {
        --app-temp-status-font-color: #2e2e2e;
        --app-temp-status-hot-color: #fff7e2;
        --app-temp-status-overheat-color: #ffe9e8;
}
:root[data-darkmode="true"] {
        --app-temp-status-font-color: #fff;
        --app-temp-status-hot-color: #8d7000;
        --app-temp-status-overheat-color: #a93734;
}

.sensor-cell-content {
        padding: 4px 8px;
        display: flex;
        align-items: center;
        border-radius: 4px;
        min-height: 2em;
        width: 100%;
        box-sizing: border-box;
}

.sensor-cell-hot {
        background-color: var(--app-temp-status-hot-color) !important;
        color: var(--app-temp-status-font-color) !important;
}
.sensor-cell-overheat {
        background-color: var(--app-temp-status-overheat-color) !important;
        color: var(--app-temp-status-font-color) !important;
}

.table tr.tr:not(.table-titles) td.td {
        vertical-align: top;
}

.sensor-cell-header {
        padding: 4px 8px; 
        display: flex;
        align-items: center;
        width: 100%;
}

.table tr.table-titles th.th {
        vertical-align: top;
        width: 50%;
}

.temp-status-unhide-all {
        display: inline-block;
        cursor: pointer;
        margin: 2px !important;
        padding: 2px 4px;
        border: 1px dotted;
        -webkit-border-radius: 4px;
        -moz-border-radius: 4px;
        border-radius: 4px;
        opacity: 0.7;
}

.temp-status-unhide-all:hover {
        opacity: 0.9;
}

.temp-status-hide-item {
        display: inline-block;
        cursor: pointer;
        margin-left: 0.5em !important;
        padding: 0 4px;
        border: 1px dotted;
        -webkit-border-radius: 4px;
        -moz-border-radius: 4px;
        border-radius: 4px;
        opacity: 0.7;
        color: inherit;
        flex-shrink: 0;
}

.temp-status-hide-item:hover {
        opacity: 1.0;
}
`));

return baseclass.extend({
        title       : _('Temperature'),

        viewName    : 'temp_status',

        tempHot     : 95,

        tempOverheat: 105,

        sensorsData : null,

        tempData    : null,

        sensorsPath : [],

        hiddenItems : new Set(),

        tempTable   : E('table', { 'class': 'table' }),

        callSensors : rpc.declare({
                object: 'luci.temp-status',
                method: 'getSensors',
                expect: { '': {} },
        }),

        callTempData: rpc.declare({
                object: 'luci.temp-status',
                method: 'getTempData',
                params: [ 'tpaths' ],
                expect: { '': {} },
        }),

        formatTemp(mc) {
                return Number((mc / 1000).toFixed(1));
        },

        sortFunc(a, b) {
                return (a.number > b.number) ? 1 : (a.number < b.number) ? -1 : 0;
        },

        restoreSettingsFromLocalStorage() {
                let hiddenItems = localStorage.getItem(`luci-app-${this.viewName}-hiddenItems`);
                if(hiddenItems) {
                        this.hiddenItems = new Set(hiddenItems.split(','));
                };
        },

        saveSettingsToLocalStorage() {
                localStorage.setItem(
                        `luci-app-${this.viewName}-hiddenItems`, Array.from(this.hiddenItems).join(','));
        },

        createSensorCell(item) {
                if (!item) {
                        return E('td', { 'class': 'td', 'width': '50%' });
                }

                const { path, name, temp, rowStyle, tpointsString } = item;

                const cellClass = rowStyle.includes('hot') ? ' sensor-cell-hot' :
                        rowStyle.includes('overheat') ? ' sensor-cell-overheat' : '';

                const sensorContent = E('div', {
                        'class': 'sensor-cell-content' + cellClass,
                        'data-path': path,
                }, [
                        E('div', { 
                                'style': 'flex-grow: 0; flex-shrink: 1; min-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 0px; text-align: left;' 
                        },
                                (tpointsString.length > 0) ?
                                E('span', {
                                        'style': 'cursor:help; border-bottom:1px dotted',
                                        'data-tooltip': tpointsString
                                }, name) :
                                E('span', {}, name)
                        ),

                        E('span', { 
                                'style': 'flex-shrink: 0; min-width: 25%; text-align: left;' 
                        },
                                (temp === undefined || temp === null) ? '-' : temp + ' °C'
                        ),

                        E('div', { 'style': 'flex-grow: 1; flex-shrink: 0;' }),

                        E('span', {
                                'class': 'temp-status-hide-item',
                                'title': _('Hide'),
                                'click': () => this.hideItem(path),
                        }, '&#935;'),
                ]);

                return E('td', { 'class': 'td', 'width': '50%' }, sensorContent);
        },

        createHeaderCell() {
                const headerContent = E('div', { 'class': 'sensor-cell-header' }, [
                        E('div', { 
                                'style': 'flex-grow: 0; flex-shrink: 1; min-width: 50%; padding-right: 0px; text-align: left;' 
                        }, _('Sensor')),

                        E('span', { 
                                'style': 'flex-shrink: 0; min-width: 25%; text-align: left;' 
                        }, _('Temperature')),

                        E('div', { 'style': 'flex-grow: 1; flex-shrink: 0;' }),

                        E('span', {
                                'class': 'temp-status-hide-item',
                                'style': 'visibility: hidden;',
                        }, '&#935;'),
                ]);

                return E('th', { 'class': 'th left', 'width': '50%' }, headerContent);
        },

        makeTempTableContent() {
                let visibleRows = [];

                if(this.sensorsData && this.tempData) {
                        for(let [k, v] of Object.entries(this.sensorsData)) {
                                v.sort(this.sortFunc);

                                for(let i of Object.values(v)) {
                                        let sensor = i.title || i.item;

                                        if(i.sources === undefined) {
                                                continue;
                                        };

                                        i.sources.sort(this.sortFunc);

                                        for(let j of i.sources) {
                                                if(this.hiddenItems.has(j.path)) {
                                                        continue;
                                                };

                                                let temp = this.tempData[j.path];
                                                let name = (j.label !== undefined) ? sensor + " / " + j.label :
                                                        (j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor

                                                if(temp !== undefined && temp !== null) {
                                                        temp = this.formatTemp(temp);
                                                };

                                                let tempHot       = NaN;
                                                let tempOverheat  = NaN;
                                                let tpoints       = j.tpoints;
                                                let tpointsString = '';

                                                if(tpoints) {
                                                        for(let i of Object.values(tpoints)) {
                                                                let t = this.formatTemp(i.temp);
                                                                tpointsString += `&#10;${i.type}: ${t} °C`;

                                                                if(i.type == 'max' || i.type == 'critical' || i.type == 'emergency') {
                                                                        if(!(tempOverheat <= t)) {
                                                                                tempOverheat = t;
                                                                        };
                                                                }
                                                                else if(i.type == 'hot') {
                                                                        tempHot = t;
                                                                };
                                                        };
                                                };

                                                if(isNaN(tempHot) && isNaN(tempOverheat)) {
                                                        tempHot      = this.tempHot;
                                                        tempOverheat = this.tempOverheat;
                                                };

                                                let rowStyle = (temp >= tempOverheat) ? ' temp-status-overheat':
                                                        (temp >= tempHot) ? ' temp-status-hot' : '';

                                                visibleRows.push({
                                                        path: j.path,
                                                        name: name,
                                                        temp: temp,
                                                        rowStyle: rowStyle,
                                                        tpointsString: tpointsString,
                                                });
                                        };
                                };
                        };
                };

                this.tempTable.innerHTML = '';

                this.tempTable.append(
                                E('tr', { 'class': 'tr table-titles' }, [
                                        this.createHeaderCell(),
                                        this.createHeaderCell(),
                                ])
                        );

                for (let i = 0; i < visibleRows.length; i += 2) {
                        const item1 = visibleRows[i];
                        const item2 = visibleRows[i + 1] || null;

                        const row = E('tr', { 'class': 'tr' }, [
                                this.createSensorCell(item1),
                                this.createSensorCell(item2),
                        ]);
                        this.tempTable.append(row);
                }

                if(visibleRows.length === 0) {
                        this.tempTable.append(
                                E('tr', { 'class': 'tr placeholder' },
                                        E('td', { 'class': 'td', 'colspan': 2 },
                                                E('em', {}, _('No temperature sensors available'))
                                        )
                                )
                        );
                };
        },

        hideItem(path) {
                this.hiddenItems.add(path);
                this.saveSettingsToLocalStorage();
                this.makeTempTableContent();
                document.getElementById('temp-status-hnum').textContent = this.hiddenItems.size;
        },

        unhideAllItems() {
                this.hiddenItems.clear();
                this.saveSettingsToLocalStorage();
                this.makeTempTableContent();
                document.getElementById('temp-status-hnum').textContent = this.hiddenItems.size;
        },

        load() {
                this.restoreSettingsFromLocalStorage();
                if(this.sensorsData) {
                        return (this.sensorsPath.length > 0) ?
                                L.resolveDefault(this.callTempData(this.sensorsPath), null) :
                                new Promise(r => r(null));
                } else {
                        return L.resolveDefault(this.callSensors(), null);
                };
        },

        render(data) {
                if(data) {
                        if(!this.sensorsData) {
                                this.sensorsData = data.sensors;
                                this.sensorsPath = data.temp && new Array(...Object.keys(data.temp));
                        };
                        this.tempData = data.temp;
                };

                if(!this.sensorsData || !this.tempData) {
                        return;
                };

                this.makeTempTableContent();

                return E('div', { 'class': 'cbi-section' }, [
                        E('div',
                                { 'style': 'margin-bottom:1em; padding:0 4px;' },
                                E('span', {
                                        'class': 'temp-status-unhide-all',
                                        'href' : 'javascript:void(0)',
                                        'click': () => this.unhideAllItems(),
                                }, [
                                        _('Show hidden sensors'),
                                        ' (',
                                        E('span', { 'id': 'temp-status-hnum' }, this.hiddenItems.size),
                                        ')',
                                ])
                        ),
                        this.tempTable,
                ]);
        },
});
