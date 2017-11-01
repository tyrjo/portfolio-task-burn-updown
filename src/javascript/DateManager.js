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
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            getDates: _getDates
        };

        function _getDates(features) {
            var initialValue = Ext.create('com.ca.technicalservices.Burnupdown.DateRange');
            var result = _getDatesFromFeatures(features, initialValue);

            if (SettingsUtils.isReleaseScope()) {
                // Merge release dates with the feature dates
                result = _getDatesFromRelease(SettingsUtils.getRelease(), result);
            }

            return result;
        }

        function _getDatesFromRelease(release, initialValue) {
            var result = initialValue;
            result.setEarliestPlannedStartDate(_laterDate(release.ReleaseStartDate, initialValue.getEarliestPlannedStartDate()));
            result.setEarliestActualStartDate(_laterDate(release.ReleaseStartDate, initialValue.getEarliestActualStartDate()));
            result.setLatestPlannedEndDate(_laterDate(release.ReleaseDate, initialValue.getLatestPlannedEndDate()));
            return result;
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