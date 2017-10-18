(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.IterationData", {
        alias: "tsiterationdata",

        config: {
            app: undefined
        },

        iterations: {},

        /**
         * Given a data store grouped by Iteration refs, extract the
         * iterations and the capacity sums
         * @param store
         */
        collectIterations: function (store) {
            var iterationGroups = store.getGroups();
            var capacityTotals = store.sum('Capacity', true);

            // Build a map of iteration refs to iteration objects that also contain
            // capacity data
            _.each(iterationGroups, function (group) {

                var iteration = _.clone(group.children[0].data.Iteration);

                // parse date data
                iteration.StartDate = Ext.Date.parse(iteration.StartDate, 'c');
                iteration.EndDate = Ext.Date.parse(iteration.EndDate, 'c');

                // add capacity data
                iteration.capacity = capacityTotals[iteration._ref];

                this.iterations[iteration._ref] = iteration;
            }, this);
        },

        getCapacityForDateString: function(dateString) {
            var date = Ext.Date.parse(dateString, 'c');
            var iteration = _.find(this.iterations, function(value) {
                if ( value.StartDate <= date &&
                    value.EndDate >= date ) {
                    return true;
                } else {
                    return false;
                }
            });

            return iteration ? iteration.capacity : 0;
        }
    });
}());