(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.ReleaseManager", function () {

        return {
            config: {
                releaseFields: [
                    'ObjectID',
                    'Name',
                    'ReleaseStartDate',
                    'ReleaseDate'
                ]
            },
            constructor: function (config) {
                this.initConfig(config);
                return this;
            },
            getReleaseByName: _getReleaseByName
        };

        function _getReleaseByName(name) {
            var deferred = Ext.create('Deft.Deferred');

            if (name) {
                Ext.create('Rally.data.wsapi.Store', {
                    autoLoad: true,
                    model: 'Release',
                    context: {
                        projectScopeUp: false,
                        projectScopeDown: false
                    },
                    limit: 1,
                    fetch: this.getReleaseFields(),
                    filters: [
                        {
                            property: 'Name',
                            value: name
                        } /*
                        {
                            property: 'ReleaseStartDate',
                            value: release.ReleaseStartDate
                        },
                        {
                            property: 'ReleaseDate',
                            value: release.ReleaseDate
                        }*/
                    ],
                    listeners: {
                        load: function (store, data, success) {
                            if (!success || data.length < 1) {
                                deferred.reject("Unable to load release \"" + name + "\" for the current project.");
                            } else {
                                deferred.resolve(data[0]);
                            }
                        }
                    }
                });
            } else {
                deferred.reject("No release set");
            }
            return deferred.getPromise();
        }

    }());
}());