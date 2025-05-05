'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', {'type': 'text/css'},
`
:root {
	--app-temp-status-font-color: #2e2e2e;
	--app-temp-status-hot-color: #fff6d9;
	--app-temp-status-crit-color: #fcc3bf;
}
:root[data-darkmode="true"] {
	--app-temp-status-font-color: #fff;
	--app-temp-status-hot-color: #8d7000;
	--app-temp-status-crit-color: #a93734;
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
.temp-status-crit {
	background-color: var(--app-temp-status-crit-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-crit .td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-crit td {
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
	title         : _('Temperature'),

	viewName      : 'temp_status',

	tempHot       : 95,

	tempCritical  : 105,

	tempData      : {},

	hiddenItems   : new Set(),

	tempTable     : E('table', { 'class': 'table' }),

	callTempStatus: rpc.declare({
		object: 'luci.temp-status',
		method: 'getTempStatus',
		expect: { '': {} }
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
			])
		);

		for(let [k, v] of Object.entries(this.tempData)) {
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

					let temp = j.temp;
					let name = (j.label !== undefined) ? sensor + " / " + j.label :
						(j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor

					if(temp !== undefined) {
						temp = this.formatTemp(temp);
					};

					let tempHot       = this.tempHot;
					let tempCritical  = this.tempCritical;
					let tpoints       = j.tpoints;
					let tpointsString = '';

					if(tpoints) {
						for(let i of Object.values(tpoints)) {
							let t = this.formatTemp(i.temp);
							tpointsString += `&#10;${i.type}: ${t} °C`;

							if(i.type === 'critical' || i.type === 'emergency') {
								tempCritical = t;
							}
							else if(i.type === 'hot' || i.type === 'max') {
								tempHot = t;
							};
						};
					};

					let rowStyle = (temp >= tempCritical) ? ' temp-status-crit':
						(temp >= tempHot) ? ' temp-status-hot' : '';

					this.tempTable.append(
						E('tr', {
							'class'    : 'tr' + rowStyle,
							'data-path': j.path ,
						}, [
							E('td', {
									'class'     : 'td left',
									'data-title': _('Sensor')
								}, [
								E('span', {
									'class': 'temp-status-hide-item',
									'title': _('Hide'),
									'click': () => this.hideItem(j.path),
								}, '&#935;'),
								E('span', {},
									(tpointsString.length > 0) ?
									`<span style="cursor:help; border-bottom:1px dotted" data-tooltip="${tpointsString}">${name}</span>` :
									name
								),
							]),
							E('td', {
									'class'     : 'td left',
									'data-title': _('Temperature')
								},
								(temp === undefined) ? '-' : temp + ' °C'),
						])
					);
				};
			};
		};

		if(this.tempTable.childNodes.length === 1) {
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
		return L.resolveDefault(this.callTempStatus(), null);
	},

	render(tempData) {
		if(!tempData) {
			return;
		};

		this.tempData = tempData;
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
