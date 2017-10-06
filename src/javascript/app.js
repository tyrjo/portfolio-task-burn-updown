const MY_PROJECT_ID = 161729654772;

Ext.define('Rally.example.CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
    config: {
        // stateFieldName: 'ScheduleState',
        // stateFieldValues: ['Defined', 'In-Progress', 'Completed', 'Accepted'],

    },

    constructor: function (config) {
        this.initConfig(config);
        this.callParent(arguments);
    },

    getMetrics: function () {
        return [
            {
                field: "TaskRemainingTotal",
                as: "To Do",
                f: 'sum',
                display: 'column'
            },
            {
                field: "TaskActualTotal",
                as: "Actuals",
                f: 'sum',
                display: 'column'
            }
        ];
        /*
        return _.map(this.getStateFieldValues(), function (stateFieldValue) {
            return {
                as: stateFieldValue,
                groupByField: this.getStateFieldName(),
                allowedValues: [stateFieldValue],
                f: 'groupByCount',
                display: 'column'
            };
        }, this);
        */
    }
});

Ext.define("PTBUD", {
    extend: 'Rally.app.App',

    requires: [
        'Rally.example.CFDCalculator'
    ],

    listeners: {

    },

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

    getSettingsFields: function () {
        return this.chartSettings && this.chartSettings.getSettingsConfiguration();
    },

    launch: function () {
        this.add({
            xtype: 'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(),
            calculatorType: 'Rally.example.CFDCalculator',
            calculatorConfig: {
                // stateFieldName: 'ScheduleState',
                // stateFieldValues: ['Defined', 'In-Progress', 'Completed', 'Accepted'],
                granularity: 'hour'
            },
            chartConfig: this._getChartConfig()
        });
        console.log(this.getSettings());
        this._setupChartSettings();
    },

    _setupChartSettings: function () {
        this.chartSettings = Ext.create("Rally.apps.charts.rpm.ChartSettings", {
            app: this
        });
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function () {
        console.log(this._getPortfolioItems());
        return {
            find: {
                _TypeHierarchy: {'$in': ['HierarchicalRequirement']},
                Children: null,
                _ItemHierarchy: {'$in' : this._getPortfolioItems()},
                //_ValidFrom: { '$gt': Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 'day', -30)) }
                _ValidFrom: {'$lt': Rally.util.DateTime.toIsoString(new Date())}
            },
            fetch: ['Name', 'TaskEstimateTotal', 'TaskActualTotal', 'TaskRemainingTotal'],
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity,
            listeners: {
                load: function (store, records) {
                    console.log(records);
                }
            }
        };
    },

    _getPortfolioItems: function() {
        var refs = this.getSetting('portfolioItemPicker').split(',');
        return refs.map( function(ref) {
           return Rally.util.Ref.getOidFromRef(ref);
        });
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
                text: 'Portfolio Task Hours'
            },
            xAxis: {
                tickmarkPlacement: 'on',
                tickInterval: 1,
                title: {
                    text: 'Date'
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Hours'
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

/*
Ext.define("PTBUD", {
    extend: 'Rally.app.App',

    launch: function() {
        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['Name', 'Project', 'Actuals'],
            autoLoad: true,
            filters: [
                {
                    property: '_TypeHierarchy', 
                    value: 'Task'
                },
                {
                    property: 'Actuals',
                    operator: '>',
                    value: 0 
                },
                {
                    property: 'Project',
                    operator: '=',
                    value: PROJECT_ID
                },
            ],
            listeners: {
                load: function(store, records) {
                    console.log(records);
                }
            }
        });
    }
});
*/
