// TODO (tj) use Ext or _ for array functions
// TODO (tj) use Ext.Date.between for date checks

//TODO (tj) Next steps
/**
 * Manual tests
 * Select Theme with child Initiatives, Features and Stories
 * Select Initiative with child Features and Stories
 * Select Feature with child Stories
 * Select Portfolio Item with no direct children
 * Select Portfolio Item with no decendent Stories
 * Select Portfolio Items with mix of decendent Stories and no decendent
 *
 * What if no items returned for any expected item? Features, Iterations, Stories, etc...
 */

// TODO (tj) Possible optimizations
/**
 * If only 1 features, make todo and actual different colors
 * dash/dot the todo and actual lines
 * distinct colors for all lines (different from columns)
 * Start chart on actual start date
 */

Ext.define("com.ca.technicalservices.Burnupdown", {
    extend: 'Rally.app.TimeboxScopedApp',

    scopeType: 'release',

    requires: [
        'SettingsUtils',
        'com.ca.technicalservices.Burnupdown.FeatureManager',
        'com.ca.technicalservices.Burnupdown.StoriesManager',
        'com.ca.technicalservices.Burnupdown.UserIterationCapacitiesManager',
        'com.ca.technicalservices.Burnupdown.DateManager',
        'com.ca.technicalservices.Burnupdown.Calculator',
        'com.ca.technicalservices.Burnupdown.PortfolioItemPicker'
    ],

    listeners: {},

    iterationData: undefined,

    config: {
        defaultSettings: {
            portfolioItemPicker: ''
        }
    },

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
                app: Rally.getApp(),
                height: 350
            }
        ];
    },

    launch: function () {
        var features, stories, startDate, endDate, iterationCapacitiesManager;
        var featureManager = Ext.create('com.ca.technicalservices.Burnupdown.FeatureManager');
        featureManager.getFeatures()
            .then({
                scope: this,
                success: function (featuresData) {
                    features = featuresData;

                    var dateManager = Ext.create('com.ca.technicalservices.Burnupdown.DateManager');
                    var dateRange = dateManager.getDateRange(features);
                    startDate = dateRange.getEarliestStartDate();
                    endDate = dateRange.getLatestEndDate();

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
                    this.add({
                        xtype: 'rallychart',
                        storeType: 'Rally.data.lookback.SnapshotStore',
                        storeConfig: this._getStoreConfig(storyOids),
                        calculatorType: 'com.ca.technicalservices.Burnupdown.Calculator',
                        calculatorConfig: {
                            granularity: 'hour',
                            startDate: startDate,
                            endDate: endDate,
                            iterationCapacitiesManager: iterationCapacitiesManager,
                            features: features
                        },
                        chartConfig: this._getChartConfig()
                    });
                }
            })
            .otherwise({
                fn: function (msg) {
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
    _getChartConfig: function () {
        return {
            chart: {
                zoomType: 'xy'
            },
            title: {
                text: 'Portfolio Task Hours'
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
    }
});