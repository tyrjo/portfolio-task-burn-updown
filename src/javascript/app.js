Ext.define('Rally.example.CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

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
    }
});

// TODO (tj) more verbose app class
Ext.define("PTBUD", {
    extend: 'Rally.app.App',

    requires: [
        'Rally.example.CFDCalculator'
    ],

    listeners: {},

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

    getSettingsFields: function () {
        var self = this;
        return [
            {
                xtype: 'container',
                layout: {
                    type: 'vbox'
                },
                minHeight: 350,
                items: [
                    Ext.create('widget.chartportfolioitempicker')
                ]
            }
        ];
    },

    _getCurrentStories: function () {
        var deferred = Ext.create('Deft.Deferred');
        var itemOids = this._getPortfolioItems();
        Ext.create('Rally.data.lookback.SnapshotStore', {
            listeners: {
                load: function (store, data, success) {
                    if (!success) {
                        deferred.reject("Unable to load user stories");
                    }

                    deferred.resolve(data.map(function (story) {
                        return story.get('ObjectID');
                    }))
                }
            },
            autoLoad: true,
            fetch: ['ObjectID'],
            filters: [
                {
                    property: '_ItemHierarchy',
                    operator: 'in',
                    value: itemOids
                },
                {
                    property: '_TypeHierarchy',
                    value: 'HierarchicalRequirement'
                },
                {
                    property: 'Children',
                    value: null
                },
                {
                    property: '__At',
                    value: 'current'
                }
            ]
        });

        return deferred.promise;
    },

    launch: function () {

        this._getCurrentStories().then({
            scope: this,
            success: function (oids) {
                this.add({
                    xtype: 'rallychart',
                    storeType: 'Rally.data.lookback.SnapshotStore',
                    storeConfig: this._getStoreConfig(oids),
                    calculatorType: 'Rally.example.CFDCalculator',
                    calculatorConfig: {
                        granularity: 'hour'
                    },
                    chartConfig: this._getChartConfig()
                });
            },
            failure: function (msg) {
                Ext.Msg.alert(msg);
            }
        });
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function (oids) {
        return {
            find: {
                _TypeHierarchy: {'$in': ['HierarchicalRequirement']},
                Children: null,
                ObjectID: {'$in': oids},
                //_ItemHierarchy: {'$in': this._getPortfolioItems()},
                //_ValidFrom: { '$gt': Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 'day', -30)) }
                _ValidFrom: {'$lt': Rally.util.DateTime.toIsoString(new Date())}
            },
            fetch: ['Name', 'TaskEstimateTotal', 'TaskActualTotal', 'TaskRemainingTotal'],
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity,
        };
    },

    _getPortfolioItems: function () {
        var refs = this.getSetting('portfolioItemPicker').split(',');
        return refs.map(function (ref) {
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
