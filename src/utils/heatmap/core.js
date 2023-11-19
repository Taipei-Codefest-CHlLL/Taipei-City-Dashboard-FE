import Util from './util';
import HeatmapConfig from './config';
import Store from './data';

var Heatmap = (function HeatmapClosure() {

	var Coordinator = (function CoordinatorClosure() {

		class Coordinator {
			constructor() {
				this.cStore = {};
			}
			on(evtName, callback, scope) {
				var cStore = this.cStore;

				if (!cStore[evtName]) {
					cStore[evtName] = [];
				}
				cStore[evtName].push((function (data) {
					return callback.call(scope, data);
				}));
			}
			emit(evtName, data) {
				var cStore = this.cStore;
				if (cStore[evtName]) {
					var len = cStore[evtName].length;
					for (var i = 0; i < len; i++) {
						var callback = cStore[evtName][i];
						callback(data);
					}
				}
			}
		};


		return Coordinator;
	})();


	var _connect = function (scope) {
		var renderer = scope._renderer;
		var coordinator = scope._coordinator;
		var store = scope._store;

		// coordinator.on('renderpartial', renderer.renderPartial, renderer);
		// coordinator.on('renderall', renderer.renderAll, renderer);
		// coordinator.on('extremachange', function (data) {
		// 	scope._config.onExtremaChange &&
		// 		scope._config.onExtremaChange({
		// 			min: data.min,
		// 			max: data.max,
		// 			gradient: scope._config['gradient'] || scope._config['defaultGradient']
		// 		});
		// });
		store.setCoordinator(coordinator);
	};


	class Heatmap {
		constructor() {
			var config = this._config = Util.merge(HeatmapConfig, arguments[0] || {});
			this._coordinator = new Coordinator();
			if (config['plugin']) {
				var pluginToLoad = config['plugin'];
				if (!HeatmapConfig.plugins[pluginToLoad]) {
					throw new Error('Plugin \'' + pluginToLoad + '\' not found. Maybe it was not registered.');
				} else {
					var plugin = HeatmapConfig.plugins[pluginToLoad];
					// set plugin renderer and store
					this._renderer = new plugin.renderer(config);
					this._store = new plugin.store(config);
				}
			} else {
				// this._renderer = new Renderer(config);
				this._store = new Store(config);
			}
			_connect(this);
		}
		// @TODO:
		// add API documentation
		addData() {
			this._store.addData.apply(this._store, arguments);
			return this;
		}
		// @TODO:
		// add API documentation
		removeData() {
			this._store.removeData && this._store.removeData.apply(this._store, arguments);
			return this;
		}
		// @TODO:
		// add API documentation
		setData() {
			this._store.setData.apply(this._store, arguments);
			return this;
		}
		// @TODO:
		// add API documentation
		setDataMax() {
			this._store.setDataMax.apply(this._store, arguments);
			return this;
		}
		// @TODO:
		// add API documentation
		setDataMin() {
			this._store.setDataMin.apply(this._store, arguments);
			return this;
		}
		// @TODO:
		// add API documentation
		configure(config) {
			this._config = Util.merge(this._config, config);
			// this._renderer.updateConfig(this._config);
			this._coordinator.emit('renderall', this._store._getInternalData());
			return this;
		}
		// @TODO:
		// add API documentation
		repaint() {
			this._coordinator.emit('renderall', this._store._getInternalData());
			return this;
		}
		// @TODO:
		// add API documentation
		getData() {
			return this._store.getData();
		}
		// @TODO:
		// add API documentation
		getDataURL() {
			// return this._renderer.getDataURL();
		}
		// @TODO:
		// add API documentation
		getValueAt(point) {

			if (this._store.getValueAt) {
				return this._store.getValueAt(point);
			}
			else {
				return null;
			}
		}
	};


	return Heatmap;

})();

// core
var heatmapFactory = {
	create: function (config) {
		return new Heatmap(config);
	},
	register: function (pluginKey, plugin) {
		HeatmapConfig.plugins[pluginKey] = plugin;
	}
};

export default heatmapFactory;