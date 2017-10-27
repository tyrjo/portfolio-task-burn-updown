// TODO (tj) use Ext or _ for array functions
// TODO (tj) use Ext.Date.between for date checks

//TODO (tj) Next steps
/**
 * Manual tests
 * Select Theme with child Initiatives, Features and Stories
 * Select Initiative with child Features and Stories
 * Select Feature with child Stories
 * Select Portfolio Item with no direct children
 * Select Portfolio Item with no decendent Stories
 * Select Portfolio Items with mix of decendent Stories and no decendent
 */

Ext.define("com.ca.technicalservices.Burnupdown", {
    extend: 'Rally.app.TimeboxScopedApp',

    scopeType: 'release',

    requires: [
        'SettingsUtils',
        'com.ca.technicalservices.Burnupdown.IterationData',
        'com.ca.technicalservices.Burnupdown.Calculator',
        'com.ca.technicalservices.Burnupdown.PortfolioItemPicker'
    ],

    listeners: {},

    iterationData: undefined,

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

    featureFields: ['ObjectID', 'Name', 'c_InitialHourEstimate'],

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
        var filters = [
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
        ];

        if (SettingsUtils.isReleaseScope()) {
            // User has selected a release. Filter out stories not in that release.
            filters.push({
                property: 'Release',
                value: SettingsUtils.getSelectedRelease()
            });
        } else {
            // User has selected individual portfolio items. Filter out stories
            // not in those PIs
            var itemOids = this._getPortfolioItems().map(function (item) {
                return item.oid;
            });
            filters.push({
                property: '_ItemHierarchy',
                operator: 'in',
                value: itemOids
            });
        }
        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            fetch: ['ObjectID', 'Iteration'],
            filters: filters,
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

    _getFeatures: function () {
        var promise;
        if (SettingsUtils.isReleaseScope()) {
            promise = this._getFeaturesFromRelease(SettingsUtils.getRelease());
        } else {
            promise = this._getFeaturesFromPis(SettingsUtils.getPortfolioItems());
        }
        return promise.then({
            scope: this,
            success: function (data) {
                return _.map(data, function (item) {
                    return item.raw;
                });
            },
            failure: function (msg) {
                Ext.Msg.alert(msg);
            }
        })

    },

    _getFeaturesFromRelease: function (release) {
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store', {
            autoLoad: true,
            model: 'PortfolioItem/Feature',
            fetch: this.featureFields,
            filters: [
                {
                    property: 'Release',
                    value: release
                }
            ],
            listeners: {
                scope: this,
                load: function (store, data, success) {
                    if (!success) {
                        deferred.reject("Unable to load features");
                    }

                    deferred.resolve(data);
                }
            }
        });
        return deferred.promise;
    },

    // Only works for feature PIs
    _getFeaturesFromPis: function (portfolioItems) {
        portfolioOids = _.map(portfolioItems, function (item) {
            return item.oid;
        });
        var deferred = Ext.create('Deft.Deferred');
        var oidsFilter = Rally.data.wsapi.Filter.or(_.map(portfolioOids, function (oid) {
            return {
                property: 'ObjectID',
                value: oid
            }
        }));
        var childFilter = Rally.data.wsapi.Filter.or(_.map(portfolioOids, function (oid) {
            return {
                property: 'Parent',
                value: oid
            }
        }));
        var filters = [
            {
                property: '_TypeHierarchy',
                value: 'PortfolioItem/Feature'
            },
            {
                property: '__At',
                value: 'current'
            },
            {
                property: '_ItemHierarchy',
                operator: 'in',
                value: portfolioOids
            }
        ];

        // User has selected individual portfolio items. Filter out features
        // not in those PIs

        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            fetch: this.featureFields,
            filters: filters,
            listeners: {
                load: function (store, data, success) {
                    if (!success) {
                        deferred.reject("Unable to load features");
                    }

                    deferred.resolve(data);
                }
            },
        });
        return deferred.promise;
    },


    // TODO (tj) move to IterationData
    _getIterations: function (oids) {
        var iterationData = Ext.create('com.ca.technicalservices.Burnupdown.IterationData');
        var deferred = Ext.create('Deft.Deferred');
        if (!oids || !oids.length) {
            // No iterations specified, nothing to do
            deferred.resolve(iterationData);
        } else {
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
                        iterationData.collectIterations(store);
                        deferred.resolve(iterationData);
                    }
                }
            });
        }

        return deferred.promise;
    },

    launch: function () {
        // TODO (tj) run stories and features calls in parallel if possible
        var features, stories;

        this._getFeatures().then({
            scope: this,
            success: function (featuresData) {
                features = featuresData;
                return this._getCurrentStories();
            }
        }).then({
            scope: this,
            success: function (storiesData) {
                stories = storiesData;
                var iterationOids = stories.map(function (story) {
                    return story.get('Iteration');
                });
                return this._getIterations(iterationOids);
            },
            failure: function (msg) {
                Ext.Msg.alert(msg);
            }
        }).then({
            scope: this,
            success: function (iterationData) {
                var storyOids = stories.map(function (story) {
                    return story.get('ObjectID');
                });
                this.add({
                    xtype: 'rallychart',
                    storeType: 'Rally.data.lookback.SnapshotStore',
                    storeConfig: this._getStoreConfig(storyOids),
                    calculatorType: 'com.ca.technicalservices.Burnupdown.Calculator',
                    calculatorConfig: {
                        granularity: 'hour',
                        startDate: this._getEarliestStartDate(),
                        endDate: this._getLatestEndDate(),
                        iterationData: iterationData,
                        features: features
                    },
                    chartConfig: this._getChartConfig()
                });
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
            fetch: ['Name', 'TaskEstimateTotal', 'TaskActualTotal', 'TaskRemainingTotal', 'Feature'],
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
            items = SettingsUtils.getPortfolioItems();
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
                column: {
                    stacking: 'normal'
                }
            }
        };
    }
});