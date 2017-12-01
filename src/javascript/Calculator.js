(function () {
    var Ext = window.Ext4 || window.Ext;

    var METRIC_NAME_PREFIX_TODO = 'To Do ';
    var METRIC_NAME_TOTAL_TODO = 'Total To Do';
    var METRIC_NAME_PREFIX_ACTUAL = 'Actual ';
    var METRIC_NAME_TOTAL_ACTUAL = 'Total Actual';
    var METRIC_NAME_TOTAL_CAPACITY = 'Total Capacity';
    var METRIC_NAME_DAILY_CAPACITY = 'Daily Capacity';
    var METRIC_NAME_IDEAL_CAPACITY_BURNDOWN = 'Capacity Based Burndown';
    var METRIC_NAME_FUTURE_IDEAL_CAPACITY_BURNDOWN = 'Future ' + METRIC_NAME_IDEAL_CAPACITY_BURNDOWN;
    var METRIC_NAME_TASK_ESTIMATE_TOTAL = 'Refined Estimate';

    var SUMMARY_METRIC_NAME_ACTUAL_START_INDEX = 'Actual Start Index';
    var SUMMARY_METRIC_NAME_TODAY_INDEX = 'Today Index';
    var SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE = 'Preliminary Estimate';
    var SUMMARY_METRIC_NAME_IDEAL_BURNDOWN = 'Ideal';
    var SUMMARY_METRIC_NAME_TASK_EST_TOTAL_MAX = METRIC_NAME_TOTAL_TODO + ' Max';

    Ext.define('com.ca.technicalservices.Burnupdown.Calculator', {
        extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
        config: {
            iterationCapacitiesManager: undefined,
            updateProjectedDoneDateCallback: undefined
        },

        remainingIdealTodo: undefined,

        /**
         * By default, metric values are nulled on any date shown in the chart AFTER today.
         * Add a metric display name to allow its value to be plotted for dates after today.
         */
        metricsAllowedOnFutureDates: [
            METRIC_NAME_TOTAL_CAPACITY,
            METRIC_NAME_DAILY_CAPACITY,
            METRIC_NAME_IDEAL_CAPACITY_BURNDOWN,
            METRIC_NAME_FUTURE_IDEAL_CAPACITY_BURNDOWN,
            METRIC_NAME_TASK_ESTIMATE_TOTAL,
            SUMMARY_METRIC_NAME_IDEAL_BURNDOWN,
            SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE
        ],

        features: undefined,

        constructor: function (config) {
            this.initConfig(config);
            this.callParent(arguments);
        },

        runCalculation: function (snapshots) {
            var result = this.callParent(arguments);
            result = this._nullFutureData(result);

            // Today's capcity and remaining to do have been updated
            if ( this.config.updateProjectedDoneDateCallback ) {
                this.config.updateProjectedDoneDateCallback(this.currentCapacity, this.currentTodo);
            }

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
            var numColors = colors.length;
            // Minimum step of 1, otherwise step an even amount if there are a small number of features
            var colorIndexStep = Math.min(1, Math.floor(numColors / Math.min(numColors, this.features.length)));
            _.each(this.features, function (feature) {
                metricNames[METRIC_NAME_PREFIX_TODO + feature.get('FormattedID')] = {
                    stack: METRIC_NAME_PREFIX_TODO,
                    color: Ext.draw.Color.toHex(colors[colorIndex]),
                    borderRadius: 10
                };
                metricNames[METRIC_NAME_PREFIX_ACTUAL + feature.get('FormattedID')] = {
                    stack: METRIC_NAME_PREFIX_ACTUAL,
                    color: Ext.draw.Color.toHex(colors[colorIndex])
                };
                colorIndex = (colorIndex + colorIndexStep) % numColors;
            });

            // For each series, add any needed HighCharts series attributes
            result.series = _.map(result.series, function (series) {
                return _.merge(series, metricNames[series.name]);
            });

            return result;
        },

        _nullFutureData: function (data) {
            if (this.todayIndex > -1) {
                _.each(data.series, function (series) {
                    if (!_.contains(this.metricsAllowedOnFutureDates, series.name)) {
                        // This metric name has not been allowed for future dates. Null the values
                        // after today
                        series.data = _.map(series.data, function (value, index) {
                            return (index > this.todayIndex) ? null : value;
                        }, this);
                    }
                }, this);
            }
            return data;
        },

        _getDailyCapacityForTick: function (snapshot) {
            var capacities = this.iterationCapacitiesManager.getCapacitiesForDateString(snapshot.tick);
            return capacities.daily;
        },

        _getCapacityBurndownForTick: function (snapshot, index, summaryMetrics, seriesData) {
            var result = 0;
            var todoStartIndex = summaryMetrics[SUMMARY_METRIC_NAME_ACTUAL_START_INDEX];
            if (index < todoStartIndex) {
                // Haven't started yet
                result = null;
            } else if (index == todoStartIndex) {
                // First day To Do data is available, this is start of ideal burndown
                result = summaryMetrics[SUMMARY_METRIC_NAME_TASK_EST_TOTAL_MAX];
            } else {
                var latestValidCapacitySnapshot;
                var todayIndex = summaryMetrics[SUMMARY_METRIC_NAME_TODAY_INDEX];
                if (todayIndex == -1) {
                    var todayDate = new Date();
                    var startDate = Ext.Date.parse(seriesData[0].tick, 'c');
                    if (startDate > todayDate) {
                        // Chart begins after today
                        todayIndex = 0;
                    } else {
                        // Chart ends before today
                        todayIndex = seriesData.length - 1;
                    }
                }

                if (index > todayIndex) {
                    latestValidCapacitySnapshot = seriesData[todayIndex];
                } else {
                    latestValidCapacitySnapshot = snapshot;
                }
                var currentCapacity = this._getDailyCapacityForTick(latestValidCapacitySnapshot);

                var priorSnapshot = seriesData[index - 1];

                // Today the team (ideally) would have reduced yesterday's remaining work by today's
                // daily capacity resulting in today's "ideal capacity burndown" value, which will be
                // the idea amount of work the team will reduce by tomorrow's capacity, etc.
                result = Math.max(0, priorSnapshot[METRIC_NAME_IDEAL_CAPACITY_BURNDOWN] - currentCapacity);
            }
            return result;
        },

        _getFutureCapacityBurndownForTick: function (snapshot, index, summaryMetrics, seriesData) {
            var result = 0;

            if (this.todayIndex < 0) {
                result = null;
            } else if (index < this.todayIndex) {
                // Haven't started yet
                result = null;
            } else if (index == this.todayIndex) {
                // First day To Do data is available, this is start of forecast burndown
                result = snapshot[METRIC_NAME_TOTAL_TODO];
                this.currentTodo = result;
            } else {
                var latestValidCapacitySnapshot;
                latestValidCapacitySnapshot = seriesData[this.todayIndex];

                var currentCapacity = this._getDailyCapacityForTick(latestValidCapacitySnapshot);

                this.currentCapacity = currentCapacity;

                var priorSnapshot = seriesData[index - 1];

                // Today the team (ideally) would have reduced yesterday's remaining work by today's
                // daily capacity resulting in today's "ideal capacity burndown" value, which will be
                // the idea amount of work the team will reduce by tomorrow's capacity, etc.
                result = Math.max(0, priorSnapshot[METRIC_NAME_FUTURE_IDEAL_CAPACITY_BURNDOWN] - currentCapacity);
            }
            return result;
        },

        _getDataForFeature: function (feature, snapshot, attribute) {
            // TODO (tj) Add to readme that 'Feature' name may vary if Portfolio item type
            if (snapshot.Feature === feature.get('ObjectID')) {
                return snapshot[attribute];
            } else {
                return 0;
            }
        },

        _getFeaturesInitialHourEstimates: function () {
            return _.reduce(this.features, function (sum, feature) {
                return sum + (feature.get('c_InitialHourEstimate') || 0);
            }, 0);
        },

        _getFeaturesInitialHourEstimatesMetric: function (snapshot, index, summaryMetrics, seriesData) {
            return summaryMetrics[SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE];
        },

        _getIdealBurndownForTick: function (snapshot, index, summaryMetrics, seriesData) {

            var result = 0;

            var todoStartIndex = summaryMetrics[SUMMARY_METRIC_NAME_ACTUAL_START_INDEX];

            if (index < todoStartIndex) {
                // Haven't started yet
                result = null;
            } else if (index == todoStartIndex) {
                // First day To Do data is available, this is start of ideal burndown
                result = summaryMetrics[SUMMARY_METRIC_NAME_TASK_EST_TOTAL_MAX];
            } else {
                var max = summaryMetrics[SUMMARY_METRIC_NAME_TASK_EST_TOTAL_MAX];
                var increments = seriesData.length - 1 - todoStartIndex;
                var incrementAmount = max / increments;
                return Math.floor(100 * (max - ((index - todoStartIndex) * incrementAmount))) / 100
            }
            return result;
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
                    as: METRIC_NAME_PREFIX_TODO + feature.get('FormattedID'),
                    f: function (snapshot) {
                        return self._getDataForFeature(feature, snapshot, 'TaskRemainingTotal');
                    }
                });
                fields.push({
                    as: METRIC_NAME_PREFIX_ACTUAL + feature.get('FormattedID'),
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
                    field: METRIC_NAME_PREFIX_TODO + feature.get('FormattedID'),
                    as: METRIC_NAME_PREFIX_TODO + feature.get('FormattedID'),
                    f: 'sum',
                    display: 'column'
                });
                metrics.push({
                    field: METRIC_NAME_PREFIX_ACTUAL + feature.get('FormattedID'),
                    as: METRIC_NAME_PREFIX_ACTUAL + feature.get('FormattedID'),
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

            // Add Task Estimate Totals
            metrics.push({
                field: 'TaskEstimateTotal',
                as: METRIC_NAME_TASK_ESTIMATE_TOTAL,
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
                    as: SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE,
                    f: this._getFeaturesInitialHourEstimates.bind(this)
                },
                {
                    field: METRIC_NAME_TASK_ESTIMATE_TOTAL,
                    as: SUMMARY_METRIC_NAME_TASK_EST_TOTAL_MAX,
                    f: 'max'
                },
                {
                    as: SUMMARY_METRIC_NAME_ACTUAL_START_INDEX,
                    f: (function (seriesData, summaryMetrics) {
                        var startDate = Ext.Date.parse(this.getStartDate(), 'c');
                        return _.findIndex(seriesData, function (data) {
                            return Ext.Date.parse(data.tick, 'c') >= startDate;
                        });
                    }).bind(this)
                },
                {
                    as: SUMMARY_METRIC_NAME_TODAY_INDEX,
                    f: (function (seriesData, summaryMetrics) {
                        // Save todayIndex onto the calculator so it is available in this.runCalculation, which
                        // doesn't have access to the summary metrics
                        this.todayIndex = _.findIndex(seriesData, function (data) {
                            return Ext.Date.parse(data.tick, 'c') > new Date();
                        });
                        return this.todayIndex;
                    }).bind(this)
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
                {
                    as: METRIC_NAME_IDEAL_CAPACITY_BURNDOWN,
                    f: this._getCapacityBurndownForTick.bind(this),
                    display: 'line'
                },
                {
                    as: METRIC_NAME_FUTURE_IDEAL_CAPACITY_BURNDOWN,
                    f: this._getFutureCapacityBurndownForTick.bind(this),
                    display: 'line'
                },
                {
                    field: SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE,
                    as: SUMMARY_METRIC_NAME_INITIAL_HOUR_ESTIMATE,
                    f: this._getFeaturesInitialHourEstimatesMetric.bind(this),
                    display: 'line'
                },
                {
                    as: SUMMARY_METRIC_NAME_IDEAL_BURNDOWN,
                    f: this._getIdealBurndownForTick.bind(this),
                    display: 'line'
                }
            ]
        }

    });
}());