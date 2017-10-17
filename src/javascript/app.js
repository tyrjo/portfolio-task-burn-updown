Ext.define('Rally.example.CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
    config: {
        app: undefined
    },

    constructor: function (config) {
        this.initConfig(config);
        this.callParent(arguments);
        this._getCapacityForTick = this._getCapacityForTick.bind(this);
    },

    _getCapacityForTick: function (snapshot, index, metric, seriesData) {
        console.log(this);
        var date = Ext.Date.parse(snapshot.tick, 'c');
        this.app.iterations.find(function(element){
            // TODO (tj) avoid the repeated date parsing
            if ( date >= Ext.Date.parse(element.StartDate, 'c') &&
                 date <= Ext.Date.parse(element.EndDate, 'c')) {
                return true;
            } else {
                return false;
            }
        }, this);
    },

    getDerivedFieldsAfterSummary: function() {
        return [
            {
                as: 'Total Capacity',
                display: 'line',
                f: this._getCapacityForTick
            }
        ]
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
        'Rally.example.CFDCalculator',
        'Rally.apps.charts.settings.PortfolioItemPicker'
    ],

    listeners: {},

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

    iterations: [],
    iterationCapacityTotals: {},

    getSettingsFields: function () {
        return [
            {
                xtype: 'chartportfolioitempicker',
                app: Rally.getApp(),
                height: 350
            }
        ];
    },

    _getCurrentStories: function () {
        var deferred = Ext.create('Deft.Deferred');
        var itemOids = this._getPortfolioItems().map(function (item) {
            return item.oid;
        });
        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            fetch: ['ObjectID', 'Iteration'],
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
            ],
            listeners: {
                load: function (store, data, success) {
                    if (!success) {
                        deferred.reject("Unable to load user stories");
                    }

                    deferred.resolve(data);
                }
            },
        });

        return deferred.promise;
    },

    _getIterations: function (oids) {
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store', {
            autoLoad: true,
            model: 'UserIterationCapacity',
            fetch: ['Capacity', 'User', 'Iteration', 'StartDate', 'EndDate'],
            groupField: 'Iteration',    // Required, but ignored because of getGroupString
            getGroupString: function (instance) {
                return instance.data.Iteration._ref;
            },
            filters: Rally.data.wsapi.Filter.or(oids
                .filter(function (oid) {
                    return oid;
                })
                .map(function (oid) {
                    return {
                        property: 'Iteration.ObjectID',
                        value: oid
                    }
                })),
            listeners: {
                scope: this,
                load: function (store, data, success) {
                    if (!success) {
                        deferred.reject("Unable to load iterations");
                    }
                    var iterationGroups = store.getGroups();
                    this.iterations = [];
                    iterationGroups.each(function(group){
                        this.iterations.push(group.children[0].data.Iteration);
                    });

                    this.iterationCapacityTotals = store.sum('Capacity', true);
                    deferred.resolve(data.map(function (story) {
                        return story.get('ObjectID');
                    }))
                }
            }
        });

        return deferred.promise;
    },

    launch: function () {

        this._getCurrentStories().then({
            scope: this,
            success: function (stories) {
                var oids = stories.map(function (story) {
                    return story.get('ObjectID');
                });
                var iterationOids = stories.map(function (story) {
                    return story.get('Iteration');
                });
                this.add({
                    xtype: 'rallychart',
                    storeType: 'Rally.data.lookback.SnapshotStore',
                    storeConfig: this._getStoreConfig(oids),
                    calculatorType: 'Rally.example.CFDCalculator',
                    calculatorConfig: {
                        granularity: 'hour',
                        startDate: this._getEarliestStartDate(),
                        endDate: this._getLatestEndDate(),
                        app: this
                    },
                    chartConfig: this._getChartConfig()
                });
                this._getIterations(iterationOids);
            },
            failure: function (msg) {
                Ext.Msg.alert(msg);
            }
        });
    },

    // TODO (tj) Unit tests
    _getEarliestStartDate: function () {
        var date = this._getPortfolioItems().reduce(function (accumulator, currentValue) {
            var currentPlannedStartDate = currentValue.PlannedStartDate ? Ext.Date.parse(currentValue.PlannedStartDate, 'c') : new Date();
            var currentActualStartDate = currentValue.ActualStartDate ? Ext.Date.parse(currentValue.ActualStartDate, 'c') : new Date();
            var earliestDate = (currentActualStartDate < currentPlannedStartDate) ? currentActualStartDate : currentPlannedStartDate;

            if (accumulator && accumulator < earliestDate) {
                earliestDate = accumulator;
            }

            return earliestDate;

        }, null);
        return date;
    },

    // TODO (tj) Unit tests
    _getLatestEndDate: function () {
        var date = this._getPortfolioItems().reduce(function (accumulator, currentValue) {
            var latestDate = currentValue.PlannedEndDate ? Ext.Date.parse(currentValue.PlannedEndDate, 'c') : new Date();

            if (accumulator && accumulator > latestDate) {
                latestDate = accumulator;
            }

            return latestDate;

        }, null);
        return date;
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function (oids) {
        return {
            findConfig: {
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
        var items = [];
        try {
            items = JSON.parse(this.getSetting('portfolioItems'));
        } catch (e) {
            // ignore failures
        }
        return items;
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
                tickInterval: 30,
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