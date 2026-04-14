'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', {'type': 'text/css'},
`
:root {
	--app-temp-status-font-color: #2e2e2e;
	--app-temp-status-border-color: var(--border-color-medium, #d4d4d4);
	--app-temp-status-hot-color: #fff7e2;
	--app-temp-status-overheat-color: #ffe9e8;
}
:root[data-darkmode="true"] {
	--app-temp-status-font-color: #fff;
	--app-temp-status-border-color: var(--border-color-medium, #444);
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

.temp-status-temp-area {
	width: 100%;
	padding: 0 0 1em 0;
	display: flex;
	-webkit-align-items: flex-start;
	align-items: flex-start;
	-webkit-justify-content: left;
	justify-content: left;
	-webkit-flex-wrap: wrap;
	flex-wrap: wrap;
	-webkit-flex-direction: row;
	flex-direction: row;
}
.temp-status-list-item {
	display: inline-block;
	flex-grow: 0;
	-webkit-flex-grow 0;
	flex-shrink: 1;
	-webkit-flex-shrink 1;
	width: 29em;
	word-wrap: break-word;
	margin: 0px 4px 4px 0 !important;
	padding: 4px;
	border: 1px solid;
	border-color: transparent;
	border-color: var(--app-temp-status-border-color);
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
}
.temp-status-temp-value {
	display: inline-block;
	margin-left: 0.5em !important;
	width: 4em;
	text-align: left;
}
.temp-status-sensor-name {
	display: inline-block;
	padding-left: 1.5em;
	font-size: 95%;
}

#temp-status-buttons-wrapper {
	margin-bottom: 1em;
}
.temp-status-button {
	display: inline-block;
	cursor: pointer;
	margin: 2px 4px 2px 0 !important;
	padding: 3px 5px;
	border: 1px solid;
	border-color: transparent;
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
	opacity: 0.7;
	background-color: rgba(100 100 100 / 0.2);
}
.temp-status-button:hover {
	opacity: 0.9;
}
.temp-status-button:active {
	opacity: 1.0;
}
.temp-status-hide-item {
	display: inline-block;
	cursor: pointer;
	margin: 0 0.5em 0 0 !important;
	padding: 1px 5px;
	border: 1px dotted;
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
	opacity: 0.6;
	background-color: rgba(100 100 100 / 0.2);
	font-weight: bold;
}
.temp-status-hide-item:hover {
	opacity: 0.9;
}
.temp-status-hide-item:active {
	opacity: 1.0;
}
`));

return baseclass.extend({
	title          : _('Temperature'),

	viewName       : 'temp-status',

	tempHot        : 95,

	tempOverheat   : 105,

	sensorsData    : null,

	tempData       : null,

	sensorsPath    : [],

	hiddenItems    : new Set(),

	hiddenNum      : E('span', {}),

	tempTable      : E('table', { 'class': 'table' }),

	tempArea       : E('div', { 'class': 'temp-status-temp-area' }),

	tempView       : E('div', {}),

	viewType       : 'table',

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
		let view = localStorage.getItem(`luci-app-${this.viewName}-view`);
		if(view) {
			this.viewType = view;
		};
	},

	saveSettingsToLocalStorage() {
		localStorage.setItem(
			`luci-app-${this.viewName}-hiddenItems`, Array.from(this.hiddenItems).join(','));
		localStorage.setItem(
			`luci-app-${this.viewName}-view`, this.viewType);
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

		return this.tempTable;
	},

	makeTempAreaContent() {
		this.tempArea.innerHTML = '';

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

					let itemStyle = (temp >= tempOverheat) ? ' temp-status-overheat':
						(temp >= tempHot) ? ' temp-status-hot' : '';

					this.tempArea.append(
						E('div', { 'class': 'temp-status-list-item' + itemStyle }, [
							E('span', {
								'class': 'temp-status-hide-item',
								'title': _('Hide'),
								'click': () => this.hideItem(j.path),
							}, '&#935;'),
							E('span', {
								'class': 'temp-status-temp-value',
							}, (temp === undefined || temp === null) ? '-' : temp + ' °C'),
							E('span', {
								'class': 'temp-status-sensor-name'
							}, (tpointsString.length > 0) ?
								`<span style="cursor:help; border-bottom:1px dotted" data-tooltip="${tpointsString}">${name}</span>` :
								name
							),
						])
					);
				};
			};
		};

		if(this.tempArea.childNodes.length == 0) {
			this.tempArea.append(
				E('em', {}, _('No temperature sensors available'))
			);
		};

		return this.tempArea;
	},

	makeViewContent() {
		this.tempView.innerHTML = '';
		this.tempView.append((this.viewType == 'list') ? this.makeTempAreaContent() : this.makeTempTableContent());
		this.hiddenNum.textContent = this.hiddenItems.size;
		let unhide = document.getElementById('temp-status-unhide-all');
		if(unhide) {
			unhide.style.display = (this.hiddenItems.size > 0) ? 'inline-block' : 'none';
		};
	},

	hideItem(path) {
		this.hiddenItems.add(path);
		this.saveSettingsToLocalStorage();
		this.makeViewContent();
	},

	unhideAllItems() {
		this.hiddenItems.clear();
		this.saveSettingsToLocalStorage();
		this.makeViewContent();
	},

	switchView() {
		this.tempView.innerHTML = '';
		this.viewType = (this.viewType == 'list') ? 'table' : 'list'
		this.saveSettingsToLocalStorage();
		this.makeViewContent();
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

		this.makeViewContent();

		return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'id': 'temp-status-buttons-wrapper' }, [
				E('span', {
					'class': 'temp-status-button',
					'click': () => this.switchView(),
				}, _('Switch view')),
				E('span', {
					'id'   : 'temp-status-unhide-all',
					'class': 'temp-status-button',
					'style': `display:${(this.hiddenItems.size > 0) ? 'inline-block' : 'none'}`,
					'click': () => this.unhideAllItems(),
				}, [
					_('Show hidden sensors'),
					' (',
					this.hiddenNum,
					')',
				])
			]),
			this.tempView,
		]);
	},
});
