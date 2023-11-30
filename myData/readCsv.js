import fs from 'node:fs';

export default function readCsv(filepath, customKey) {
	const file = fs.readFileSync(filepath)
	const result = [];
	const lines = file.toString().split(/\r?\n/g);
	const keys = customKey || lines[0].split(',');
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].length === 0)
			continue;
		const elements = lines[i].split(',');

		const contents = {};
		for (let j = 0; j < elements.length; j++) {
			contents[keys[j]] = elements[j];
		}
		result.push(contents);
	}
	return result;
}