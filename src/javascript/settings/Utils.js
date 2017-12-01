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
        },

        localSettings: undefined,

        constructor: function() {
          this.localSettings = Rally.getApp().getSettings();
        },

        getSetting: function (key) {
            return this.localSettings[key];
        },

        createPortfolioItemsSettings: function (portfolioItems) {
            var piSettings = portfolioItems.map(function (item) {
                return {
                    _ref: item._ref,
                    FormattedID: item.FormattedID,
                    oid: Rally.util.Ref.getOidFromRef(item._ref),
                    PlannedStartDate: item.PlannedStartDate,
                    ActualStartDate: item.ActualStartDate,
                    PlannedEndDate: item.PlannedEndDate
                }
            });
            this.localSettings[SettingsUtils.SETTING_NAME_SCOPE] = SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS;
            this.localSettings[SettingsUtils.SETTING_NAME_PORTFOLIO_ITEMS] = JSON.stringify(piSettings);
            return this.localSettings;
        },

        createReleaseSettings: function (release) {
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
            this.localSettings[SettingsUtils.SETTING_NAME_SCOPE] = SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS;
            this.localSettings[SettingsUtils.SETTING_NAME_RELEASE] = JSON.stringify(releaseSettings);
            return this.localSettings;
        },

        getPortfolioItems: function () {
            var piSetting = this.getSetting(SettingsUtils.SETTING_NAME_PORTFOLIO_ITEMS) || '[]';
            var result;
            try {
                result = JSON.parse(piSetting);
            } catch (e) {
                result = [];
            }
            return result;
        },

        getRelease: function () {
            var releaseSetting = this.getSetting(SettingsUtils.SETTING_NAME_RELEASE) || '{}';
            var result;
            try {
                result = JSON.parse(releaseSetting);
            } catch (e) {
                //ignored
            }
            return result;
        },

        getScope: function () {
            return this.getSetting(SettingsUtils.SETTING_NAME_SCOPE);
        },

        isReleaseScope: function () {
            return this.getSetting(SettingsUtils.SETTING_NAME_SCOPE) === SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS;
        }
    })
    ;
}());