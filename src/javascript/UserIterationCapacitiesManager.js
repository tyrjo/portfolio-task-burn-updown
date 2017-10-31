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
            constructor: function(config) {
              this.initConfig(config);
              return this;
            },
            loadCapacitiesForIterations: _loadCapacitiesForIterations,
            getCapacitiesForDateString: _getCapacitiesForDateString,
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
                iteration.dailyCapacity = iteration.capacity / _workingDayCount.call(this, iteration);

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
            var iteration = _.find(iterations, function (value) {
                if (Ext.Date.between(date, value.StartDate, value.EndDate)) {
                    return true;
                } else {
                    return false;
                }
            });

            return iteration ? {
                total: iteration.capacity,
                daily: iteration.dailyCapacity
            } : {
                total: 0,
                daily: 0
            };
        }

        function _loadCapacitiesForIterations(oids) {
            var deferred = Ext.create('Deft.Deferred');
            var iterationOids = _.filter(oids); // filter any blank ids
            if (iterationOids.length !== oids.length) {
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
                var dataContext = Rally.getApp().getContext().getDataContext();
                dataContext.projectScopeDown = true;
                Ext.create('Rally.data.wsapi.Store', {
                    autoLoad: true,
                    model: 'UserIterationCapacity',
                    context: dataContext,
                    fetch: userIterationCapacityFields,
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
                                _collectIterations.call(this, store);
                                deferred.resolve();
                            }
                        }
                    }
                });
            }
            return deferred.getPromise();
        }
    }());
}());