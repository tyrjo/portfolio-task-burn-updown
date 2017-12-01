(function () {
    var Ext = window.Ext4 || window.Ext;

    var RELEASE_PICKER_ITEMID = 'RELEASE_PICKER_ITEMID';
    var TITLE_SELECT_RELEASE = 'Select Release';
    var TITLE_SELECT_ITEMS = 'Select Individual Portfolio Items';

    Ext.define("com.ca.technicalservices.Burnupdown.PortfolioItemPicker", {
        extend: "Ext.form.FieldContainer",
        alias: "widget.chartportfolioitempicker",

        requestContext: undefined,

        requires: [
            'Deft.Deferred',
            'Rally.util.Test',
            'Rally.ui.EmptyTextFactory',
            'Rally.ui.dialog.ChooserDialog',
            'Rally.data.wsapi.Store',
            'SettingsUtils'
        ],

        mixins: [
            'Ext.form.field.Field'
        ],

        config: {
            settingsUtils: {}
        },

        emptyText: '<p>No portfolio items match your search criteria.</p>',

        portfolioItemScope: SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS,

        portfolioItemsAttributes: ['ObjectID', 'Project', 'WorkSpace', 'FormattedID', 'Name', 'ActualStartDate', 'PlannedStartDate', 'ActualEndDate', 'PlannedEndDate'],

        portfolioItems: [],

        release: undefined,

        items: [
            {
                xtype: 'radiogroup',
                title: 'Scope',
                itemId: 'scopeRadioGroup',
                items: [
                    {
                        boxLabel: TITLE_SELECT_RELEASE,
                        name: SettingsUtils.SETTING_NAME_SCOPE,
                        inputValue: SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS,
                        checked: true
                    },
                    {
                        boxLabel: TITLE_SELECT_ITEMS,
                        name: SettingsUtils.SETTING_NAME_SCOPE,
                        inputValue: SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS
                    }
                ]
            },
            {
                xtype: 'fieldset',
                itemId: SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS,
                title: TITLE_SELECT_RELEASE,
                items: [{
                    xtype: 'rallyreleasecombobox',
                    itemId: RELEASE_PICKER_ITEMID,
                    name: SettingsUtils.SETTING_NAME_RELEASE,
                    submitValue: false
                }]
            },
            {
                xtype: 'fieldset',
                itemId: SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS,
                title: TITLE_SELECT_ITEMS,
                hidden: true,
                items: [
                    {
                        xtype: "label",
                        text: "Portfolio Item",
                    },
                    {
                        xtype: "container",
                        name: "portfolioItemPicker",
                        layout: {
                            type: "hbox"
                        },
                        items: [
                            {

                                xtype: 'rallybutton',
                                text: 'Add',
                                itemId: 'portfolioItemButton',
                            },
                            {
                                xtype: 'container',
                                cls: 'piDisplayField',
                                items: [
                                    {
                                        xtype: 'container',
                                        itemId: 'portfolioItemDisplay',
                                        value: "&nbsp;"
                                    }
                                ]
                            }

                        ]
                    }
                ]
            }
        ],

        constructor: function (config) {
            this.initConfig(config);
            this.callParent(arguments);
            return this;
        },

        beforeRender: function () {
            this._configureRadio();
            this._configureReleasePicker();
            this._configureButton();
            this._configurePicker();
        },

        _configureRadio: function () {
            var currentSetting = {};
            currentSetting[SettingsUtils.SETTING_NAME_SCOPE] = this.config.settingsUtils.getScope();
            var radioGroup = this.down('#scopeRadioGroup');
            radioGroup.on({
                scope: this,
                change: function (radioGroup, newValue) {
                    this._onScopeChange(newValue[SettingsUtils.SETTING_NAME_SCOPE]);
                }
            });
            radioGroup.setValue(currentSetting);
        },

        _configureReleasePicker: function () {
            var picker = this.down('#' + RELEASE_PICKER_ITEMID);
            picker.setValue(this.config.settingsUtils.getRelease()._ref);
            picker.on('change', function (element) {
                this._onReleaseChange(element.getRecord());
            }, this);
        },

        _onReleaseChange: function (release) {
            this.release = release;
        },

        _configureButton: function () {
            this.down('#portfolioItemButton').on('click', this._onButtonClick, this);
        },

        _configurePicker: function () {
            this._setupRequestContext();
            this._createPortfolioItemStore();
        },

        _setupRequestContext: function () {
            this.requestContext = {
                workspace: Rally.getApp().context.getWorkspaceRef(),
                project: null
            };
        },

        _createPortfolioItemStore: function () {
            // Get the current PIs setting, and attempt to load each PI by ObjectID
            var portfolioItemsSetting = this.config.settingsUtils.getPortfolioItems();

            if (portfolioItemsSetting.length >0) {

                var filters = Rally.data.wsapi.Filter.or(
                    Ext.Array.map(portfolioItemsSetting, function (pi) {
                        return {
                            property: "ObjectID",
                            operator: "=",
                            value: Rally.util.Ref.getOidFromRef(pi._ref)
                        };
                    })
                );

                Ext.create("Rally.data.wsapi.Store", {
                    model: Ext.identityFn("Portfolio Item"),
                    filters: filters,
                    context: this.requestContext,
                    fetch: this.portfolioItemsAttributes,
                    autoLoad: true,
                    listeners: {
                        load: this._onPortfolioItemsRetrieved,
                        scope: this
                    }
                });
            }
        },

        _onPortfolioItemsRetrieved: function (store, results) {
            var pis = results;
            if ( !Ext.isArray(pis) ) {
                pis = [results];
            }
            this._handleStoreResults(pis);
        },

        _setDisplayValue: function () {
            var container = this.down('#portfolioItemDisplay');
            container.removeAll();
            container.add(this._getPortfolioItemDisplay());
        },

        _onButtonClick: function () {
            this._destroyChooser();

            this.dialog = Ext.create("Rally.ui.dialog.ArtifactChooserDialog", this._getChooserConfig());
            this.dialog.show();
        },

        _destroyChooser: function () {
            if (this.dialog) {
                this.dialog.destroy();
            }
        },

        _getPortfolioItemDisplay: function () {
            if (Ext.isEmpty(this.portfolioItems)) {
                return;
            }

            return Ext.Array.map(this.portfolioItems, function (pi) {
                return {
                    xtype: 'button',
                    cls: 'project-button',
                    text: pi.FormattedID + " <span class='icon-delete'></span>",
                    listeners: {
                        scope: this,
                        click: function () {
                            this._removeItem(pi);
                        }
                    }
                };
            }, this);
        },

        _removeItem: function (record) {
            this.portfolioItems = Ext.Array.filter(this.portfolioItems, function (pi) {
                return ( record.FormattedID != pi.FormattedID );
            });

            this._setDisplayValue();
        },

        _onPortfolioItemChosen: function (dialog, resultStore) {
            var items = Ext.Array.merge(resultStore, this.portfolioItems);
            this._handleStoreResults(items);
            this._destroyChooser();
        },

        _handleStoreResults: function (results) {
            var pis = Ext.Array.map(results, function (pi) {
                if (Ext.isFunction(pi.getData)) {
                    return pi.getData();
                }
                return pi;
            });

            this.portfolioItems = _.unique(pis, '_ref');

            this._setDisplayValue();
        },

        _getChooserConfig: function () {
            return {
                artifactTypes: ['portfolioitem'],
                multiple: true,
                height: 350,
                title: 'Choose Portfolio Item(s) to Add',
                closeAction: 'destroy',
                selectionButtonText: 'Select',
                _isArtifactEditable: function (record) {
                    return true;
                },
                listeners: {
                    artifactChosen: this._onPortfolioItemChosen,
                    scope: this
                },
                storeConfig: {
                    project: null,
                    context: this.requestContext,
                    fetch: this.portfolioItemsAttributes
                },
                gridConfig: {
                    viewConfig: {
                        emptyText: Rally.ui.EmptyTextFactory.getEmptyTextFor(this.emptyText),
                        getRowClass: function (record) {
                            return Rally.util.Test.toBrowserTestCssClass('row', record.getId()) + '';
                        }
                    }
                }
            };
        },

        getSubmitData: function () {
            var result = {};

            switch (this.portfolioItemScope) {
                case SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS:
                    result = this.config.settingsUtils.createReleaseSettings(this.release);
                    break;
                case SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS:
                default:
                    result = this.config.settingsUtils.createPortfolioItemsSettings(this.portfolioItems);
                    break;
            }

            return result;
        },

        _onScopeChange: function (newScope) {
            this.portfolioItemScope = newScope;
            var individualFieldset = this.down('#' + SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS);
            var releaseFieldset = this.down('#' + SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS);
            if (newScope === SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS) {
                individualFieldset.setDisabled(true).setVisible(false);
                releaseFieldset.setDisabled(false).setVisible(true);
            } else {
                individualFieldset.setDisabled(false).setVisible(true);
                releaseFieldset.setDisabled(true).setVisible(false);
            }
        }
    });
}());