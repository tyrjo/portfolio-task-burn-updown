(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("SettingsUtils", {
        alias: "tssettingsutils",

        statics: {
            SETTING_NAME_SCOPE: 'portfolioItemScope',
            SETTING_NAME_RELEASE: 'release',
            SETTING_NAME_PORTFOLIO_ITEMS: 'portfolioItems',
            SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS: 'individual',
            SCOPE_RELEASE_PORTFOLIO_ITEMS: 'release',

            setPortfolioItems: function (portfolioItems) {
                var result = portfolioItems.map(function (item) {
                    return {
                        _ref: item._ref,
                        oid: Rally.util.Ref.getOidFromRef(item._ref),
                        PlannedStartDate: item.PlannedStartDate,
                        ActualStartDate: item.ActualStartDate,
                        PlannedEndDate: item.PlannedEndDate
                    }
                });

                result[this.SETTING_NAME_PORTFOLIO_ITEMS] = JSON.stringify(result);
                Rally.getApp().updateSettingsValues({
                    settings: result,
                });
                return result;
            },

            getPortfolioItems: function () {
                return JSON.parse(Rally.getApp().getSetting(this.SETTING_NAME_PORTFOLIO_ITEMS));
            },

            getRelease: function () {
                return Rally.getApp().getSetting(this.SETTING_NAME_RELEASE);
            },

            isReleaseScope: function () {
                return Rally.getApp().getSetting(SettingsUtils.SETTING_NAME_SCOPE) === SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS;
            },

            getSelectedRelease: function () {
                return Rally.util.Ref.getOidFromRef(SettingsUtils.getRelease());
            }
        }
    })
    ;
}());