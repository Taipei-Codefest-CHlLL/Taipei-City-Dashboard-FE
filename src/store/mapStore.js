// Cleaned

/* mapStore */
/*
The mapStore controls the map and includes methods to modify it.

!! PLEASE BE SURE TO REFERENCE THE MAPBOX DOCUMENTATION IF ANYTHING IS UNCLEAR !!
https://docs.mapbox.com/mapbox-gl-js/guides/
*/
import { createApp, defineComponent, nextTick, ref } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./authStore";
import { useDialogStore } from "./dialogStore";
import mapboxGl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { Threebox } from "threebox-plugin";

import mapStyle from "../assets/configs/mapbox/mapStyle.js";
import {
	MapObjectConfig,
	TaipeiTown,
	TaipeiVillage,
	TaipeiBuilding,
	maplayerCommonPaint,
	maplayerCommonLayout,
} from "../assets/configs/mapbox/mapConfig.js";
import { savedLocations } from "../assets/configs/mapbox/savedLocations.js";
import { calculateGradientSteps } from "../assets/configs/mapbox/arcGradient";
import MapPopup from "../components/map/MapPopup.vue";
import h377 from "../utils/heatmap/core.js";

const { BASE_URL } = import.meta.env;

function calculateHeatmapAndContours(data_points) {
	// create configuration object
	var config = {
		container: document.getElementById('heatmapContainer'),
		radius: 10,
		maxOpacity: .5,
		minOpacity: 0,
		blur: .75
	};
	// create heatmap with configuration
	var heatmapInstance = h377.create(config);
	let new_data_points = []
	for (let i = 0; i < data_points.length; i++) {
		let data = {}
		data.x = data_points[i].lng
		data.y = data_points[i].lat
		data.value = data_points[i].density
		new_data_points.push(data)
	}

	let data = {
		max: 500,
		min: 0,
		data: new_data_points
	};
	heatmapInstance.setData(data);
	console.log(heatmapInstance.getData())
}

function calculateKDEAndContours(data_points, grid_size, bandwidth) {
	// Assuming data_points is an array of {lng, lat, density} objects
	// grid_size is the resolution of the grid (smaller means higher resolution but more computational expense)
	// bandwidth is the "width" of the kernel, which affects the smoothness of the KDE

	// 1. Set up the grid over which to perform the KDE
	let [minLng, minLat, maxLng, maxLat] = getBoundingBox(data_points);
	console.log(minLng, minLat, maxLng, maxLat)
	let grid = createGrid(minLng, minLat, maxLng, maxLat, grid_size);

	console.log(grid)

	// 2. Apply the KDE to each grid cell
	for (let i = 0; i < grid.length; i++) {
		for (let j = 0; j < grid[i].length; j++) {
			let cell = grid[i][j];
			let x0 = cell.lng;
			let y0 = cell.lat;
			let density = 0;

			// Sum the effect of all points on this grid cell
			for (let point of data_points) {
				let x = point.lng;
				let y = point.lat;
				let d = point.density;
				density += d * kernelFunction(x, y, x0, y0, bandwidth);
			}

			grid[i][j].density = density;
		}
	}

	// 3. Extract contour lines
	let contours = marchingSquares(grid, grid_size, minLng, minLat, maxLng, maxLat);

	console.log(contours)

	// 4. Convert contour lines to GeoJSON
	let geoJSON = contoursToGeoJSON(contours);

	return geoJSON;
}

// Kernel function (Gaussian)
function kernelFunction(x, y, x0, y0, bandwidth) {
	// Gaussian kernel function
	let dx = x - x0;
	let dy = y - y0;
	return (1 / (2 * Math.PI * bandwidth * bandwidth)) * Math.exp(-(dx * dx + dy * dy) / (2 * bandwidth * bandwidth));
}

function createGrid(minLng, minLat, maxLng, maxLat, grid_size) {
	let grid = [];
	for (let lng = minLng; lng <= maxLng; lng += grid_size) {
		let row = [];
		for (let lat = minLat; lat <= maxLat; lat += grid_size) {
			row.push({ lng: lng, lat: lat, density: 0 });
		}
		grid.push(row);
	}
	return grid;
}

