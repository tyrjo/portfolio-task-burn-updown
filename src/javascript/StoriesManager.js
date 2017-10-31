(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.StoriesManager", function () {

        return {
            config: {
                storiesFields: ['ObjectID', 'Iteration']
            },
            constructor: function(config) {
              this.initConfig(config);
              return this;
            },
            getCurrentStories: _getCurrentStories
        };

        function _getCurrentStories(features) {
            var deferred = Ext.create('Deft.Deferred');
            var featureOids = _.pluck(features, 'ObjectID');
            var filters = [
                {
                    property: '_TypeHierarchy',
                    value: 'HierarchicalRequirement'
                },
                {
                    property: 'Children',
                    value: null
                },
                {
                    property: '__At',
                    value: 'current'
                },
                {
                    property: '_ItemHierarchy',
                    operator: 'in',
                    value: featureOids  // Filter out stories not in the selected features
                }
            ];

            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad: true,
                fetch: this.getStoriesFields(),
                filters: filters,
                listeners: {
                    load: function (store, data, success) {
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load user stories");
                        } else {
                            deferred.resolve(_.pluck(data, 'raw'));
                        }
                    }
                }
            });

            return deferred.getPromise();
        }
    }());
}());