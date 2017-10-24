(function () {
    var Ext = window.Ext4 || window.Ext;

    var METRIC_NAME_TODO = 'To Do';
    var METRIC_NAME_ACTUALS = 'Actuals';
    var METRIC_NAME_TOTAL_CAPACITY = 'Total Capacity';
    var METRIC_NAME_DAILY_CAPACITY = 'Daily Capacity';
    var METRIC_NAME_IDEAL_CAPACITY_BURNDOWN = 'Ideal Capacity Based Burndown';

    Ext.define('com.ca.technicalservices.Burnupdown.Calculator', {
        extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
        config: {
            iterationData: undefined
        },

        remainingIdealTodo: undefined,

        /**
         * By default, metric values are nulled on any date shown in the chart AFTER today.
         * Add a metric display name to allow its value to be plotted for dates after today.
         */
        metricsAllowedOnFutureDates: [
            METRIC_NAME_TOTAL_CAPACITY,
            METRIC_NAME_DAILY_CAPACITY,
            METRIC_NAME_IDEAL_CAPACITY_BURNDOWN
        ],

        features: undefined,

        constructor: function (config) {
            this.initConfig(config);
            this.callParent(arguments);
            this._getTotalCapacityForTick = this._getTotalCapacityForTick.bind(this);
            this._getDailyCapacityForTick = this._getDailyCapacityForTick.bind(this);
            this._getCapacityBurndownForTick = this._getCapacityBurndownForTick.bind(this);
        },

        prepareChartData: function (store) {
            return this.callParent(arguments);
        },

        runCalculation: function (snapshots) {
            var result = this.callParent(arguments);
            result = this._nullFutureData(result);
            // TODO (tj) handle features of same name
            var metricNames = {};
            _.each(this.features, function(feature) {
                metricNames[feature.Name + " To Do"] = "To Do";
                metricNames[feature.Name + " Actual"] = "Actual";
            });
            _.each(result.series, function(series){
                if ( metricNames.hasOwnProperty(series.name) ) {
                    series.stack = metricNames[series.name];
                }
            }, this);
            return result;
        },

        _nullFutureData: function (data) {
            var todayIndex = this._getDateIndexFromDate(data, new Date());
            if (todayIndex > -1) {
                _.each(data.series, function (series) {
                    if (!_.contains(this.metricsAllowedOnFutureDates, series.name)) {
                        // This metric name has not been allowed for future dates. Null the values
                        // after today
                        series.data = _.map(series.data, function (value, index) {
                            return (index > todayIndex) ? null : value;
                        }, this);
                    }
                }, this);
            }
            return data;
        },

        _getDateIndexFromDate: function (highcharts_data, check_date) {
            var date_iso = Rally.util.DateTime.toIsoString(new Date(check_date), true).replace(/T.*$/, '');
            var date_index = -1;

            Ext.Array.each(highcharts_data.categories, function (category, idx) {

                if (category >= date_iso && date_index == -1) {
                    date_index = idx;
                }
            });

            if (date_index === 0) {
                return date_index = -1;
            }
            return date_index;
        },

        _getTotalCapacityForTick: function (snapshot, index, metric, seriesData) {
            var capacities = this.iterationData.getCapacitiesForDateString(snapshot.tick);
            return capacities.total;
        },

        _getDailyCapacityForTick: function (snapshot, index, metric, seriesData) {
            var capacities = this.iterationData.getCapacitiesForDateString(snapshot.tick);
            return capacities.daily;
        },

        _getCapacityBurndownForTick: function (snapshot, index, metric, seriesData) {
            var priorCapacity = 0;
            if (index > 0 && seriesData[index - 1][METRIC_NAME_DAILY_CAPACITY]) {
                priorCapacity = seriesData[index - 1][METRIC_NAME_DAILY_CAPACITY]
            }

            if (this.remainingIdealTodo === undefined) {
                if (snapshot['To Do'] != undefined) {
                    // Found the first To Do entry for this chart
                    this.remainingIdealTodo = snapshot['To Do'];
                }
            } else {
                this.remainingIdealTodo = Math.max(this.remainingIdealTodo - priorCapacity, 0);
            }

            return this.remainingIdealTodo || 0;
        },

        getDerivedFieldsOnInput: function () {
            var self = this;
            var fields = [];
            _.forEach(this.features, function (feature) {
                fields.push({
                    as: feature.Name + " To Do",
                    display: 'column',
                    f: function (snapshot) {
                        return self._getDataForFeature(feature, snapshot, 'TaskRemainingTotal');
                    }
                });
                fields.push({
                    as: feature.Name + " Actual",
                    display: 'column',
                    f: function (snapshot) {
                        return self._getDataForFeature(feature, snapshot, 'TaskActualTotal');
                    }
                });
            }, this);
            return fields;
        },

        _getDataForFeature: function (feature, snapshot, attribute) {
            if ( snapshot.Feature === feature.ObjectID ) {
                return snapshot[attribute];
            } else {
                return 0;
            }
        },

        getDerivedFieldsAfterSummary: function () {
            return [
                {
                    as: METRIC_NAME_TOTAL_CAPACITY,
                    display: 'line',
                    f: this._getTotalCapacityForTick
                },
                {
                    as: METRIC_NAME_DAILY_CAPACITY,
                    display: 'line',
                    f: this._getDailyCapacityForTick
                },
                {
                    as: METRIC_NAME_IDEAL_CAPACITY_BURNDOWN,
                    display: 'line',
                    f: this._getCapacityBurndownForTick
                }
            ]
        },

        getMetrics: function () {
            var metrics = [];
            _.each(this.features, function (feature) {
                metrics.push({
                    field: feature.Name + " To Do",
                    as: feature.Name + " To Do",
                    f: 'sum',
                    display: 'column'
                });
                metrics.push({
                    field: feature.Name + " Actual",
                    as: feature.Name + " Actual",
                    f: 'sum',
                    display: 'column'
                })
            });
            return metrics;
            /*
            metrics.push({
                field: "TaskActualTotal",
                as: METRIC_NAME_ACTUALS,
                f: 'sum',
                display: 'column'
            });
            return metrics;
            /*
            return [
                {
                    field: "TaskRemainingTotal",
                    as: METRIC_NAME_TODO,
                    f: 'sum',
                    display: 'column'
                },
                {
                    field: "TaskActualTotal",
                    as: METRIC_NAME_ACTUALS,
                    f: 'sum',
                    display: 'column'
                }
            ];
            */
        },

        getProjectionsConfig: function () {
            return {
                limit: 1
            };
        }
    });
}());