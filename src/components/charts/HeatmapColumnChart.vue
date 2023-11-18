<!-- Developed by Taipei Urban Intelligence Center 2023 -->

<script setup>
import { computed, ref } from 'vue';
import { useMapStore } from '../../store/mapStore';

const props = defineProps(['chart_config', 'activeChart', 'series', 'map_config']);

const mapStore = useMapStore();

const heatmapData = computed(() => {
	let output = {};
	let highest = 0;
	let sum = 0;
	if (props.series.length === 1) {
		props.series[0].data.forEach((item) => {
			output[item.x] = item.y;
			if (item.y > highest) {
				highest = item.y;
			}
			sum += item.y;
		});
	} else {
		props.series.forEach((serie) => {
			for (let i = 0; i < props.chart_config.categories.length; i++) {
				if (!output[props.chart_config.categories[i]]) {
					output[props.chart_config.categories[i]] = 0;
				}
				output[props.chart_config.categories[i]] += +serie.data[i];

				if (+serie.data[i] > highest) highest = +serie.data[i];
			}
		});
		sum = Object.values(output).reduce((partialSum, a) => partialSum + a, 0);
	}

	output.highest = highest;
	output.sum = sum;
	return output;
});

const colorScale = computed(() => {
	const ranges = props.chart_config.color.map((el, index) => (
		{
			to: Math.floor((heatmapData.value.highest / props.chart_config.color.length) * (props.chart_config.color.length - index)),
			from: Math.floor((heatmapData.value.highest / props.chart_config.color.length) * (props.chart_config.color.length - index - 1)) + 1,
			color: el
		}
	)
	);
	ranges.unshift({
		to: 0,
		from: 0,
		color: "#444444"
	});
	return ranges;
});

const chartOptions = ref({
	chart: {
		stacked: true,
		toolbar: {
			show: false,
		},
	},
	series: [
	{
			"name": "PH值",
			"data": [
				{
					x:"士林區",
					y: 1.0
				},
				{
					x:"大同區",
					y: 2.0
				},
				{
					x:"中山區",
					y: 3.0
				},
				{
					x:"中正區",
					y: 4.0
				},
				{
					x:"大安區",
					y: 5.0
				},
				{
					x:"萬華區",
					y: 6.0
				},
				{
					x:"信義區",
					y: 7.0
				},
				{
					x:"松山區",
					y: 8.0
				},
				{
					x:"南港區",
					y: 9.0
				},
				{
					x:"北投區",
					y: 10.0
				},
				{
					x:"內湖區",
					y: 11.0
				},
				{
					x:"文山區",
					y: 500.0
				}
			]
		},		
		{
			"name": "濁度",
			"data": [
				{
					x:"士林區",
					y: 41.0
				},
				{
					x:"大同區",
					y: 3.0
				},
				{
					x:"中山區",
					y: 0.0
				},
				{
					x:"中正區",
					y: 200.0
				},
				{
					x:"大安區",
					y: 3.0
				},
				{
					x:"萬華區",
					y: 0.0
				},
				{
					x:"信義區",
					y: 41.0
				},
				{
					x:"松山區",
					y: 3.0
				},
				{
					x:"南港區",
					y: 0.0
				},
				{
					x:"北投區",
					y: 41.0
				},
				{
					x:"內湖區",
					y: 3.0
				},
				{
					x:"文山區",
					y: 3.0
				}
			]
		},
		{
			"name": "餘氯",
			"data": [
				{
					x:"士林區",
					y: 41.0
				},
				{
					x:"大同區",
					y: 3.0
				},
				{
					x:"中山區",
					y: 0.0
				},
				{
					x:"中正區",
					y: 41.0
				},
				{
					x:"大安區",
					y: 3.0
				},
				{
					x:"萬華區",
					y: 0.0
				},
				{
					x:"信義區",
					y: 41.0
				},
				{
					x:"松山區",
					y: 3.0
				},
				{
					x:"南港區",
					y: 0.0
				},
				{
					x:"北投區",
					y: 41.0
				},
				{
					x:"內湖區",
					y: 3.0
				},
				{
					x:"文山區",
					y: 3.0
				}
			]
		}
	],
	dataLabels: {
		distributed: true,
		style: {
			fontSize: '12px',
			fontWeight: 'normal'
		}
	},
	grid: {
		show: false,
	},
	legend: {
		show: false,
	},
	markers: {
		size: 3,
		strokeWidth: 0,
	},
	plotOptions: {
		heatmap: {
			enableShades: false,
			radius: 4,
			colorScale: {
				ranges: colorScale.value,
				// inverse: true,
			},
			distributed: true,
		},
	},
	stroke: {
		show: true,
		width: 2,
		colors: ['#282a2c'],
	},
	tooltip: {
		custom: function ({ series, seriesIndex, dataPointIndex, w }) {
			// The class "chart-tooltip" could be edited in /assets/styles/chartStyles.css
			return '<div class="chart-tooltip">' +
				'<h6>' + `${w.globals.seriesNames[seriesIndex]}-${w.globals.labels[dataPointIndex]}` + '</h6>' +
				'<span>' + `${series[seriesIndex][dataPointIndex]}` + `${props.chart_config.unit}` + '</span>' +
				'</div>';
		},
	},
	xaxis: {
		axisBorder: {
			show: false,
		},
		axisTicks: {
			show: false,
		},
		categories: props.chart_config.categories ? props.chart_config.categories : [],
		labels: {
			offsetY: 5,
			formatter: function (value) {
				return value.length > 7 ? value.slice(0, 6) + "..." : value;
			}
		},
		tooltip: {
			enabled: false
		},
		type: 'category',
	},
	yaxis: {
		max: function (max) {
			if (!props.chart_config.categories) {
				return max;
			}
			return heatmapData.value.highest;
		},
	}
});

const selectedIndex = ref(null);

function handleDataSelection(e, chartContext, config) {
	if (!props.chart_config.map_filter) {
		return;
	}
	let toFilter = `${config.dataPointIndex} -${config.seriesIndex}`;
	if (toFilter !== selectedIndex.value) {
		mapStore.addLayerFilter(`${props.map_config[0].index}-${props.map_config[0].type}`, props.chart_config.map_filter[0], props.chart_config.map_filter[1][config.dataPointIndex], props.map_config[0]);
		selectedIndex.value = toFilter;
	} else {
		mapStore.clearLayerFilter(`${props.map_config[0].index}-${props.map_config[0].type}`, props.map_config[0]);
		selectedIndex.value = null;
	}
}
</script>

<template>
	<div v-if="activeChart === 'HeatmapColumnChart'" class="heatmapchart">
		<div class="heatmapchart-title">
		</div>
		<apexchart width="100%" height="360px" type="heatmap" :options="chartOptions" :series="chartOptions.series"
			@dataPointSelection="handleDataSelection"></apexchart>
	</div>
</template>

<style scoped lang="scss">
.heatmapchart {

	&-title {
		display: flex;
		justify-content: center;
		flex-direction: column;
		margin: -0.2rem 0 -1.5rem;

		h5 {
			color: var(--color-complement-text);
		}

		h6 {
			color: var(--color-complement-text);
			font-size: var(--font-m);
			font-weight: 400;
		}
	}
}
</style>