(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.DateManager", function () {

        // releases are only used internally, so this is not needed in the config section
        var releaseFields = [
            'ReleaseStartDate',
            'ReleaseDate'

        ];

        return {
            config: {},
            require: [
                'com.ca.technicalservices.Burnupdown.DateRange'
            ],
            constructor: function(config) {
              this.initConfig(config);
              return this;
            },
            getDates: _getDates
        };

        function _getDates(features) {
            var result;

            var initialValue = Ext.create('com.ca.technicalservices.Burnupdown.DateRange');

            var featureDates = _getDatesFromFeatures(features, initialValue);

            if (SettingsUtils.isReleaseScope()) {
                // Use release StartDate or Pis actual start dates and ReleaseDate
                result = _getDatesFromRelease(SettingsUtils.getRelease(), featureDates);
            } else {
                result = Deft.promise.Promise.when(featureDates);
            }

            return result;
        }

        // TODO (tj) refactor to move date structure to an object
        function _getDatesFromRelease(releaseRef, initialValue) {
            var deferred = Ext.create('Deft.Deferred');

            Ext.create('Rally.data.wsapi.Store', {
                autoLoad: true,
                model: 'Release',
                fetch: releaseFields,

                filters: [
                    {
                        property: 'ObjectID',
                        value: Rally.util.Ref.getOidFromRef(releaseRef)
                    }
                ],
                listeners: {
                    load: function (store, data, success) {
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load release " + releaseRef);
                        } else {
                            var result = initialValue;
                            var release = data[0];
                            result.setEarliestPlannedStartDate(_laterDate(release.get('ReleaseStartDate'), initialValue.getEarliestPlannedStartDate()));
                            result.setEarliestActualStartDate(_laterDate(release.get('ReleaseStartDate'), initialValue.getEarliestActualStartDate()));
                            result.setLatestPlannedEndDate(_laterDate(release.get('ReleaseDate'), initialValue.getLatestPlannedEndDate()));
                            deferred.resolve(result);
                        }
                    }
                }
            });

            return deferred.getPromise();
        }

        function _getDatesFromFeatures(features, initialValue) {
            var result = _.reduce(features, function (accumulator, feature) {
                var plannedStartDate = feature.PlannedStartDate ? Ext.Date.parse(feature.PlannedStartDate, 'c') : undefined;
                var actualStartDate = feature.ActualStartDate ? Ext.Date.parse(feature.ActualStartDate, 'c') : undefined;
                var plannedEndDate = feature.PlannedEndDate ? Ext.Date.parse(feature.PlannedEndDate, 'c') : undefined;

                accumulator.setEarliestPlannedStartDate(_earlierDate(plannedStartDate, accumulator.getEarliestPlannedStartDate()));
                accumulator.setEarliestActualStartDate(_earlierDate(actualStartDate, accumulator.getEarliestActualStartDate()));
                accumulator.setLatestPlannedEndDate(_laterDate(plannedEndDate, accumulator.getLatestPlannedEndDate()));

                return accumulator;

            }, initialValue);

            return result;
        }

        function _earlierDate(d1, d2) {
            var result = d2;
            if (d1) {
                if (!d2 || (d1 < d2)) {
                    result = d1;
                }
            }
            return result;
        }

        function _laterDate(d1, d2) {
            var result = d2;
            if (d1) {
                if (!d2 || (d1 > d2)) {
                    result = d1;
                }
            }
            return result;
        }
    }());
}());