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
 *
 * What if no items returned for any expected item? Features, Iterations, Stories, etc...
 */

// TODO (tj) Possible optimizations
/**
 * If only 1 features, make todo and actual different colors
 * dash/dot the todo and actual lines
 * distinct colors for all lines (different from columns)
 * Start chart on actual start date
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

    featureFields: [
        'ObjectID',
        'Name',
        'c_InitialHourEstimate',
        'PlannedStartDate',
        'ActualStartDate',
        'PlannedEndDate'
    ],

    userIterationCapacityFields: [
        'Capacity',
        'User',
        'Iteration',
        'StartDate',
        'EndDate'
    ],

    hierarchicalRequirementFields: [
        'Name',
        'TaskEstimateTotal',
        'TaskActualTotal',
        'TaskRemainingTotal',
        'Feature'
    ],

    releaseFields: [
        'ReleaseStartDate',
        'ReleaseDate',

    ],

    getSettingsFields: function () {
        return [
            {
                xtype: 'chartportfolioitempicker',
                app: Rally.getApp(),
                height: 350
            }
        ];
    },

    _getCurrentStories: function (features) {
        var deferred = Ext.create('Deft.Deferred');
        var featureOids = _.pluck(features, 'ObjectID');
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
            },
            {
                property: '_ItemHierarchy',
                operator: 'in',
                value: featureOids  // Filter out stories not in the selected features
            }
        ];

        var queryContext = this.getContext().getDataContext();
        queryContext.projectScopeDown = true;
        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            //context: queryContext,
            fetch: ['ObjectID', 'Iteration'],
            filters: filters,
            listeners: {
                load: function (store, data, success) {
                    if (!success || data.length < 1) {
                        deferred.reject("Unable to load user stories");
                    } else {
                        deferred.resolve(_.pluck(data, 'raw'));
                    }
                }
            },
        });

        return deferred.getPromise();
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
                // Get an object of just the fetched values
                return _.pluck(data, 'raw');
            }
        })

    },

    _getFeaturesFromRelease: function (release) {
        var deferred = Ext.create('Deft.Deferred');

        if (release) {
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
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load features from release " + release);
                        } else {
                            deferred.resolve(data);
                        }
                    }
                }
            });
        } else {
            deferred.reject("No release set");
        }
        return deferred.getPromise();
    },

    // Only works for feature PIs
    _getFeaturesFromPis: function (portfolioItems) {
        var deferred = Ext.create('Deft.Deferred');
        portfolioOids = _.map(portfolioItems, function (item) {
            return item.oid;
        });

        if (portfolioOids.length < 1) {
            deferred.reject("No portfolio items set");
        } else {
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
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load feature IDs " + portfolioOids);
                        } else {
                            deferred.resolve(data);
                        }
                    }
                }
            });
        }
        return deferred.getPromise();
    },


    // TODO (tj) move to IterationData
    _getIterations: function (oids) {
        var iterationData = Ext.create('com.ca.technicalservices.Burnupdown.IterationData');
        var deferred = Ext.create('Deft.Deferred');

        var iterationOids = _.filter(oids); // filter any blank ids
        if (iterationOids.length != oids.length) {
            console.warn("Iteration missing for at least one story snapshot.")
        }

        if (!iterationOids.length) {
            // No iterations specified, nothing to do
            deferred.reject("No iterations set");
        } else {
            var queries = iterationOids.map(function (oid) {
                return {
                    property: 'Iteration.ObjectID',
                    value: oid
                };
            });
            var filter = Rally.data.wsapi.Filter.or(queries);
            var dataContext = this.getContext().getDataContext();
            dataContext.projectScopeDown = true;
            Ext.create('Rally.data.wsapi.Store', {
                autoLoad: true,
                model: 'UserIterationCapacity',
                context: dataContext,
                fetch: this.userIterationCapacityFields,
                groupField: 'Iteration',    // Required, but ignored because of getGroupString
                getGroupString: function (instance) {
                    return instance.data.Iteration._ref;
                },
                filters: filter,
                listeners: {
                    scope: this,
                    load: function (store, data, success) {
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load user iteration capacities for iterations " + iterationOids);
                        } else {
                            iterationData.collectIterations(store);
                            deferred.resolve(iterationData);
                        }
                    }
                }
            });
        }

        return deferred.getPromise();
    },

    launch: function () {
        // TODO (tj) run stories and features calls in parallel if possible
        // TODO (tj) is there a way to use a single otherwise handler for errors with Deft?
        var features, stories, dates;

        this._getFeatures()
            .then({
                scope: this,
                success: function (featuresData) {
                    features = featuresData;
                    return this._getDates(features);
                }
            })
            .then({
                scope: this,
                success: function (datesData) {
                    dates = datesData;
                    return this._getCurrentStories(features);
                }
            })
            .then({
                scope: this,
                success: function (storiesData) {
                    stories = storiesData;
                    var iterationOids = _.pluck(_.unique(stories, 'Iteration'), 'Iteration');
                    return this._getIterations(iterationOids);
                }
            })
            .then({
                scope: this,
                success: function (iterationData) {
                    var storyOids = _.pluck(stories, 'ObjectID');

                    // Use the earliest actual start if there is one, otherwise use the earliest planned,
                    // otherwise fall back on today
                    var startDate;
                    if (dates.earliestActualStartDate) {
                        startDate = dates.earliestActualStartDate;
                    } else {
                        startDate = dates.earliestPlannedStartDate || new Date();
                    }

                    var endDate = dates.latestPlannedEndDate || new Date();

                    this.add({
                        xtype: 'rallychart',
                        storeType: 'Rally.data.lookback.SnapshotStore',
                        storeConfig: this._getStoreConfig(storyOids),
                        calculatorType: 'com.ca.technicalservices.Burnupdown.Calculator',
                        calculatorConfig: {
                            granularity: 'hour',
                            startDate: startDate,
                            endDate: endDate,
                            iterationData: iterationData,
                            features: features
                        },
                        chartConfig: this._getChartConfig()
                    });
                }
            })
            .otherwise({
                fn: function (msg) {
                    Ext.Msg.alert('Error', msg);
                }
            })
    },

    _getDates: function (features) {
        var result;
        var deferred = Ext.create('Deft.Deferred');
        var initialValue = {
            earliestPlannedStartDate: undefined,
            earliestActualStartDate: undefined,
            latestPlannedEndDate: undefined
        };

        var featureDates = this._getFeatureDates(features, initialValue);

        if (SettingsUtils.isReleaseScope()) {
            // Use release StartDate or Pis actual start dates and ReleaseDate
            result = this._getDatesFromRelease(SettingsUtils.getRelease(), featureDates);
        } else {
            result = Deft.promise.Promise.when(featureDates);
        }

        return result;
    },

    // TODO (tj) refactor to move date structure to an object
    _getDatesFromRelease: function (releaseRef, initialValue) {
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            autoLoad: true,
            model: 'Release',
            fetch: this.releaseFields,

            filters: [
                {
                    property: 'ObjectID',
                    value: Rally.util.Ref.getOidFromRef(releaseRef)
                }
            ],
            listeners: {
                scope: this,
                load: function (store, data, success) {
                    if (!success || data.length < 1) {
                        deferred.reject("Unable to load release " + releaseRef);
                    } else {
                        var result = initialValue;
                        var release = data[0];
                        result.earliestPlannedStartDate =
                            this._laterDate(release.get('ReleaseStartDate'), initialValue.earliestPlannedStartDate);
                        result.earliestActualStartDate =
                            this._laterDate(release.get('ReleaseStartDate'), initialValue.earliestActualStartDate);
                        result.latestPlannedEndDate =
                            this._laterDate(release.get('ReleaseDate'), initialValue.latestPlannedEndDate);
                        deferred.resolve(result);
                    }
                }
            }
        });

        return deferred.getPromise();
    },

    _getFeatureDates: function (features, initialValue) {
        var result = _.reduce(features, function (accumulator, feature) {
            var plannedStartDate = feature.PlannedStartDate ? Ext.Date.parse(feature.PlannedStartDate, 'c') : undefined;
            var actualStartDate = feature.ActualStartDate ? Ext.Date.parse(feature.ActualStartDate, 'c') : undefined;
            var plannedEndDate = feature.PlannedEndDate ? Ext.Date.parse(feature.PlannedEndDate, 'c') : undefined;

            accumulator.earliestPlannedStartDate = this._earlierDate(plannedStartDate, accumulator.earliestPlannedStartDate);
            accumulator.earliestActualStartDate = this._earlierDate(actualStartDate, accumulator.earliestActualStartDate);
            accumulator.latestPlannedEndDate = this._laterDate(plannedEndDate, accumulator.latestPlannedEndDate);

            return accumulator;

        }, initialValue, this);

        return result;
    },

    // TODO (tj) move to a utility function
    _earlierDate: function (d1, d2) {
        var result = d2;
        if (d1) {
            if (!d2 || (d1 < d2)) {
                result = d1;
            }
        }
        return result;
    },

    _laterDate: function (d1, d2) {
        var result = d2;
        if (d1) {
            if (!d2 || (d1 > d2)) {
                result = d1;
            }
        }
        return result;
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
                _ValidFrom: {'$lt': Rally.util.DateTime.toIsoString(new Date())}
            },
            fetch: this.hierarchicalRequirementFields,
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity,
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