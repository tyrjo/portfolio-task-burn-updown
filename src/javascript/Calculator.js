(function () {
    var Ext = window.Ext4 || window.Ext;

    var METRIC_NAME_TODO = 'To Do';
    var METRIC_NAME_TOTAL_TODO = 'Total To Do';
    var METRIC_NAME_ACTUAL = 'Actual';
    var METRIC_NAME_TOTAL_ACTUAL = 'Total Actual';
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

        featureNameMap: undefined,

        constructor: function (config) {
            this.initConfig(config);
            this.callParent(arguments);
            this._getTotalCapacityForTick = this._getTotalCapacityForTick.bind(this);
            this._getDailyCapacityForTick = this._getDailyCapacityForTick.bind(this);
            this._getCapacityBurndownForTick = this._getCapacityBurndownForTick.bind(this);
            this.featureNameMap = _.reduce(this.features, function (accumulator, value) {
                accumulator[value.ObjectID] = value.Name;
                return accumulator;
            }, {});
        },

        prepareChartData: function (store) {
            return this.callParent(arguments);
        },

        runCalculation: function (snapshots) {
            var result = this.callParent(arguments);
            result = this._nullFutureData(result);
            // TODO (tj) handle features of same name
            var metricNames = {};
            var colorIndex = 0;
            var colors = [
                'rgb(214,234,194)',
                'rgb(167,217,197)',
                'rgb(121,199,199)',
                'rgb(77,183,204)',
                'rgb(47,161,199)',
                'rgb(41,134,181)',
                'rgb(37,108,164)',
                'rgb(33,83,147)',
                'rgb(27,58,130)',
                'rgb(22,36,115)',
                'rgb(19,28,90)',
                'rgb(17,21,66)'
            ];

            _.each(this.features, function (feature) {
                metricNames[feature.Name + ' ' + METRIC_NAME_TODO] = {
                    stack: METRIC_NAME_TODO,
                    color: Ext.draw.Color.toHex(colors[colorIndex])
                };
                metricNames[feature.Name + ' ' + METRIC_NAME_ACTUAL] = {
                    stack: METRIC_NAME_ACTUAL,
                    color: Ext.draw.Color.toHex(colors[colorIndex])
                };
                colorIndex = (colorIndex + 1) % 12;
            });
            _.each(result.series, function (series) {
                if (metricNames.hasOwnProperty(series.name)) {
                    series.stack = metricNames[series.name].stack;
                    series.color = metricNames[series.name].color;
                    //series.borderColor = '#000000';
                    //series.borderWidth = 5;
                    if (series.stack === METRIC_NAME_TODO) {
                        //series.borderColor = '#FF0000';
                        series.borderRadius = 10;
                    } else {
                        //series.borderColor = '#0000FF';
                    }
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
                var featureName = this.featureNameMap[snapshot.ObjectID];
                if (snapshot[featureName + ' ' + METRIC_NAME_TODO]) {
                    // Found the first To Do entry for this chart
                    this.remainingIdealTodo = snapshot[featureName + ' ' + METRIC_NAME_TODO];
                }
            } else {
                this.remainingIdealTodo = Math.max(this.remainingIdealTodo - priorCapacity, 0);
            }

            return this.remainingIdealTodo || 0;
        },

        _getDataForFeature: function (feature, snapshot, attribute) {
            if (snapshot.Feature === feature.ObjectID) {
                return snapshot[attribute];
            } else {
                return 0;
            }
        },

        getDerivedFieldsOnInput: function () {
            var self = this;
            var fields = [];
            _.forEach(this.features, function (feature) {
                _(fields).chain()
                    .push({
                        as: feature.Name + ' ' + METRIC_NAME_TODO,
                        f: function (snapshot) {
                            return self._getDataForFeature(feature, snapshot, 'TaskRemainingTotal');
                        }
                    })
                    .push({
                        as: feature.Name + ' ' + METRIC_NAME_ACTUAL,
                        f: function (snapshot) {
                            return self._getDataForFeature(feature, snapshot, 'TaskActualTotal');
                        }
                    });
            }, this);
            fields.push({
                as: METRIC_NAME_DAILY_CAPACITY,
                f: this._getDailyCapacityForTick
            });

            return fields;
        },

        getMetrics: function () {
            var metrics = [];
            _.each(this.features, function (feature) {
                metrics.push({
                    field: feature.Name + ' ' + METRIC_NAME_TODO,
                    as: feature.Name + ' ' + METRIC_NAME_TODO,
                    f: 'sum',
                    display: 'column'
                });
                metrics.push({
                    field: feature.Name + ' ' + METRIC_NAME_ACTUAL,
                    as: feature.Name + ' ' + METRIC_NAME_ACTUAL,
                    f: 'sum',
                    display: 'column'
                })
            });
            metrics.push({
                field: 'TaskRemainingTotal',
                as: METRIC_NAME_TOTAL_TODO,
                f: 'sum'
            });
            metrics.push({
                field: 'TaskActualTotal',
                as: METRIC_NAME_TOTAL_ACTUAL,
                f: 'sum'
            });
            metrics.push({
                field: METRIC_NAME_DAILY_CAPACITY,
                as: METRIC_NAME_IDEAL_CAPACITY_BURNDOWN,
                display: 'line',
                f: this._getCapacityBurndownForTick
            });
            return metrics;
        },
        /*
                getSummaryMetricsConfig: function () {
                    return []
                },
        */
        /*
        getDerivedFieldsAfterSummary: function () {
            return [
                {
                    field: 'TaskRemainingTotal',
                    as: METRIC_NAME_TOTAL_TODO,
                    f: 'sum'
                },
                {
                    field: 'TaskActualTotal',
                    as: METRIC_NAME_TOTAL_ACTUAL,
                    f: 'sum'
                }

            ]
        }
        */
    });
}());