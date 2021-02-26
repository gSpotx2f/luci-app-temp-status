'use strict';
'require fs';

return L.Class.extend({
	title: _('Temperature'),

	tempWarning: 90,

	tempCritical: 100,

	zoneRegExp: new RegExp('^thermal_zone[0-9]+$'),

	load: async function() {
		if(!('tempStatusZones' in window)) {
			let zones = [];

			await fs.list('/sys/class/thermal').then(stat => {
				for(let file of stat) {
					let fname = file.name;
					if(this.zoneRegExp.test(fname)) {
						zones.push([
							Number(fname.replace('thermal_zone', '')),
							'/sys/class/thermal/' + fname,
						]);
					};
				};
			}).catch(e => {});

			for(let zone of zones) {
				await fs.read(zone[1] + '/type').then(t => {
					zone.push(t.trim());
				}).catch(e => {
					zone.push(zone[0]);
				});
			};

			zones.sort((a, b) => a[0] - b[0]);
			window.tempStatusZones = zones;
		};

		return Promise.all(
			window.tempStatusZones.map(
				zone => fs.trimmed(zone[1] + '/temp')
		)).catch(e => {});
	},

	render: function(tempData) {
		if(!tempData) return;

		let tempTable = E('div', { 'class': 'table' },
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th left', 'width': '33%' }, _('Thermal zone')),
				E('div', { 'class': 'th left' }, _('Temperature')),
			])
		);

		tempData.forEach((t, i) => {
			let tempValue = t ? Number((t / 1000).toFixed(1)) : null;
			let rowStyle = (tempValue >= this.tempCritical) ? 'background-color:#ffbfc1 !important' :
				(tempValue >= this.tempWarning) ? 'background-color:#fff7e2 !important' : null;
			tempTable.append(
				E('div', { 'class': 'tr', 'style': rowStyle }, [
					E('div', { 'class': 'td left', 'data-title': _('Thermal zone') }, window.tempStatusZones[i][2]),
					E('div', { 'class': 'td left', 'data-title': _('Temperature') }, tempValue ? tempValue + ' °C' : '-'),
				])
			);
		});

		return tempTable;
	},
});
