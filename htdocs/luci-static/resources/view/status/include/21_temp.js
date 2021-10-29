'use strict';
'require rpc';
'require fs';

return L.Class.extend({
	title: _('Temperature'),

	tempWarning: 90,

	tempCritical: 100,

	callTempStatus: rpc.declare({
		object: 'luci.temp-status',
		method: 'getTempStatus',
		expect: { '': {} }
	}),

	load: function() {
		return this.callTempStatus().catch(e => {});
	},

	render: function(tempData) {
		if(!tempData || tempData[1] === undefined) return;

		let tempTable = E('div', { 'class': 'table' },
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th left', 'width': '33%' }, _('Thermal zone')),
				E('div', { 'class': 'th left' }, _('Temperature')),
			])
		);

		for(let k in tempData) {
			let zone = tempData[k][0];
			let temp = tempData[k][1];
			let title = tempData[k][2];
			let tempValue = temp ? Number((temp / 1000).toFixed(1)) : null;

			let cellStyle = (tempValue >= this.tempCritical) ? 'color:#f5163b !important; font-weight:bold !important' :
				(tempValue >= this.tempWarning) ? 'color:#ff821c !important; font-weight:bold !important' : null;

			tempTable.append(
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td left', 'style': cellStyle, 'data-title': _('Thermal zone') }, title || zone),
					E('div', { 'class': 'td left', 'style': cellStyle, 'data-title': _('Temperature') }, tempValue ? tempValue + ' °C' : '-'),
				])
			);
		};

		return tempTable;
	},
});