function getBoundingBox(data_points) {
	let minLng = Math.min(...data_points.map(p => p.lng));
	let minLat = Math.min(...data_points.map(p => p.lat));
	let maxLng = Math.max(...data_points.map(p => p.lng));
	let maxLat = Math.max(...data_points.map(p => p.lat));
	return [minLng, minLat, maxLng, maxLat];
}

function marchingSquares(grid, grid_size, minLng, minLat, maxLng, maxLat, contourValue = 0.56055178) {
	let contours = [];

	// Loop through the grid cells
	for (let i = 0; i < grid.length - 1; i++) {
		for (let j = 0; j < grid[i].length - 1; j++) {
			// Each cell is [top-left, top-right, bottom-right, bottom-left]
			let cell = [
				grid[i][j],
				grid[i][j + 1],
				grid[i + 1][j + 1],
				grid[i + 1][j]
			];

			if (Math.random(0, 1) < 0.01)
				console.log(cell)

			// Determine the index of the cell in the "marching squares" lookup table
			let index = 0;
			// 
			if (cell[0].density > contourValue) index |= 1;
			if (cell[1].density > contourValue) index |= 2;
			if (cell[2].density > contourValue) index |= 4;
			if (cell[3].density > contourValue) index |= 8;

			// Now use the lookup table to determine the edges to interpolate between
			// This is a simplified table that assumes the contour passes through the midpoint of the cell edges
			const edgeTable = [
				[], // 0 - 0000 - No edges
				[[3, 0]], // 1 - 0001 - Edge between bottom left and top left
				[[0, 1]], // 2 - 0010 - Edge between top left and top right
				[[3, 1]], // 3 - 0011 - Edge between bottom left and top right
				[[1, 2]], // 4 - 0100 - Edge between top right and bottom right
				[[3, 0], [1, 2]], // 5 - 0101 - Edges between bottom left & top left and top right & bottom right
				[[0, 2]], // 6 - 0110 - Edge between top left and bottom right
				[[3, 2]], // 7 - 0111 - Edge between bottom left and bottom right
				[[2, 3]], // 8 - 1000 - Edge between bottom right and bottom left
				[[0, 2]], // 9 - 1001 - Edge between top left and bottom right
				[[1, 3], [0, 2]], // 10 - 1010 - Edges between top right & bottom left and top left & bottom right
				[[1, 3]], // 11 - 1011 - Edge between top right and bottom left
				[[2, 1]], // 12 - 1100 - Edge between bottom right and top right
				[[2, 0]], // 13 - 1101 - Edge between bottom right and top left
				[[1, 3]], // 14 - 1110 - Edge between top right and bottom left
				[] // 15 - 1111 - All inside, no edges
			];

			let edges = edgeTable[index];

			if (edges.length > 0) {
				// Create a contour segment for each pair of edges
				let contour = edges.map(edge => {
					// Interpolate between the grid points (this example just uses midpoints)
					let midpoint1 = interpolateMidpoint(cell[edge[0]], cell[(edge[0] + 1) % 4]);
					let midpoint2 = interpolateMidpoint(cell[edge[1]], cell[(edge[1] + 1) % 4]);
					return [midpoint1, midpoint2];
				});

				contours.push(contour);
			}
		}
	}

	return contours;
}

function interpolateMidpoint(point1, point2) {
	return [
		(point1.lng + point2.lng) / 2,
		(point1.lat + point2.lat) / 2
	];
}

function contoursToGeoJSON(contours) {
	// Convert the array of contour lines into GeoJSON format
	let features = contours.map(contour => {
		return {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'Polygon',
				coordinates: [contour]
			}
		};
	});

	return {
		type: 'FeatureCollection',
		features: features
	};
}

