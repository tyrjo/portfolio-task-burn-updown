(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.FeatureManager", function () {

        return {
            config: {
                featureFields: [
                    'ObjectID',
                    'Name',
                    'c_InitialHourEstimate',
                    'PlannedStartDate',
                    'ActualStartDate',
                    'PlannedEndDate'
                ]
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            getFeatures: _getFeatures
        };

        function _getFeatures() {
            var promise;
            if (SettingsUtils.isReleaseScope()) {
                promise = _getFeaturesFromRelease.call(this, SettingsUtils.getRelease());
            } else {
                promise = _getFeaturesFromPis.call(this, SettingsUtils.getPortfolioItems());
            }
            return promise.then({
                success: function (data) {
                    // Get an object of just the fetched values
                    return _.pluck(data, 'raw');
                }
            })

        }

        function _getFeaturesFromRelease(release) {
            var deferred = Ext.create('Deft.Deferred');

            if (release) {
                var queryContext = Rally.getApp().getContext().getDataContext();
                queryContext.projectScopeUp = true; // TODO (tj) can just pass hash to merge
                queryContext.projectScopeDown = true;
                Ext.create('Rally.data.wsapi.Store', {
                    autoLoad: true,
                    model: 'PortfolioItem/Feature', // TODO (tj) might not need /Feature because only bottom PI can be associated with Release?
                    limit: Infinity,
                    context: queryContext,
                    fetch: this.getFeatureFields(),
                    filters: [
                        {
                            property: 'Release',    // TODO (tj) use Release.Name, etc
                            value: release
                        }
                    ],
                    listeners: {
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
        }

        // Only works for feature PIs
        function _getFeaturesFromPis(portfolioItems) {
            var deferred = Ext.create('Deft.Deferred');
            var portfolioOids = _.map(portfolioItems, function (item) {
                return item.oid;
            });

            if (portfolioOids.length < 1) {
                deferred.reject("No portfolio items set");
            } else {
                // User has selected individual portfolio items. Filter out features
                // not in those PIs
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

                Ext.create('Rally.data.lookback.SnapshotStore', {
                    autoLoad: true,
                    fetch: this.getFeatureFields(),
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
        }
    }());
}());