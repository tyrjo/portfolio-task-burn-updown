// TODO (tj) use Ext or _ for array functions
// TODO (tj) use Ext.Date.between for date checks

// TODO (tj) Possible optimizations
/**
 * If only 1 features, make todo and actual different colors
 * dash/dot the todo and actual lines
 * distinct colors for all lines (different from columns)
 */

Ext.define("com.ca.technicalservices.Burnupdown", {
    extend: 'Rally.app.App',
    componentCls: 'app',

    settingsUtils: undefined,

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

    layout: {
        type: 'vbox',
        align: 'stretch'
    },

    items: [
        {
            xtype: 'container',
            itemId: 'chartArea',
            layout: 'fit',
            flex: 4
        },
        {
            xtype: 'container',
            itemId: 'detailsArea',
            height: 200,
            layout: {
                type: 'hbox',
                align: 'stretch'
            },
            items: [
                {
                    xtype: 'form',
                    title: 'Metrics',
                    flex: 1,
                    layout: {
                        type: 'vbox',
                        align: 'left',
                    },
                    border: false,
                    items: [
                        {
                            xtype: 'component',
                            itemId: 'projectedDays',
                        }
                    ]
                },
                {
                    xtype: 'container',
                    width: 30
                },
                {
                    xtype: 'container',
                    itemId: 'controlsArea',
                    flex: 1,
                    layout: {
                        type: 'vbox',
                        align: 'stretch'
                    }
                }
            ]
        }
    ],


    hierarchicalRequirementFields: [
        'Name',
        'TaskEstimateTotal',
        'TaskActualTotal',
        'TaskRemainingTotal',
        'Feature'
    ],

    getSettingsFields: function () {
        return [
            {
                xtype: 'chartportfolioitempicker',
                settingsUtils: this.settingsUtils,
                height: 350
            }
        ];
    },

    addControls: function () {
        var settingsControls = Ext.create("com.ca.technicalservices.Burnupdown.PortfolioItemPicker", {
            settingsUtils: this.settingsUtils
        });
        var settingsForm = Ext.create("Ext.form.Panel", {
            xtype: 'form',
            title: 'Override Default Chart Settings',
            items: [
                settingsControls
            ],
            border: false,
            buttons: [{
                text: 'Update',
                scope: this,
                handler: function () {
                    // The getForm() method returns the Ext.form.Basic instance:
                    //var form = this.up('form').getForm();
                    settingsControls.getSubmitData();
                    this.down('#controlsArea').removeAll();
                    this.down('#chartArea').removeAll();
                    this.buildChart();
                }
            }]
        });
        this.down('#controlsArea').add(settingsForm);
    },

    launch: function () {
        this.settingsUtils = Ext.create('SettingsUtils');
        this.buildChart();
    },

    buildChart: function () {
        var promise;
        var release, features, stories, startDate, endDate, iterationCapacitiesManager;

        this.setLoading("Loading data ...");

        var releaseManager = Ext.create('com.ca.technicalservices.Burnupdown.ReleaseManager');
        if (this.settingsUtils.isReleaseScope()) {
            promise = releaseManager.getReleaseByName(this.settingsUtils.getRelease().Name)
        } else {
            promise = Deft.promise.Promise.when(undefined);
        }

        this.addControls();

        promise.then({
            scope: this,
            success: function (releaseData) {
                release = releaseData;
                var featureManager = Ext.create('com.ca.technicalservices.Burnupdown.FeatureManager', {
                    settingsUtils: this.settingsUtils
                });
                return featureManager.getFeatures(release);
            }
        })
            .then({
                scope: this,
                success: function (featuresData) {
                    features = featuresData;

                    var dateManager = Ext.create('com.ca.technicalservices.Burnupdown.DateManager');
                    var dateRange = dateManager.getDateRange(release, features);

                    startDate = dateRange.getStartDate();
                    endDate = dateRange.getEndDate();

                    var storiesManager = Ext.create('com.ca.technicalservices.Burnupdown.StoriesManager');
                    return storiesManager.getCurrentStories(features);
                }
            })
            .then({
                scope: this,
                success: function (storiesData) {
                    stories = storiesData;
                    iterationCapacitiesManager = Ext.create('com.ca.technicalservices.Burnupdown.UserIterationCapacitiesManager');
                    return iterationCapacitiesManager.loadCapacitiesForDates(startDate, endDate);
                }
            })
            .then({
                scope: this,
                success: function () {
                    var storyOids = _.pluck(stories, 'ObjectID');
                    var chart = this.down('#chartArea').add({
                        xtype: 'rallychart',
                        storeType: 'Rally.data.lookback.SnapshotStore',
                        storeConfig: this._getStoreConfig(storyOids),
                        calculatorType: 'com.ca.technicalservices.Burnupdown.Calculator',
                        calculatorConfig: {
                            granularity: 'hour',
                            startDate: startDate,
                            endDate: endDate,
                            iterationCapacitiesManager: iterationCapacitiesManager,
                            features: features,
                            updateProjectedDoneDateCallback: this._updateProjectedDoneDate.bind(this)
                        },
                        chartConfig: this._getChartConfig(this._getChartTitle(release, features)),
                        loadMask: false,
                        listeners: {
                            scope: this,
                            readyToRender: function () {
                                this.setLoading(false);
                            }
                        }
                    });
                    chart.setLoadMask(false);   // Hide chart default load mask
                }
            })
            .otherwise({
                scope: this,
                fn: function (msg) {
                    this.setLoading(false);
                    Ext.Msg.alert('Error', msg);
                }
            })
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function (storyOids) {
        return {
            findConfig: {
                _TypeHierarchy: {'$in': ['HierarchicalRequirement']},
                Children: null,
                ObjectID: {'$in': storyOids},
                _ValidFrom: {'$lt': Rally.util.DateTime.toIsoString(new Date())}
            },
            fetch: this.hierarchicalRequirementFields,
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity
        };
    },

    /**
     * Generate a valid Highcharts configuration object to specify the chart
     */
    _getChartConfig: function (title) {
        return {
            chart: {
                zoomType: 'xy'
            },
            title: {
                text: title
            },
            xAxis: {
                tickmarkPlacement: 'on',
                tickInterval: 30,
                title: {
                    text: 'Date'
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Hours'
                    }
                }
            ],
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                },
                column: {
                    stacking: 'normal'
                }
            }
        };
    },

    _getChartTitle: function (release, features) {
        var result;
        if (this.settingsUtils.isReleaseScope()) {
            result = 'Release: ' + release.get('Name');
        } else {
            result = 'Features: ' + _.map(features, function (feature) {
                return feature.get('FormattedID');
            }).join(', ');
        }
        return result;
    },

    _updateProjectedDoneDate: function (currentCapacity, currentTodo) {
        var remainingDays = 'Unknown';
        if (currentTodo == 0) {
            remainingDays = 'None';
        } else if (currentCapacity > 0) {
            remainingDays = Math.ceil(currentTodo / currentCapacity);
        }
        this.down('#projectedDays').update('Projected Work Days Until Done: ' + remainingDays);
    }
});