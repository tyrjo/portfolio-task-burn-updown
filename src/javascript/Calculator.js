(function () {
    var Ext = window.Ext4 || window.Ext;

    var METRIC_NAME_PREFIX_TODO = 'To Do ';
    var METRIC_NAME_TOTAL_TODO = 'Total To Do';
    var METRIC_NAME_PREFIX_ACTUAL = 'Actual ';
    var METRIC_NAME_TOTAL_ACTUAL = 'Total Actual';
    var METRIC_NAME_TOTAL_CAPACITY = 'Total Capacity';
    var METRIC_NAME_DAILY_CAPACITY = 'Daily Capacity';
    var METRIC_NAME_IDEAL_CAPACITY_BURNDOWN = 'Ideal Capacity Based Burndown';

    var SUMMARY_METRIC_NAME_TOTAL_TODO_START_INDEX = METRIC_NAME_TOTAL_TODO + ' Start Index';

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
            //this._getTotalCapacityForTick = this._getTotalCapacityForTick.bind(this);
            this._getDailyCapacityForTick = this._getDailyCapacityForTick.bind(this);
            this._getCapacityBurndownForTick = this._getCapacityBurndownForTick.bind(this);
            this._getFeatureName = this._getFeatureName.bind(this);

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

            // Build a map of metric names to series attributes we want to add
            _.each(this.features, function (feature) {
                metricNames[METRIC_NAME_PREFIX_TODO + feature.Name] = {
                    stack: METRIC_NAME_PREFIX_TODO,
                    color: Ext.draw.Color.toHex(colors[colorIndex]),
                    borderRadius: 5
                };
                metricNames[METRIC_NAME_PREFIX_ACTUAL + feature.Name] = {
                    stack: METRIC_NAME_PREFIX_ACTUAL,
                    color: Ext.draw.Color.toHex(colors[colorIndex])
                };
                // TODO (tj) jump colors if fewer than 12 series
                colorIndex = (colorIndex + 1) % 12;
            });

            // For each series, add any needed HighCharts series attributes
            result.series = _.map(result.series, function (series) {
                return _.merge(series, metricNames[series.name]);
            });

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

        /*
        _getTotalCapacityForTick: function (snapshot) {
            var capacities = this.iterationData.getCapacitiesForDateString(snapshot.tick);
            return capacities.total;
        },
        */

        _getDailyCapacityForTick: function (snapshot) {
            var capacities = this.iterationData.getCapacitiesForDateString(snapshot.tick);
            return capacities.daily;
        },

        _getCapacityBurndownForTick: function (snapshot, index, summaryMetrics, seriesData) {
            var result = 0;

            var todoStartIndex = summaryMetrics[SUMMARY_METRIC_NAME_TOTAL_TODO_START_INDEX];
            if (index < todoStartIndex) {
                // Haven't started yet
                result = null;
            } else if (index == todoStartIndex) {
                // First day To Do data is available, this is start of ideal burndown
                result = snapshot[METRIC_NAME_TOTAL_TODO];
            } else {
                var priorSnapshot = seriesData[index-1];
                var currentCapacity = this._getDailyCapacityForTick(snapshot);

                // Today the team (ideally) would have reduced yesterday's remaining work by today's
                // daily capacity resulting in today's "ideal capacity burndown" value, which will be
                // the idea amount of work the team will reduce by tomorrow's capacity, etc.
                result = Math.max(0, priorSnapshot[METRIC_NAME_IDEAL_CAPACITY_BURNDOWN] - currentCapacity);
            }
            return result;

            /*
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
            */
        },

        _getDataForFeature: function (feature, snapshot, attribute) {
            if (snapshot.Feature === feature.ObjectID) {
                return snapshot[attribute];
            } else {
                return 0;
            }
        },

        _getFeatureName: function (snapshot) {
            return this.featureNameMap[snapshot.Feature]
        },

        /**
         * Called once for every snapshot.
         * Not charted, but added to snapshot data
         *
         * These functions get original `snapshot` which is:
         * - data from the store
         * - any prior derived fields
         * @returns {Array}
         */
        getDerivedFieldsOnInput: function () {
            var self = this;
            var fields = [];

            // For each snapshot, add derived fields that indicate how much that snapshot contributes
            // to each feature. This will be summed by metrics in getMetrics.
            _.forEach(this.features, function (feature) {
                fields.push({
                    as: METRIC_NAME_PREFIX_TODO + feature.Name,
                    f: function (snapshot) {
                        return self._getDataForFeature(feature, snapshot, 'TaskRemainingTotal');
                    }
                });
                fields.push({
                    as: METRIC_NAME_PREFIX_ACTUAL + feature.Name,
                    f: function (snapshot) {
                        return self._getDataForFeature(feature, snapshot, 'TaskActualTotal');
                    }
                });
            }, this);

            return fields;
        },

        /**
         * Called ?for each individual item, then again for running tally of that item plus all prior?
         * These fields are charted
         *
         * `field` appears required in the config but ?might? be optional if `as` name matches field in data?
         * `as` is required otherwise only legend appears
         *
         * These functions get 5 arguments:
         * - array of values for the requested `field` from the data
         * - ? current running value
         * - ? array of values for the current snapshot
         * - the outgoing row data
         * - the `field` name + '_'
         *
         * @param {Number[]} [values] Must either provide values or oldResult and newValues
         * @param {Number} [oldResult] for incremental calculation
         * @param {Number[]} [newValues] for incremental calculation
         *
         *
         * @returns {Array}
         */
        getMetrics: function () {
            var metrics = [];

            // For each feature, sum the total contributions to that feature from all snapshots
            // in the given tick. Basically sum the derived fields created in getDerivedFieldsOnInput

            // Alternatively, one might consider using 'groupBySum' fields.
            //
            // This will cause Lumenize to automatically generate the necessary
            // derived fields on input that contain the data for each allowedValue, HOWEVER,
            // by default, runCalculation will attempt to display the field NAME, not taking
            // into account the automatically generated derived fields. runCalculation MUST be
            // overridden to look for the 'prefix' used in these metrics, and create series
            // definitions for each of the automatically generated derived fields AND group them
            // together.  Inspect Rally.data.lookback.calculator.TimeSeriesCalculator methods
            // runCalculation() and _buildSeriesConfig() to see how it doesn't understand the
            // automatically generated derived fields needed by groupBySum or groupByCount.
            //
            // In the end...it is probably more understandable to create the needed derived fields
            // explicitly in code, and create the desired output series for each one explicitly in
            // the metrics, then simply add a grouping tag to the resulting series in runCalculation
            // after getting result from callParent.
            // Here in an example of groupBySum that would require special handling in runCalculation
            /*
            var allowedValues = _.pluck(this.features, 'Name');
            {
                f: 'groupBySum',
                field: 'TaskRemainingTotal',
                groupByField: 'Feature Name',
                allowedValues: allowedValues,
                prefix: 'To Do ',
                display: 'column'
            },
            */
            _.each(this.features, function (feature) {
                metrics.push({
                    field: METRIC_NAME_PREFIX_TODO + feature.Name,
                    as: METRIC_NAME_PREFIX_TODO + feature.Name,
                    f: 'sum',
                    display: 'column'
                });
                metrics.push({
                    field: METRIC_NAME_PREFIX_ACTUAL + feature.Name,
                    as: METRIC_NAME_PREFIX_ACTUAL + feature.Name,
                    f: 'sum',
                    display: 'column'
                });
            });

            // Also, sum the total values for all snapshots for all features
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

            return metrics;
        },

        /**
         * Called ONCE!
         * Not charted
         *
         * Get moar derived fields AFTER the main chart metrics are defined
         * These functions get:
         * - seriesData
         *   - array of component values for each metric result named <metric 'as' name>_values
         *   - result value for metrics, named <metric 'as' name>
         * - summary metrics which is an object containing the result of any prior summary metrics
         *
         * @returns {Array}
         */

        getSummaryMetricsConfig: function () {
            return [
                {
                    as: SUMMARY_METRIC_NAME_TOTAL_TODO_START_INDEX,
                    f: function (seriesData, summaryMetrics) {
                        return _.findIndex(seriesData, METRIC_NAME_TOTAL_TODO);
                    }
                }
            ]
        },

        /**
         * Called once for every snapshot.
         * These fields are charted
         *
         * Extra chart fields to display using fields defined in summary metrics.  These
         * functions get:
         * - snapshot - the result of any metrics plus the array of component values for each metric
         * - index - the index into series data for this snapshot
         * - summary metrics - object of the summary metrics
         * - series data - the array of snapshots where index-1 has been updated with the result of the derived fields
         * @returns {Array}
         */
        getDerivedFieldsAfterSummary: function () {
            return [
                /*
                {
                    field: 'TaskRemainingTotal',
                    as: METRIC_NAME_TOTAL_TODO,
                    f: 'sum'
                },
                {
                    field: 'TaskActualTotal',
                    as: METRIC_NAME_TOTAL_ACTUAL,
                    f: 'sum'
                },
                */
                {
                    as: METRIC_NAME_IDEAL_CAPACITY_BURNDOWN,
                    f: this._getCapacityBurndownForTick,
                    display: 'line'
                }

            ]
        }


    });
}());