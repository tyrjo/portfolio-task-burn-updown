(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.FeatureManager", function () {

        return {
            config: {
                settingsUtils: {},
                featureFields: [
                    'ObjectID',
                    'Name',
                    'c_InitialHourEstimate',
                    'PlannedStartDate',
                    'ActualStartDate',
                    'PlannedEndDate',
                    'FormattedID'
                ]
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            getFeatures: _getFeatures
        };

        function _getFeatures(release) {
            var promise;
            if (release) {
                promise = _getFeaturesFromRelease.call(this, release);
            } else {
                promise = _getFeaturesFromPis.call(this, this.config.settingsUtils.getPortfolioItems());
            }
            return promise;
        }

        function _getFeaturesFromRelease(release) {
            var deferred = Ext.create('Deft.Deferred');

            if (release) {
                Ext.create('Rally.data.wsapi.Store', {
                    autoLoad: true,
                    model: 'PortfolioItem/Feature', // TODO (tj) might not need /Feature because only bottom PI can be associated with Release?
                    context: {
                      projectScopeUp: true
                    },
                    limit: Infinity,
                    fetch: this.getFeatureFields(),
                    filters: [
                        {
                            property: 'Release.Name',
                            value: release.get('Name')
                        },/*
                        Can't use these dates because the selected release might be from a different project that
                        uses different release dates for a release of the same name
                        {
                            property: 'Release.ReleaseStartDate',
                            value: release.ReleaseStartDate
                        },
                        {
                            property: 'Release.ReleaseDate',
                            value: release.ReleaseDate
                        }*/
                    ],
                    listeners: {
                        load: function (store, data, success) {
                            if (!success || data.length < 1) {
                                deferred.reject("No features found in release \"" + release.get('Name') + "\" in the current or parent projects.");
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
                    limit: Infinity,
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