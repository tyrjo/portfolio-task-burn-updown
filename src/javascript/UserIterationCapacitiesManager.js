(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.UserIterationCapacitiesManager", function (IterationData) {

        var iterations = {};

        // capacities only used internally. Not exposed in config
        var userIterationCapacityFields = [
            'Capacity',
            'User',
            'Iteration',
            'StartDate',
            'EndDate'
        ];

        return {
            config: {
                workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            loadCapacitiesForDates: _loadCapacitiesForDates,
            getCapacitiesForDateString: _getCapacitiesForDateString
        };


        /**
         * Given a data store grouped by Iteration refs, extract the
         * iterations and the capacity sums
         * @param store
         */
        function _collectIterations(store) {
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
                iteration.dailyCapacity = Math.floor(iteration.capacity / _workingDayCount.call(this, iteration));

                iterations[iteration._ref] = iteration;
            }, this);
        }

        function _workingDayCount(iteration) {
            if (!iteration.StartDate || !iteration.EndDate) {
                // Unexpected, I don't think iterations can be missing these dates
                Ext.MessageBox.alert("Invalid Iteration", "Iteration " + iteration.Name + " missing StartDate or EndDate");
                return undefined;
            }

            var count = 0;
            var date = Ext.Date.parse(iteration.StartDate, 'c');
            var endDate = Ext.Date.parse(iteration.EndDate, 'c');
            while (date <= endDate) {
                var day = Ext.Date.format(date, 'l');
                if (_.contains(this.getWorkDays(), day)) {
                    count++;
                }
                date = Ext.Date.add(date, Ext.Date.DAY, 1);
            }
            return count;
        }

        function _getCapacitiesForDateString(dateString) {
            var date = Ext.Date.parse(dateString, 'c');
            var matchingIterations = _.filter(iterations, function (value) {
                return Ext.Date.between(date, value.StartDate, value.EndDate);
            });
            var result = _.reduce(
                matchingIterations,
                function (accumulator, value) {
                    accumulator.total += value.capacity;
                    accumulator.daily += value.dailyCapacity;
                    return accumulator;
                },
                {
                    total: 0,
                    daily: 0
                });
            return result;
        }

        function _loadCapacitiesForDates(startDate, endDate) {
            var deferred = Ext.create('Deft.Deferred');
            var filter = Rally.data.wsapi.Filter.and([
                {
                    property: 'Iteration.StartDate',
                    operator: '<',
                    value: endDate.toISOString()
                },
                {
                    property: 'Iteration.EndDate',
                    operator: '>',
                    value: startDate.toISOString()
                }
            ]);
            Ext.create('Rally.data.wsapi.Store', {
                autoLoad: true,
                model: 'UserIterationCapacity',
                limit: Infinity,
                context: {
                    projectScopeDown: true
                },
                fetch: userIterationCapacityFields,
                groupField: 'Iteration',    // Required, but ignored because of getGroupString
                getGroupString: function (instance) {
                    return instance.data.Iteration._ref;
                },
                filters: filter,
                listeners: {
                    scope: this,
                    load: function (store, data, success) {
                        if (!success) {
                            deferred.reject("Unable to load user iteration capacities for date range " +
                                startDate + " to " + endDate);
                        } else {
                            if (data.length < 1) {
                                console.warn("No user iteration capacities found");
                            }
                            _collectIterations.call(this, store);
                            deferred.resolve();
                        }
                    }
                }
            });
            return deferred.getPromise();
        }
    }());
}());