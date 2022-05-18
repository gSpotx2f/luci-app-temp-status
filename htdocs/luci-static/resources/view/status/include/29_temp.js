'use strict';
'require baseclass';
'require rpc';

return baseclass.extend({
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

		let tempTable = E('table', { 'class': 'table' },
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left', 'width': '33%' }, _('Sensor')),
				E('th', { 'class': 'th left' }, _('Temperature')),
			])
		);

		for(let [k, v] of Object.entries(tempData)) {
			v.sort((a, b) => (a.number > b.number) ? 1 : (a.number < b.number) ? -1 : 0)

			for(let i of Object.values(v)) {
				let sensor = i.title || i.item;

				if(i.sources === undefined) {
					continue;
				};

				for(let j of i.sources) {
					let temp = j.temp;
					let name = (j.label !== undefined) ? sensor + " / " + j.label :
						(j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor

					if(temp !== undefined) {
						temp = Number((temp / 1000).toFixed(1));
					};

					let cellStyle = (temp >= this.tempCritical) ?
						'color:#f5163b !important; font-weight:bold !important' :
						(temp >= this.tempWarning) ?
							'color:#ff821c !important; font-weight:bold !important' : null;

					tempTable.append(
						E('tr', { 'class': 'tr' }, [
							E('td', {
									'class'     : 'td left',
									'style'     : cellStyle,
									'data-title': _('Sensor')
								},
								name
							),
							E('td', { 'class'  : 'td left',
									'style'     : cellStyle,
									'data-title': _('Temperature')
								},
								(temp === undefined) ? '-' : temp + ' °C'),
						])
					);
				};
			};
		};

		if(tempTable.childNodes.length === 1) {
			tempTable.append(
				E('tr', { 'class': 'tr placeholder' },
					E('td', { 'class': 'td' },
						E('em', {}, _('No temperature sensors available'))
					)
				)
			);
		};
		return tempTable;
	},
});
