(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.StoriesManager", function () {

        return {
            config: {
                storiesFields: ['ObjectID', 'Iteration', 'Project']
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            getCurrentStories: _getCurrentStories
        };

        function _getCurrentStories(features) {
            var deferred = Ext.create('Deft.Deferred');
            var featureOids = _.map(features, function(feature){
                return feature.get('ObjectID');
            });
            var dataContext = Rally.getApp().getContext().getDataContext();
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
                },
                {
                    property: '_ProjectHierarchy',
                    value: Rally.util.Ref.getOidFromRef(dataContext.project) // Filter out stories that don't belong to current project or its children
                }
            ];

            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad: true,
                fetch: this.getStoriesFields(),
                filters: filters,
                limit: Infinity,
                listeners: {
                    load: function (store, data, success) {
                        if (!success || data.length < 1) {
                            deferred.reject("Unable to load user stories for the selected features");
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