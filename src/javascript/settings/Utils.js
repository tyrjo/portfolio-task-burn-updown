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

            createPortfolioItemsSettings: function (portfolioItems) {
                var result = {};
                var piSettings = portfolioItems.map(function (item) {
                    return {
                        _ref: item._ref,
                        oid: Rally.util.Ref.getOidFromRef(item._ref),
                        PlannedStartDate: item.PlannedStartDate,
                        ActualStartDate: item.ActualStartDate,
                        PlannedEndDate: item.PlannedEndDate
                    }
                });

                result[this.SETTING_NAME_PORTFOLIO_ITEMS] = JSON.stringify(piSettings);
                return result;
            },

            createReleaseSettings: function (release) {
                var result = {};
                var releaseSettings = {};
                if (release) {
                    releaseSettings = {
                        _ref: release.get('_ref'),
                        ObjectID: Rally.util.Ref.getOidFromRef(release.get('_ref')),
                        Name: release.get('Name'),
                        ReleaseStartDate: release.get('ReleaseStartDate'),
                        ReleaseDate: release.get('ReleaseDate')
                    };
                }
                result[this.SETTING_NAME_RELEASE] = JSON.stringify(releaseSettings);
                return result;
            },

            getPortfolioItems: function () {
                var piSetting = Rally.getApp().getSetting(this.SETTING_NAME_PORTFOLIO_ITEMS) || '[]';
                var result;
                try {
                    result = JSON.parse(piSetting);
                } catch (e) {
                    //ignored
                }
                return result;
            },

            getRelease: function () {
                var releaseSetting = Rally.getApp().getSetting(this.SETTING_NAME_RELEASE) || '{}';
                var result;
                try {
                    result = JSON.parse(releaseSetting);
                } catch (e) {
                    //ignored
                }
                return result;
            },

            getScope: function () {
                return Rally.getApp().getSetting(this.SETTING_NAME_SCOPE);
            },

            isReleaseScope: function () {
                return Rally.getApp().getSetting(SettingsUtils.SETTING_NAME_SCOPE) === SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS;
            }
        }
    })
    ;
}());