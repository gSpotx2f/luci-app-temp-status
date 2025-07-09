'use strict';
'require dom';
'require poll';
'require request';
'require rpc';
'require view';
'require ui';

document.head.append(E('style', {'type': 'text/css'},
`
:root {
	--app-temp-status-temp: #147aff;
	--app-temp-status-hot: orange;
	--app-temp-status-overheat: red;
}
.svg_background {
	width: 100%;
	height: 300px;
	border: 1px solid #000;
	background: #fff';
}
[data-darkmode="true"] .svg_background {
	background-color: var(--background-color-high) !important;
}
.graph_legend {
	border-bottom: 2px solid;
}
.temp {
	border-color: var(--app-temp-status-temp);
}
.hot {
	border-color: var(--app-temp-status-hot);
}
.overheat {
	border-color: var(--app-temp-status-overheat);
}
svg line.grid {
	stroke: black;
	stroke-width: 0.1;
}
[data-darkmode="true"] svg line.grid {
	stroke: #fff !important;
}
svg text {
	fill: #eee;
	font-size: 9pt;
	font-family: sans-serif;
	text-shadow: 1px 1px 1px #000;
}
svg #temp_line {
	fill: var(--app-temp-status-temp);
	fill-opacity: 0.4;
	stroke: var(--app-temp-status-temp);
	stroke-width: 1;
}
svg #hot_line {
	stroke: var(--app-temp-status-hot);
	stroke-width: 1;
}
svg #overheat_line {
	stroke: var(--app-temp-status-overheat);
	stroke-width: 1;
}
`));

Math.log2 = Math.log2 || (x => Math.log(x) * Math.LOG2E);

