'use strict';
'require fs';
'require rpc';

return L.Class.extend({
	title       : _('Temperature'),

	tempWarning : 90,

	tempCritical: 100,

	callTempStatus: rpc.declare({
		object: 'luci.temp-status',
		method: 'getTempStatus',
		expect: { '': {} }
	}),

	load: function() {
		return L.resolveDefault(this.callTempStatus(), null);
	},

	render: function(tempData) {
		if(!tempData) return;

		let tempTable = E('div', { 'class': 'table' },
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th left', 'width': '33%' }, _('Sensor')),
				E('div', { 'class': 'th left' }, _('Temperature')),
			])
		);

		for(let [k, v] of Object.entries(tempData)) {
			v.sort((a, b) => (a.number > b.number) ? 1 : (a.number < b.number) ? -1 : 0)

			for(let i of Object.values(v)) {
				let sensor    = i.item;
				let temp      = i.temp;
				let title     = i.title;
				let tempValue = temp ? Number((temp / 1000).toFixed(1)) : null;

				let cellStyle = (tempValue >= this.tempCritical) ?
					'color:#f5163b !important; font-weight:bold !important' :
					(tempValue >= this.tempWarning) ?
						'color:#ff821c !important; font-weight:bold !important' : null;

				tempTable.append(
					E('div', { 'class': 'tr' }, [
						E('div', {
								'class': 'td left',
								'style': cellStyle,
								'data-title': _('Sensor')
							},
							title || sensor
						),
						E('div', { 'class': 'td left',
								'style': cellStyle,
								'data-title': _('Temperature')
							},
							tempValue ? tempValue + ' °C' : '-'),
					])
				);
			};
		};

		if(tempTable.childNodes.length === 1) {
			tempTable.append(
				E('div', { 'class': 'tr placeholder' },
					E('div', { 'class': 'td' },
						E('em', {}, _('No temperature sensors available'))
					)
				)
			);
		};
		return tempTable;
	},
});
