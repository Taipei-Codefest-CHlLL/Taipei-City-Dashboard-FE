import fs from 'node:fs';
import readCsv from '../readCsv.js';

// Main grapth
const dataOut = parseRecycleSvg(112);
const amount = getRecycleAmount(dataOut);
dataOut.sort((a, b) => amount[b.name] - amount[a.name]);
const dataFilePath = '/home/wavjaby/Taipei-City-Dashboard-FE/public/chartData/700.json';
fs.writeFileSync(dataFilePath, JSON.stringify({ data: dataOut }));

// History
let historyOut = [{ name: '', data: [] }];
for (let i = 94; i < 112; i++) {
	const data = parseRecycleSvg(i);
	historyOut[0].data.push({
		x: data[0].data[data[0].data.length - 1].x,
		y: parseFloat(Object.values(getRecycleAmount(data)).reduce((i, j) => i + j, 0).toFixed(2))
	});
}
const historyDataFilePath = '/home/wavjaby/Taipei-City-Dashboard-FE/public/historyData/700.json';
fs.writeFileSync(historyDataFilePath, JSON.stringify({ data: historyOut }));

function getRecycleAmount(data) {
	return Object.fromEntries(data.map(i => [i.name, parseFloat(i.data.reduce((i, j) => i + j.y, 0).toFixed(2))]))
}

function parseRecycleSvg(year) {
	const yearStr = (year + 1911).toString();
	let data = readCsv(year + '年各區清潔隊資源回收量.csv',
		[
			'area',
			'total',
			yearStr + '-01-31T00:00:00+08:00',
			yearStr + '-02-28T00:00:00+08:00',
			yearStr + '-03-31T00:00:00+08:00',
			yearStr + '-04-30T00:00:00+08:00',
			yearStr + '-05-31T00:00:00+08:00',
			yearStr + '-06-30T00:00:00+08:00',
			yearStr + '-07-31T00:00:00+08:00',
			yearStr + '-08-31T00:00:00+08:00',
			yearStr + '-09-30T00:00:00+08:00',
			yearStr + '-10-31T00:00:00+08:00',
			yearStr + '-11-30T00:00:00+08:00',
			yearStr + '-12-31T00:00:00+08:00']
	);
	data = data.map(i => {
		delete i.total;
		const name = i.area;
		delete i.area;
		const out = { name: name, data: [] };
		for (const j of Object.entries(i)) {
			out.data.push({ x: j[0], y: parseFloat(j[1]) })
		}
		return out;
	}).filter(i => i.name !== '小計');
	return data;
}

// Geo data
const goeOutFilePath = '/home/wavjaby/Taipei-City-Dashboard-FE/public/mapData/recycle_amount.geojson';
const geoFilePath = '../taipei.geo.json';
const file = fs.readFileSync(geoFilePath);
const result = JSON.parse(file);
const geoOut = JSON.parse(file);
geoOut.features = [];
for (let j = 94; j <= 112; j++) {
	const data = parseRecycleSvg(j);
	const amount = getRecycleAmount(data);
	const features = [];
	let min = -1, max = 0;
	// Parse data
	result.features.forEach(i => {
		const properties = i.properties;
		const p = {
			name: properties.TOWNNAME,
			year: j+1911,
			value: amount[properties.TOWNNAME],
		};

		// Height
		if (p.value > max)
			max = p.value;
		if (min == -1 || p.value < min)
			min = p.value;
		features.push({ type: 'Feature', properties: p, geometry: i.geometry });
	});

	// Format data
	features.forEach(i => {
		let [h, s, l] = RGBToHSL('#90FF90');
		s *= ((i.properties.value - min) / (max - min));
		i.properties.color = HSLToRGB(h, s, l);
		i.properties.height = (i.properties.value - min) / (max - min);
		i.properties.value += '噸';
	});
	geoOut.features.push(...features);
}
fs.writeFileSync(goeOutFilePath, JSON.stringify(geoOut));


function RGBToHSL(hex) {
	let { r, g, b } = hexToRgb(hex);
	(r /= 255), (g /= 255), (b /= 255);
	const vmax = Math.max(r, g, b), vmin = Math.min(r, g, b);
	let h, s, l = (vmax + vmin) / 2;

	if (vmax === vmin) {
		return [0, 0, l]; // achromatic
	}

	const d = vmax - vmin;
	s = l > 0.5 ? d / (2 - vmax - vmin) : d / (vmax + vmin);
	if (vmax === r) h = (g - b) / d + (g < b ? 6 : 0);
	if (vmax === g) h = (b - r) / d + 2;
	if (vmax === b) h = (r - g) / d + 4;
	h /= 6;

	return [h, s, l];
}

function HSLToRGB(h, s, l) {
	let r, g, b;

	if (s === 0) {
		r = g = b = l; // achromatic
	} else {
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hueToRgb(p, q, h + 1 / 3);
		g = hueToRgb(p, q, h);
		b = hueToRgb(p, q, h - 1 / 3);
	}

	return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

function hueToRgb(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}