export const useMapStore = defineStore("map", {
	state: () => ({
		// Array of layer IDs that are in the map
		currentLayers: [],
		// Array of layer IDs that are in the map and currently visible
		currentVisibleLayers: [],
		// Stores all map configs for all layers (to be used to render popups)
		mapConfigs: {},
		// Stores the mapbox map instance
		map: null,
		// Stores popup information
		popup: null,
		// Stores saved locations
		savedLocations: savedLocations,
		// Store currently loading layers,
		loadingLayers: [],
	}),
	getters: {},
	actions: {
		/* Initialize Mapbox */
		// 1. Creates the mapbox instance and passes in initial configs
		initializeMapBox() {
			this.map = null;
			const MAPBOXTOKEN = import.meta.env.VITE_MAPBOXTOKEN;
			mapboxGl.accessToken = MAPBOXTOKEN;
			this.map = new mapboxGl.Map({
				...MapObjectConfig,
				style: mapStyle,
			});
			this.map.addControl(new mapboxGl.NavigationControl());
			this.map.doubleClickZoom.disable();
			this.map
				.on("style.load", () => {
					this.initializeBasicLayers();
				})
				.on("click", (event) => {
					if (this.popup) {
						this.popup = null;
					}
					this.addPopup(event);
				})
				.on("idle", () => {
					this.loadingLayers = this.loadingLayers.filter(
						(el) => el !== "rendering"
					);
				});
		},
		// 2. Adds three basic layers to the map (Taipei District, Taipei Village labels, and Taipei 3D Buildings)
		// Due to performance concerns, Taipei 3D Buildings won't be added in the mobile version
		initializeBasicLayers() {
			const authStore = useAuthStore();
			fetch(`${BASE_URL}/mapData/taipei_town.geojson`)
				.then((response) => response.json())
				.then((data) => {
					this.map
						.addSource("taipei_town", {
							type: "geojson",
							data: data,
						})
						.addLayer(TaipeiTown);
				});
			fetch(`${BASE_URL}/mapData/taipei_village.geojson`)
				.then((response) => response.json())
				.then((data) => {
					this.map
						.addSource("taipei_village", {
							type: "geojson",
							data: data,
						})
						.addLayer(TaipeiVillage);
				});
			if (!authStore.isMobileDevice) {
				this.map
					.addSource("taipei_building_3d_source", {
						type: "vector",
						url: import.meta.env.VITE_MAPBOXTILE,
					})
					.addLayer(TaipeiBuilding);
			}

			this.addSymbolSources();
		},
		// 3. Adds symbols that will be used by some map layers
		addSymbolSources() {
			const images = [
				"metro",
				"triangle_green",
				"triangle_white",
				"bike_green",
				"bike_orange",
				"bike_red",
			];
			images.forEach((element) => {
				this.map.loadImage(
					`${BASE_URL}/images/map/${element}.png`,
					(error, image) => {
						if (error) throw error;
						this.map.addImage(element, image);
					}
				);
			});
		},

		/* Adding Map Layers */
		// 1. Passes in the map_config (an Array of Objects) of a component and adds all layers to the map layer list
		addToMapLayerList(map_config) {
			map_config.forEach((element) => {
				let mapLayerId = `${element.index}-${element.type}`;
				// 1-1. If the layer exists, simply turn on the visibility and add it to the visible layers list
				if (
					this.currentLayers.find((element) => element === mapLayerId)
				) {
					this.loadingLayers.push("rendering");
					this.turnOnMapLayerVisibility(mapLayerId);
					if (
						!this.currentVisibleLayers.find(
							(element) => element === mapLayerId
						)
					) {
						this.currentVisibleLayers.push(mapLayerId);
					}
					return;
				}
				let appendLayerId = { ...element };
				appendLayerId.layerId = mapLayerId;
				// 1-2. If the layer doesn't exist, call an API to get the layer data
				this.loadingLayers.push(appendLayerId.layerId);
				this.fetchLocalGeoJson(appendLayerId);
			});
		},
		// 2. Call an API to get the layer data
		fetchLocalGeoJson(map_config) {
			axios
				.get(`${BASE_URL}/mapData/${map_config.index}.geojson`)
				.then((rs) => {
					this.addMapLayerSource(map_config, rs.data);
				})
				.catch((e) => console.error(e));
		},
		// 3. Add the layer data as a source in mapbox
		addMapLayerSource(map_config, data) {
			this.map.addSource(`${map_config.layerId}-source`, {
				type: "geojson",
				data: { ...data },
			});
			if (map_config.type === "arc") {
				this.AddArcMapLayer(map_config, data);
			}
			else if (map_config.type === "kde") {
				this.AddKDEMapLayer(map_config, data);
			}
			else {
				this.addMapLayer(map_config);
			}
		},
		// 4-1. Using the mapbox source and map config, create a new layer
		// The styles and configs can be edited in /assets/configs/mapbox/mapConfig.js
		addMapLayer(map_config) {
			let extra_paint_configs = {};
			let extra_layout_configs = {};
			if (map_config.icon) {
				extra_paint_configs = {
					...maplayerCommonPaint[
					`${map_config.type}-${map_config.icon}`
					],
				};
				extra_layout_configs = {
					...maplayerCommonLayout[
					`${map_config.type}-${map_config.icon}`
					],
				};
			}
			if (map_config.size) {
				extra_paint_configs = {
					...extra_paint_configs,
					...maplayerCommonPaint[
					`${map_config.type}-${map_config.size}`
					],
				};
				extra_layout_configs = {
					...extra_layout_configs,
					...maplayerCommonLayout[
					`${map_config.type}-${map_config.size}`
					],
				};
			}
			this.loadingLayers.push("rendering");
			this.map.addLayer({
				id: map_config.layerId,
				type: map_config.type,
				paint: {
					...maplayerCommonPaint[`${map_config.type}`],
					...extra_paint_configs,
					...map_config.paint,
				},
				layout: {
					...maplayerCommonLayout[`${map_config.type}`],
					...extra_layout_configs,
				},
				source: `${map_config.layerId}-source`,
			});
			this.currentLayers.push(map_config.layerId);
			this.mapConfigs[map_config.layerId] = map_config;
			this.currentVisibleLayers.push(map_config.layerId);
			this.loadingLayers = this.loadingLayers.filter(
				(el) => el !== map_config.layerId
			);
		},
		// require "density" present in property
		// the function use the coordinate info in Point type object in Feature and density to calculate the KDE value
		AddKDEMapLayer(map_config, data) {
			const scaleFactor = 0.1; // Scale factor to adjust visual representation
			const authStore = useAuthStore();
			const lines = [...JSON.parse(JSON.stringify(data.features))];

			let data_points = []

			for (let i = 0; i < lines.length; i++) {
				let point = {}
				if (!lines[i].geometry) continue;
				point.lng = lines[i].geometry.coordinates[0]
				point.lat = lines[i].geometry.coordinates[1]
				point.density = lines[i].properties.density ? lines[i].properties.density : 0;
				data_points.push(point)
			}

			console.log(data_points)

			this.loadingLayers.push("rendering");

			const delay = authStore.isMobileDevice ? 2000 : 500;

			// Using a timeout to ensure map is ready before adding layers
			setTimeout(() => {
				// Create a source for the KDE data
				this.map.addSource('kde', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: data_points.map(point => ({
							type: 'Feature',
							properties: { density: point.density },
							geometry: {
								type: 'Point',
								coordinates: [point.lng, point.lat]
							}
						}))
					}
				});

				// Add the heatmap layer using the KDE data source
				this.map.addLayer({
					id: map_config.layerId,
					type: 'heatmap',
					source: 'kde',
					renderingMode: "3d",
				});
				console.log('kde-heatmap added')
				this.currentLayers.push(map_config.layerId);
				this.mapConfigs[map_config.layerId] = map_config;
				this.currentVisibleLayers.push(map_config.layerId);
				this.loadingLayers = this.loadingLayers.filter(
					(el) => el !== map_config.layerId
				);
			}, delay);
		},
		// 4-2. Add Map Layer for Arc Maps
		AddKDEMapLayer(map_config, data) {
			const scaleFactor = 0.1; // Scale factor to adjust visual representation
			const authStore = useAuthStore();
			const lines = [...JSON.parse(JSON.stringify(data.features))];

			let data_points = []

			// Collect data points with their density
			for (let i = 0; i < lines.length; i++) {
				let point = {}
				if (!lines[i].geometry) continue;
				point.lng = lines[i].geometry.coordinates[0]
				point.lat = lines[i].geometry.coordinates[1]
				point.density = lines[i].properties.density ? lines[i].properties.density : 0;
				data_points.push(point)
			}
			this.loadingLayers.push("rendering");

			const delay = authStore.isMobileDevice ? 2000 : 500;

			setTimeout(() => {
				// Assuming we have a function to calculate KDE and return contour lines as polygons
				const contourPolygons = calculateKDEAndContours(data_points, 0.01, 0.01);
				console.log(contourPolygons);

				// Create a source for the contour data
				this.map.addSource('contours', {
					type: 'geojson',
					data: contourPolygons // GeoJSON FeatureCollection of contour polygons
				});

				// Iterate over each contour and add as a fill-extrusion layer
				contourPolygons.features.forEach((feature, index) => {
					const layerID = `contour-${index}`;
					this.map.addLayer({
						id: layerID,
						type: 'fill-extrusion',
						source: 'contours',
						filter: ['==', 'level', feature.properties.level], // Use the contour level as a filter
						paint: {
							'fill-extrusion-color': feature.properties.color,
							'fill-extrusion-height': feature.properties.level * scaleFactor,
							'fill-extrusion-opacity': 0.6
						}
					});
					// Add layer ID to the list of current layers
					this.currentLayers.push(layerID);
				});

				console.log('3D heatmap layers added');
				// Update map configuration store
				this.mapConfigs[map_config.layerId] = map_config;
				// Add layer to visible layers list
				this.currentVisibleLayers.push(map_config.layerId);
				// Remove the loading layer
				this.loadingLayers = this.loadingLayers.filter((el) => el !== map_config.layerId);

			}, delay);
		},
		//  5. Turn on the visibility for a exisiting map layer
		turnOnMapLayerVisibility(mapLayerId) {
			this.map.setLayoutProperty(mapLayerId, "visibility", "visible");
		},
		// 6. Turn off the visibility of an exisiting map layer but don't remove it completely
		turnOffMapLayerVisibility(map_config) {
			map_config.forEach((element) => {
				let mapLayerId = `${element.index}-${element.type}`;
				this.loadingLayers = this.loadingLayers.filter(
					(el) => el !== mapLayerId
				);

				if (this.map.getLayer(mapLayerId)) {
					this.map.setFilter(mapLayerId, null);
					this.map.setLayoutProperty(
						mapLayerId,
						"visibility",
						"none"
					);
				}
				this.currentVisibleLayers = this.currentVisibleLayers.filter(
					(element) => element !== mapLayerId
				);
			});
			this.removePopup();
		},

		/* Popup Related Functions */
		// Adds a popup when the user clicks on a item. The event will be passed in.
		addPopup(event) {
			// Gets the info that is contained in the coordinates that the user clicked on (only visible layers)
			const clickFeatureDatas = this.map.queryRenderedFeatures(
				event.point,
				{
					layers: this.currentVisibleLayers,
				}
			);
			// Return if there is no info in the click
			if (!clickFeatureDatas || clickFeatureDatas.length === 0) {
				return;
			}
			// Parse clickFeatureDatas to get the first 3 unique layer datas, skip over already included layers
			const mapConfigs = [];
			const parsedPopupContent = [];
			let previousParsedLayer = "";

			for (let i = 0; i < clickFeatureDatas.length; i++) {
				if (mapConfigs.length === 3) break;
				if (previousParsedLayer === clickFeatureDatas[i].layer.id)
					continue;
				previousParsedLayer = clickFeatureDatas[i].layer.id;
				mapConfigs.push(this.mapConfigs[clickFeatureDatas[i].layer.id]);
				parsedPopupContent.push(clickFeatureDatas[i]);
			}
			// Create a new mapbox popup
			this.popup = new mapboxGl.Popup()
				.setLngLat(event.lngLat)
				.setHTML('<div id="vue-popup-content"></div>')
				.addTo(this.map);
			// Mount a vue component (MapPopup) to the id "vue-popup-content" and pass in data
			const PopupComponent = defineComponent({
				extends: MapPopup,
				setup() {
					// Only show the data of the topmost layer
					return {
						popupContent: parsedPopupContent,
						mapConfigs: mapConfigs,
						activeTab: ref(0),
					};
				},
			});
			// This helps vue determine the most optimal time to mount the component
			nextTick(() => {
				const app = createApp(PopupComponent);
				app.mount("#vue-popup-content");
			});
		},
		// Remove the current popup
		removePopup() {
			if (this.popup) {
				this.popup.remove();
			}
			this.popup = null;
		},

		/* Functions that change the viewing experience of the map */

		// Add new saved location that users can quickly zoom to
		addNewSavedLocation(name) {
			const coordinates = this.map.getCenter();
			const zoom = this.map.getZoom();
			const pitch = this.map.getPitch();
			const bearing = this.map.getBearing();
			this.savedLocations.push([coordinates, zoom, pitch, bearing, name]);
		},
		// Zoom to a location
		// [[lng, lat], zoom, pitch, bearing, savedLocationName]
		easeToLocation(location_array) {
			this.map.easeTo({
				center: location_array[0],
				zoom: location_array[1],
				duration: 4000,
				pitch: location_array[2],
				bearing: location_array[3],
			});
		},
		// Remove a saved location
		removeSavedLocation(index) {
			this.savedLocations.splice(index, 1);
		},
		// Force map to resize after sidebar collapses
		resizeMap() {
			if (this.map) {
				setTimeout(() => {
					this.map.resize();
				}, 200);
			}
		},

		/* Map Filtering */
		// Add a filter based on a property on a map layer
		addLayerFilter(layer_id, property, key, map_config) {
			const dialogStore = useDialogStore();
			if (!this.map || dialogStore.dialogs.moreInfo) {
				return;
			}
			if (map_config && map_config.type === "arc") {
				this.map.removeLayer(layer_id);
				let toBeFiltered = {
					...this.map.getSource(`${layer_id}-source`)._data,
				};
				toBeFiltered.features = toBeFiltered.features.filter(
					(el) => el.properties[property] === key
				);
				map_config.layerId = layer_id;
				this.AddArcMapLayer(map_config, toBeFiltered);
				return;
			}
			else if (map_config && map_config.type === "kde") {
				this.map.removeLayer(layer_id);
				let toBeFiltered = {
					...this.map.getSource(`${layer_id}-source`)._data,
				};
				toBeFiltered.features = toBeFiltered.features.filter(
					(el) => el.properties[property] === key
				);
				map_config.layerId = layer_id;
				this.AddKDEMapLayer(map_config, toBeFiltered);
				return;
			}
			this.map.setFilter(layer_id, ["==", ["get", property], key]);
		},
		// Remove any filters on a map layer
		clearLayerFilter(layer_id, map_config) {
			const dialogStore = useDialogStore();
			if (!this.map || dialogStore.dialogs.moreInfo) {
				return;
			}
			if (map_config && map_config.type === "arc") {
				this.map.removeLayer(layer_id);
				let toRestore = {
					...this.map.getSource(`${layer_id}-source`)._data,
				};
				map_config.layerId = layer_id;
				this.AddArcMapLayer(map_config, toRestore);
				return;
			}
			else if (map_config && map_config.type === "kde") {
				this.map.removeLayer(layer_id);
				let toRestore = {
					...this.map.getSource(`${layer_id}-source`)._data,
				};
				map_config.layerId = layer_id;
				this.AddKDEMapLayer(map_config, toRestore);
				return;
			}
			this.map.setFilter(layer_id, null);
		},

		/* Clearing the map */

		// Called when the user is switching between maps
		clearOnlyLayers() {
			this.currentLayers.forEach((element) => {
				this.map.removeLayer(element);
				this.map.removeSource(`${element}-source`);
			});
			this.currentLayers = [];
			this.mapConfigs = {};
			this.currentVisibleLayers = [];
			this.removePopup();
		},
		// Called when user navigates away from the map
		clearEntireMap() {
			this.currentLayers = [];
			this.mapConfigs = {};
			this.map = null;
			this.currentVisibleLayers = [];
			this.removePopup();
		},
	},
});
