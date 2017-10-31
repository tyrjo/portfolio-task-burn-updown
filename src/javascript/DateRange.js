(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.DateRange", function () {

        return {
            config: {
                earliestPlannedStartDate: undefined,
                earliestActualStartDate: undefined,
                latestPlannedEndDate: undefined
            },
            constructor: function(config) {
              this.initConfig(config);
              return this;
            }
        };
    }());
}());