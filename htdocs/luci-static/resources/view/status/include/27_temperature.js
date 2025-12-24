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
.temp-status-hot {
	background-color: var(--app-temp-status-hot-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-hot .td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-hot td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat {
	background-color: var(--app-temp-status-overheat-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat .td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat td {
	color: var(--app-temp-status-font-color) !important;
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
	margin: 0 0.5em 0 0 !important;
	padding: 0 4px;
	border: 1px dotted;
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
	opacity: 0.7;
}
.temp-status-hide-item:hover {
	opacity: 1.0;
}
`));

return baseclass.extend({
	title       : _('Temperature'),

	viewName    : 'temp-status',

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

	makeTempTableContent() {
		this.tempTable.innerHTML = '';
		this.tempTable.append(
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th left', 'width': '33%' }, _('Sensor')),
					E('th', { 'class': 'th left' }, _('Temperature')),
					E('th', { 'class': 'th right', 'width': '1%' }, ' '),
				])
			);

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

						this.tempTable.append(
							E('tr', {
								'class'    : 'tr' + rowStyle,
								'data-path': j.path ,
							}, [
								E('td', {
										'class'     : 'td left',
										'data-title': _('Sensor')
									},
									(tpointsString.length > 0) ?
									`<span style="cursor:help; border-bottom:1px dotted" data-tooltip="${tpointsString}">${name}</span>` :
									name
								),
								E('td', {
										'class'     : 'td left',
										'data-title': _('Temperature')
									},
									(temp === undefined || temp === null) ? '-' : temp + ' °C'
								),
								E('td', {
										'class'     : 'td right',
										'data-title': _('Hide'),
										'title'     : _('Hide'),
									},
									E('span', {
										'class': 'temp-status-hide-item',
										'title': _('Hide'),
										'click': () => this.hideItem(j.path),
									}, '&#935;'),
								),
							])
						);
					};
				};
			};
		};

		if(this.tempTable.childNodes.length == 1) {
			this.tempTable.append(
				E('tr', { 'class': 'tr placeholder' },
					E('td', { 'class': 'td' },
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
				Promise.resolve(null);
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