return view.extend({
	tempHot       : 95,

	tempOverheat  : 105,

	pollInterval  : 3,

	tempBufferSize: 4,

	sensorsData   : null,

	sensorsPath   : [],

	tempSources   : {},

	graphPolls    : [],

	callSensors   : rpc.declare({
		object: 'luci.temp-status',
		method: 'getSensors',
		expect: { '': {} },
	}),

	callTempData  : rpc.declare({
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

	getSensorsData() {
		return this.callSensors().then(data => {
			if(data) {
				this.sensorsData = data.sensors;
				this.sensorsPath = new Array(...Object.keys(data.temp));
				let tempData     = data.temp;
				if(this.sensorsData && tempData) {
					for(let e of Object.values(this.sensorsData)) {
						e.sort(this.sortFunc);

						for(let i of Object.values(e)) {
							let sensor = i.title || i.item;

							if(i.sources === undefined) {
								continue;
							};

							i.sources.sort(this.sortFunc);

							for(let j of i.sources) {
								let path = j.path;
								let temp = tempData[path];
								let name = (j.label !== undefined) ? sensor + " / " + j.label :
									(j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor

								if(temp !== undefined && temp !== null) {
									temp = this.formatTemp(temp);
								};

								let temp_hot      = NaN;
								let temp_overheat = NaN;
								let tpoints       = j.tpoints;

								if(tpoints) {
									for(let i of Object.values(tpoints)) {
										let t = this.formatTemp(i.temp);
										if(i.type === 'max' || i.type === 'critical' || i.type === 'emergency') {
											if(!(temp_overheat <= t)) {
												temp_overheat = t;
											};
										}
										else if(i.type === 'hot') {
											temp_hot = t;
										};
									};
								};

								if(isNaN(temp_hot) && isNaN(temp_overheat)) {
									temp_hot      = this.tempHot;
									temp_overheat = this.tempOverheat;
								};

								if(!(path in this.tempSources)) {
									this.tempSources[path] = {
										name,
										path,
										temp: [ [ new Date().getTime(), temp || 0 ] ],
										temp_hot,
										temp_overheat,
										tpoints,
									};
								};
							};
						};
					};
				};
			};
			return this.tempSources;
		});
	},

	getTempData() {
		return this.callTempData(this.sensorsPath).then(data => {
			if(data) {
				let tempData = data.temp;
				if(this.sensorsData && tempData) {
					for(let [path, temp] of Object.entries(tempData)) {
						if(path in this.tempSources) {
							if(temp !== undefined && temp !== null) {
								temp = this.formatTemp(temp);
							};
							let temp_array = this.tempSources[path].temp;
							temp_array.push([ new Date().getTime(), temp || 0 ]);
							if(temp_array.length > this.tempBufferSize) {
								temp_array.shift();
							};
						};
					};
				};
			};
			return this.tempSources;
		});
	},

	loadSVG(src) {
		return request.get(src).then(response => {
			if(!response.ok) {
				throw new Error(response.statusText);
			};

			return E('div', {
				'class': 'svg_background',
			}, E(response.text()));
		});
	},

	updateGraph(tpath, svg, y_peaks, lines, cb) {
		let G                 = svg.firstElementChild;
		let view              = document.querySelector('#view');
		let width             = view.offsetWidth - 2;
		let height            = 300 - 2;
		let base_step         = 5;
		let time_interval     = 60;
		let time_interval_min = time_interval / 60
		let step              = base_step * this.pollInterval;
		let data_wanted       = Math.ceil(width / step);
		let timeline_offset   = width % step;
		let data_values       = [];
		let line_elements     = [];

		for(let i = 0; i < lines.length; i++) {
			if(lines[i] != null) {
				data_values.push([]);
			};
		};

		let info = {
			line_current : [],
			line_average : [],
			line_peak    : [],
			line_min     : [],
			hot_line     : svg.firstElementChild.getElementById('hot_line'),
			overheat_line: svg.firstElementChild.getElementById('overheat_line'),
		};

		/* prefill datasets */
		for(let i = 0; i < data_values.length; i++) {
			for(let j = 0; j < data_wanted; j++) {
				data_values[i][j] = NaN;
			};
		};

		/* plot horizontal time interval lines */
		for(let i = width % (base_step * time_interval); i < width; i += base_step * time_interval) {
			let x    = i - (timeline_offset);
			let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				line.setAttribute('x1', x);
				line.setAttribute('y1', 0);
				line.setAttribute('x2', x);
				line.setAttribute('y2', '100%');
				line.setAttribute('class', 'grid');

			let text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				text.setAttribute('x', x + 5);
				text.setAttribute('y', 15);
				text.append(document.createTextNode(String((width - i) / base_step / time_interval) + 'm'));

			G.append(line);
			G.append(text);
		};

		info.interval  = this.pollInterval;
		info.timeframe = Math.floor(data_wanted / time_interval * this.pollInterval);

		this.graphPolls.push({
			tpath,
			svg,
			y_peaks,
			lines,
			cb,
			info,
			width,
			height,
			step,
			data_wanted,
			values     : data_values,
			timestamp  : 0,
			fill       : 1,
		});
	},

	pollData() {
		poll.add(L.bind(function() {
			return this.getTempData().then(L.bind(function(datasets) {
				for(let gi = 0; gi < this.graphPolls.length; gi++) {
					let ctx = this.graphPolls[gi];

					if(!datasets[ctx.tpath]) {
						continue;
					};

					let data = datasets[ctx.tpath].temp;

					if(!data) {
						continue;
					};

					let values         = ctx.values;
					let lines          = ctx.lines;
					let info           = ctx.info;
					let y_peaks        = ctx.y_peaks;
					let temp_hot       = datasets[ctx.tpath].temp_hot;
					let temp_overheat  = datasets[ctx.tpath].temp_overheat;
					let data_scale     = 0;
					let data_wanted    = ctx.data_wanted;
					let last_timestamp = NaN;

					for(let i = 0, di = 0; di < lines.length; di++) {
						if(lines[di] == null) {
							continue;
						};

						for(let j = ctx.timestamp ? 0 : 1; j < data.length; j++) {

							/* skip overlapping and empty entries */
							if(data[j][0] <= ctx.timestamp) {
								continue;
							};

							if(i == 0) {
								ctx.fill++;
								last_timestamp = data[j][0];
							};

							info.line_current[i] = data[j][di + 1];
							values[i].push(info.line_current[i]);
						};

						i++;
					};

					/* cut off outdated entries */
					ctx.fill = Math.min(ctx.fill, data_wanted);

					for(let i = 0; i < values.length; i++) {
						let len = values[i].length;
						values[i] = values[i].slice(len - data_wanted, len);

						/* find peaks, averages */
						info.line_peak[i]    = NaN;
						info.line_average[i] = 0;
						info.line_min[i]     = NaN;

						let nonempty = 0;
						for(let j = 0; j < values[i].length; j++) {
							info.line_peak[i] = isNaN(info.line_peak[i]) ? values[i][j] : Math.max(info.line_peak[i], values[i][j]);
							info.line_peak[i] = Number(info.line_peak[i].toFixed(1));
							info.line_min[i]  = isNaN(info.line_min[i]) ? values[i][j] : Math.min(info.line_min[i], values[i][j]);
							info.line_min[i]  = Number(info.line_min[i].toFixed(1));

							if(!isNaN(values[i][j])) {
								nonempty++;
								info.line_average[i] += values[i][j];
							};
						};

						info.line_average[i] = info.line_average[i] / nonempty;
						info.line_average[i] = Number(info.line_average[i].toFixed(1));
					};

					info.peak = Math.max.apply(Math, info.line_peak);

					/* remember current timestamp, calculate horizontal scale */
					if(!isNaN(last_timestamp)) {
						ctx.timestamp = last_timestamp;
					};

					let size = Math.floor(Math.log2(info.peak));
					let div  = Math.pow(2, size - (size % 10));

					if(y_peaks) {
						info.peak = (info.peak > y_peaks.t2) ? y_peaks.t2 + y_peaks.incr :
							((info.peak > y_peaks.t1) ? y_peaks.t1 + y_peaks.incr : y_peaks.t1);
					} else {
						let mult  = info.peak / div;
						    mult  = (mult < 5) ? 2 : ((mult < 50) ? 10 : ((mult < 500) ? 100 : 1000));
						info.peak = info.peak + (mult * div) - (info.peak % (mult * div));
					};

					data_scale = ctx.height / info.peak;

					/* plot data */
					for(let i = 0, di = 0; di < lines.length; di++) {
						if(lines[di] == null) {
							continue;
						};

						let el = ctx.svg.firstElementChild.getElementById(lines[di].line);
						let pt = '0,' + ctx.height;
						let y  = 0;

						if(!el) {
							continue;
						};

						for(let j = 0; j < values[i].length; j++) {
							let x = j * ctx.step;

							y  = ctx.height - Math.floor(values[i][j] * data_scale);
							y  = isNaN(y) ? ctx.height + 1 : y;
							pt += ` ${x},${y}`;
						};

						pt += ` ${ctx.width},${y} ${ctx.width},${ctx.height}`;
						el.setAttribute('points', pt);

						i++;
					};

					/* hot line y */
					if(!isNaN(temp_hot)) {
						info.hot_line.setAttribute(
							'y1', ctx.height - Math.floor(temp_hot * data_scale));
						info.hot_line.setAttribute(
							'y2', ctx.height - Math.floor(temp_hot * data_scale));
					};

					/* overheat line y */
					if(!isNaN(temp_overheat)) {
						info.overheat_line.setAttribute(
							'y1', ctx.height - Math.floor(temp_overheat * data_scale));
						info.overheat_line.setAttribute(
							'y2', ctx.height - Math.floor(temp_overheat * data_scale));
					};

					info.label_25 = 0.25 * info.peak;
					info.label_50 = 0.50 * info.peak;
					info.label_75 = 0.75 * info.peak;

					if(typeof(ctx.cb) == 'function') {
						ctx.cb(ctx.svg, info);
					};
				};
			}, this));
		}, this), this.pollInterval);
	},

	load() {
		return Promise.all([
			this.loadSVG(L.resource('svg/temperature.svg')),
			this.getSensorsData(),
		]);
	},

	render(data) {
		let svg      = data[0];
		let tsources = data[1];
		let map      = E('div', { 'class': 'cbi-map', 'id': 'map' });

		if(!tsources || Object.keys(tsources).length == 0) {
			map.append(E('div', { 'class': 'cbi-section' },
				E('div', { 'class': 'cbi-section-node' },
					E('div', { 'class': 'cbi-value' },
						E('em', {}, _('No temperature sensors available'))
					)
				)
			));
		} else {
			let tabs = E('div');
			map.append(tabs);

			for(let i of Object.values(tsources)) {
				let tsource_name     = i.name;
				let tsource_path     = i.path;
				let tsource_hot      = i.temp_hot;
				let tsource_overheat = i.temp_overheat;
				let tsource_tpoints  = i.tpoints;

				if(!tsource_name || !tsource_path) {
					continue;
				};

				let csvg            = svg.cloneNode(true);
				let tpoints_section = null;

				if(tsource_tpoints) {
					tpoints_section   = E('div', { 'class': 'cbi-section-node' })
					let tpoints_table = E('table', { 'class': 'table' });
					tpoints_section.append(tpoints_table);

					for(let i of Object.values(tsource_tpoints)) {
						tpoints_table.append(
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td left' }, i.type),
								E('td', { 'class': 'td left' }, this.formatTemp(i.temp) + ' °C' ),
							])
						);
					};
				};

				tabs.append(E('div', { 'class': 'cbi-section', 'data-tab': tsource_path, 'data-tab-title': tsource_name }, [
					csvg,
					E('div', { 'class': 'right' }, E('small', { 'data-graph': 'scale' }, '-')),
					E('br'),
					E('table', { 'class': 'table', 'style': 'width:100%;table-layout:fixed' }, [
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td right top' }, E('strong', { 'class': 'graph_legend temp' }, _('Temperature') + ':')),
							E('td', { 'class': 'td', 'data-graph': 'temp_cur' }, '-'),

							E('td', { 'class': 'td right top' }, E('strong', {}, _('Minimum:'))),
							E('td', { 'class': 'td', 'data-graph': 'temp_min' }, '-'),

							E('td', { 'class': 'td right top' }, E('strong', {}, _('Average:'))),
							E('td', { 'class': 'td', 'data-graph': 'temp_avg' }, '-'),

							E('td', { 'class': 'td right top' }, E('strong', {}, _('Peak:'))),
							E('td', { 'class': 'td', 'data-graph': 'temp_peak' }, '-'),
						]),
						(!isNaN(tsource_hot) ?
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td right top' }, E('strong', { 'class': 'graph_legend hot' }, _('Hot:'))),
								E('td', { 'class': 'td', 'data-graph': 'temp_hot' }, tsource_hot + ' °C'),

								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
							]) : ''
						),
						(!isNaN(tsource_overheat) ?
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td right top' }, E('strong', { 'class': 'graph_legend overheat' }, _('Overheat:'))),
								E('td', { 'class': 'td', 'data-graph': 'temp_overheat' }, tsource_overheat + ' °C'),

								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
								E('td', { 'class': 'td right top' }),
							]) : ''
						),
					]),
					E('br'),
					tpoints_section || '',
					E('br'),
				]));

				this.updateGraph(
					tsource_path,
					csvg,
					{ 't1': 120, 't2': 180, 'incr': 60 },
					[ { 'line': 'temp_line' } ],
					(svg, info) => {
						let G = svg.firstElementChild, tab = svg.parentNode;

						G.getElementById('label_25').firstChild.data = '%d °C'.format(info.label_25);
						G.getElementById('label_50').firstChild.data = '%d °C'.format(info.label_50);
						G.getElementById('label_75').firstChild.data = '%d °C'.format(info.label_75);

						tab.querySelector('[data-graph="scale"]').firstChild.data = _('(%d minute window, %d second interval)').format(info.timeframe, info.interval);

						dom.content(tab.querySelector('[data-graph="temp_cur"]'), info.line_current[0] + ' °C');
						dom.content(tab.querySelector('[data-graph="temp_min"]'), info.line_min[0] + ' °C');
						dom.content(tab.querySelector('[data-graph="temp_avg"]'), info.line_average[0] + ' °C');
						dom.content(tab.querySelector('[data-graph="temp_peak"]'), info.line_peak[0] + ' °C');
					}
				);
			};

			ui.tabs.initTabGroup(tabs.childNodes);
			this.pollData();
		};

		return  E([], [
			E('h2', _('Temperature')),
			E('div', {'class': 'cbi-map-descr'}, _('This page displays the temperature sensors data.')),
			map,
		]);
	},

	handleSaveApply: null,
	handleSave     : null,
	handleReset    : null,
});
