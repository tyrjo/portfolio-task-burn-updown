(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.DateRange", function () {

        return {
            config: {
                earliestPlannedStartDate: undefined,
                earliestActualStartDate: undefined,
                latestPlannedEndDate: undefined
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },

            addDates: function (start, actual, end) {
                this.setEarliestPlannedStartDate(_earlierDate(start, this.earliestPlannedStartDate));
                this.setEarliestActualStartDate(_earlierDate(actual, this.earliestActualStartDate));
                this.setLatestPlannedEndDate(_laterDate(end, this.latestPlannedEndDate));
            },

            getStartDate: function () {
                var startDate;
                var actualStartDate = this.getEarliestActualStartDate();
                if (actualStartDate) {
                    startDate = actualStartDate;
                } else {
                    startDate = this.getEarliestPlannedStartDate() || new Date();
                }
                return startDate;
            },

            getEndDate: function () {
                return this.getLatestPlannedEndDate() || new Date();
            }
        };

        /*
         * Private functions
         */

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