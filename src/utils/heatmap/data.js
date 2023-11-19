import Util from './util';
import HeatmapConfig from './config';

var Store = (function StoreClosure() {

	class Store {
		constructor(config) {
			this._coordinator = {};
			this._data = [];
			this._radi = [];
			this._min = 10;
			this._max = 1;
			this._xField = config['xField'] || config.defaultXField;
			this._yField = config['yField'] || config.defaultYField;
			this._valueField = config['valueField'] || config.defaultValueField;

			if (config["radius"]) {
				this._cfgRadius = config["radius"];
			}
		}
		// when forceRender = false -> called from setData, omits renderall event
		_organiseData(dataPoint, forceRender) {
			var x = dataPoint[this._xField];
			var y = dataPoint[this._yField];
			var radi = this._radi;
			var store = this._data;
			var max = this._max;
			var min = this._min;
			var value = dataPoint[this._valueField] || 1;
			var radius = dataPoint.radius || this._cfgRadius || defaultRadius;

			if (!store[x]) {
				store[x] = [];
				radi[x] = [];
			}

			if (!store[x][y]) {
				store[x][y] = value;
				radi[x][y] = radius;
			} else {
				store[x][y] += value;
			}
			var storedVal = store[x][y];

			if (storedVal > max) {
				if (!forceRender) {
					this._max = storedVal;
				} else {
					this.setDataMax(storedVal);
				}
				return false;
			} else if (storedVal < min) {
				if (!forceRender) {
					this._min = storedVal;
				} else {
					this.setDataMin(storedVal);
				}
				return false;
			} else {
				return {
					x: x,
					y: y,
					value: value,
					radius: radius,
					min: min,
					max: max
				};
			}
		}
		_unOrganizeData() {
			var unorganizedData = [];
			var data = this._data;
			var radi = this._radi;

			for (var x in data) {
				for (var y in data[x]) {

					unorganizedData.push({
						x: x,
						y: y,
						radius: radi[x][y],
						value: data[x][y]
					});

				}
			}
			return {
				min: this._min,
				max: this._max,
				data: unorganizedData
			};
		}
		_onExtremaChange() {
			this._coordinator.emit('extremachange', {
				min: this._min,
				max: this._max
			});
		}
		addData() {
			if (arguments[0].length > 0) {
				var dataArr = arguments[0];
				var dataLen = dataArr.length;
				while (dataLen--) {
					this.addData.call(this, dataArr[dataLen]);
				}
			} else {
				// add to store  
				var organisedEntry = this._organiseData(arguments[0], true);
				if (organisedEntry) {
					// if it's the first datapoint initialize the extremas with it
					if (this._data.length === 0) {
						this._min = this._max = organisedEntry.value;
					}
					this._coordinator.emit('renderpartial', {
						min: this._min,
						max: this._max,
						data: [organisedEntry]
					});
				}
			}
			return this;
		}
		setData(data) {
			var dataPoints = data.data;
			var pointsLen = dataPoints.length;


			// reset data arrays
			this._data = [];
			this._radi = [];

			for (var i = 0; i < pointsLen; i++) {
				this._organiseData(dataPoints[i], false);
			}
			this._max = data.max;
			this._min = data.min || 0;

			this._onExtremaChange();
			this._coordinator.emit('renderall', this._getInternalData());
			return this;
		}
		removeData() {
			// TODO: implement
		}
		setDataMax(max) {
			this._max = max;
			this._onExtremaChange();
			this._coordinator.emit('renderall', this._getInternalData());
			return this;
		}
		setDataMin(min) {
			this._min = min;
			this._onExtremaChange();
			this._coordinator.emit('renderall', this._getInternalData());
			return this;
		}
		setCoordinator(coordinator) {
			this._coordinator = coordinator;
		}
		_getInternalData() {
			return {
				max: this._max,
				min: this._min,
				data: this._data,
				radi: this._radi
			};
		}
		getData() {
			return this._unOrganizeData();
		}
	}

	var defaultRadius = HeatmapConfig.defaultRadius;



	return Store;
})();

export default Store;