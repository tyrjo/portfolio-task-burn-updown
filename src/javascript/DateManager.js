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
            getDateRange: _getDateRange
        };

        function _getDateRange(release, features) {
            var initialValue = Ext.create('com.ca.technicalservices.Burnupdown.DateRange');
            var result = _getDatesFromFeatures(features, initialValue);

            if (release) {
                // Merge release dates with the feature dates
                result = _getDatesFromRelease(release, result);
            }

            return result;
        }

        function _getDatesFromRelease(release, initialValue) {
            var plannedStartDate = release.get('ReleaseStartDate') ? Ext.Date.parse(release.get('ReleaseStartDate'), 'c') : undefined;
            var plannedEndDate = release.get('ReleaseDate') ? Ext.Date.parse(release.get('ReleaseDate'), 'c') : undefined;
            initialValue.addDates(plannedStartDate, undefined, plannedEndDate);
            return initialValue;
        }

        function _getDatesFromFeatures(features, initialValue) {
            var result = _.reduce(features, function (accumulator, feature) {
                var plannedStartDate = feature.get('PlannedStartDate') ? Ext.Date.parse(feature.get('PlannedStartDate'), 'c') : undefined;
                var actualStartDate = feature.get('ActualStartDate') ? Ext.Date.parse(feature.get('ActualStartDate'), 'c') : undefined;
                var plannedEndDate = feature.get('PlannedEndDate') ? Ext.Date.parse(feature.get('PlannedEndDate'), 'c') : undefined;

                accumulator.addDates(plannedStartDate, actualStartDate, plannedEndDate);

                return accumulator;
            }, initialValue);

            return result;
        }
    }());
}());