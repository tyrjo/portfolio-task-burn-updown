// TODO (tj) use Ext or _ for array functions
// TODO (tj) use Ext.Date.between for date checks

//TODO (tj) Next steps
/**
 * - convert the app to be a regular app
 * - use onTimeboxScopeChange to detect page level scope changes
 * - change settings to have a toggle
 * -- use page / dashboard level scope
 * -- select PIs (these PIs are not prepopulated from page level scope
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

    onScopeChange: function (scope) {
        // Get Portfolio Items in the release
        Ext.create("Rally.data.wsapi.Store", {
            model: "PortfolioItem/Feature",
            filters: [scope.getQueryFilter()],
            context: this.getContext().getDataContext(),
            autoLoad: true,
            fetch: ['ObjectID', 'Name', 'ActualStartDate', 'PlannedStartDate', 'ActualEndDate', 'PlannedEndDate'],
            listeners: {
                scope: this,
                load: function (store, records, successful, eOpts) {
                    console.log(records);
                    var portfolioItems = records.map(function (record) {
                        return record.raw;
                    });
                    //var piSettings = this.settingsUtils.setPortfolioItems(this, portfolioItems);
                    //this.launch();
                }
            }
        });
    },

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
        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            fetch: ['ObjectID', 'Iteration'],
            filters: this._getLookbackFilters(),
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

    _getLookbackFilters: function () {
        var filters = [
            /*
            {
                property: '_ItemHierarchy',
                operator: 'in',
                value: itemOids
            },
            */
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

        if (this._isReleaseScope()) {
            // User has selected a release. Filter out stories not in that release.
            filters.push({
                property: 'Release',
                value: this._getSelectedRelease()
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
        return filters;
    },

    _isReleaseScope: function () {
        return this.getSetting(SettingsUtils.SETTING_NAME_SCOPE) === SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS;
    },

    _getSelectedRelease: function () {
      return Rally.util.Ref.getOidFromRef(SettingsUtils.getRelease());
    },

    // TODO (tj) move to IterationData
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

                    this.iterationData.collectIterations(store);

                    deferred.resolve(data.map(function (story) {
                        return story.get('ObjectID');
                    }))
                }
            }
        });

        return deferred.promise;
    },

    launch: function () {
        this.iterationData = Ext.create('com.ca.technicalservices.Burnupdown.IterationData');
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
                    calculatorType: 'com.ca.technicalservices.Burnupdown.Calculator',
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
                area: {
                    stacking: 'normal'
                }
            }
        };
    }
});