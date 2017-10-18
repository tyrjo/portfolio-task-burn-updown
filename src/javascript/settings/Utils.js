(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.settings.Utils", {
        alias: "tssettingsutils",

        setPortfolioItems: function (app, portfolioItems) {
            result = portfolioItems.map(function (item) {
                return {
                    _ref: item._ref,
                    oid: Rally.util.Ref.getOidFromRef(item._ref),
                    PlannedStartDate: item.PlannedStartDate,
                    ActualStartDate: item.ActualStartDate,
                    PlannedEndDate: item.PlannedEndDate
                }
            });

            result = {
                portfolioItems: JSON.stringify(result)
            };
            app.updateSettingsValues(result);
            return result;
        },

        getPortfolioItems: function (app) {
            return JSON.parse(app.getSetting('portfolioItems'));
        }
    });
}());