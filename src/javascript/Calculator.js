Ext.define('com.ca.technicalservices.Burnupdown.Calculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
    config: {
        app: undefined
    },

    remainingIdealTodo: undefined,

    constructor: function (config) {
        this.initConfig(config);
        this.callParent(arguments);
        this._getCapacityForTick = this._getCapacityForTick.bind(this);
        this._getCapacityBurndownForTick = this._getCapacityBurndownForTick.bind(this);
    },

    _getCapacityForTick: function (snapshot, index, metric, seriesData) {
        var capacity = this.app.iterationData.getCapacityForDateString(snapshot.tick);
        return capacity;
    },

    _getCapacityBurndownForTick: function (snapshot, index, metric, seriesData) {
        var priorCapacity = 0;
        if (index > 0 && seriesData[index - 1]['Total Capacity']) {
            priorCapacity = seriesData[index - 1]['Total Capacity']
        }

        if (this.remainingIdealTodo === undefined) {
            if ( snapshot['To Do'] != undefined) {
                // Found the first To Do entry for this chart
                this.remainingIdealTodo = snapshot['To Do'];
            }
        } else {
            this.remainingIdealTodo = Math.max(this.remainingIdealTodo-priorCapacity, 0);
        }

        return this.remainingIdealTodo || 0;
    },

    getDerivedFieldsAfterSummary: function () {
        return [
            {
                as: 'Total Capacity',
                display: 'line',
                f: this._getCapacityForTick
            },
            {
                as: 'Ideal Capacity Based Burndown',
                display: 'line',
                f: this._getCapacityBurndownForTick
            }
        ]
    },

    getMetrics: function () {
        return [
            {
                field: "TaskRemainingTotal",
                as: "To Do",
                f: 'sum',
                display: 'column'
            },
            {
                field: "TaskActualTotal",
                as: "Actuals",
                f: 'sum',
                display: 'column'
            }
        ];
    },

    getProjectionsConfig: function () {
        return {
            limit: 1
        };
    }
});