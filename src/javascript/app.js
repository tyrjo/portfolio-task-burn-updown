Ext.define('Rally.example.CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
    config: {
        stateFieldName: 'ScheduleState',
        stateFieldValues: ['Defined', 'In-Progress', 'Completed', 'Accepted']
    },

    constructor: function (config) {
        this.initConfig(config);
        this.callParent(arguments);
    },

    getMetrics: function () {
        return _.map(this.getStateFieldValues(), function (stateFieldValue) {
            return {
                as: stateFieldValue,
                groupByField: this.getStateFieldName(),
                allowedValues: [stateFieldValue],
                f: 'groupByCount',
                display: 'area'
            };
        }, this);
    }
});

Ext.define("PTBUD", {
    extend: 'Rally.app.App',

    requires: [
        'Rally.example.CFDCalculator'
    ],

    launch: function () {
        this.add({
            xtype: 'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(),
            calculatorType: 'Rally.example.CFDCalculator',
            calculatorConfig: {
                stateFieldName: 'ScheduleState',
                stateFieldValues: ['Defined', 'In-Progress', 'Completed', 'Accepted']
            },
            chartConfig: this._getChartConfig()
        });
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function () {
        return {
            find: {
                _TypeHierarchy: { '$in': ['HierarchicalRequirement', 'Defect'] },
                Children: null,
                _ProjectHierarchy: this.getContext().getProject().ObjectID,
                _ValidFrom: { '$gt': Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 'day', -30)) }
            },
            fetch: ['ScheduleState'],
            hydrate: ['ScheduleState'],
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity
        };
    },

    /**
     * Generate a valid Highcharts configuration object to specify the chart
     */
    _getChartConfig: function () {
        return {
            chart: {
                zoomType: 'xy'
            },
            title: {
                text: 'Project Cumulative Flow'
            },
            xAxis: {
                tickmarkPlacement: 'on',
                tickInterval: 20,
                title: {
                    text: 'Date'
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Count'
                    }
                }
            ],
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                },
                area: {
                    stacking: 'normal'
                }
            }
        };
    }
});
