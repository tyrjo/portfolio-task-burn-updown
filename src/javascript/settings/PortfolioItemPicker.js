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

        emptyText: '<p>No portfolio items match your search criteria.</p>',

        portfolioItemScope: SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS,

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
                    name: SettingsUtils.SETTING_NAME_RELEASE
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

        config: {
            iterationData: undefined
        },

        beforeRender: function () {
            this._configureRadio();
            this._configureReleasePicker();
            this._configureButton();
            this._configurePicker();
        },

        _configureRadio: function () {
            this.down('#scopeRadioGroup').on({
                scope: this,
                change: function (radioGroup, newValue) {
                    this._onScopeChange(newValue[SettingsUtils.SETTING_NAME_SCOPE]);
                }
            });
        },

        _configureReleasePicker: function() {
            this.down('#' + RELEASE_PICKER_ITEMID).setValue(SettingsUtils.getRelease())
        },

        _configureButton: function () {
            this.down('#portfolioItemButton').on('click', this._onButtonClick, this);
        },

        _configurePicker: function () {
            this._setValueFromSettings();
            this._setupRequestContext();
            this._loadPortfolioItems();
        },

        _setupRequestContext: function () {
            this.requestContext = {
                workspace: Rally.getApp().context.getWorkspaceRef(),
                project: null
            };
        },

        _setValueFromSettings: function () {
            var newSettingsValue = Rally.getApp().getSetting("portfolioItemPicker"),
                oldSettingsValue = Rally.getApp().getSetting("buttonchooser");

            if (this._isSettingValid(newSettingsValue)) {
                this.setValue(newSettingsValue);
            } else if (this._isSettingValid(oldSettingsValue)) {
                this.setValue(Ext.JSON.decode(oldSettingsValue).artifact._ref);
            } else {
                this.setValue("&nbsp;");
            }
        },

        _isSettingValid: function (value) {
            return value && value !== "undefined";
        },

        _loadPortfolioItems: function () {
            if (this._isSavedValueValid()) {
                this._createPortfolioItemStore();
            }
        },

        _createPortfolioItemStore: function () {
            if (Ext.isEmpty(this.value) || this.value.length === 0) {
                return;
            }
            var filters = Rally.data.wsapi.Filter.or(
                Ext.Array.map(this.value, function (pi_ref) {
                    return {
                        property: "ObjectID",
                        operator: "=",
                        value: Rally.util.Ref.getOidFromRef(pi_ref)
                    };
                })
            );

            Ext.create("Rally.data.wsapi.Store", {
                model: Ext.identityFn("Portfolio Item"),
                filters: filters,
                context: this.requestContext,
                autoLoad: true,
                listeners: {
                    load: this._onPortfolioItemsRetrieved,
                    scope: this
                }
            });
        },

        _isSavedValueValid: function () {
            return Ext.isArray(this.value) && this.value !== "undefined";
        },

        _onPortfolioItemsRetrieved: function (store, records) {
            var storeData = records;
            this._handleStoreResults(storeData);
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
            if (!Ext.isArray(this.portfolioItems)) {
                this.portfolioItems = [this.portfolioItems];
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

            this.portfolioItemRefs = Ext.Array.map(this.portfolioItems, function (pi) {
                return pi._ref;
            });
            this.setValue(this.portfolioItemRefs);

            this._setDisplayValue();
        },

        _onPortfolioItemChosen: function (dialog, resultStore) {
            var items = Ext.Array.merge(resultStore, this.portfolioItems);

            this._handleStoreResults(items);
            this._destroyChooser();
        },

        _filterUniquePIs: function (items) {
            var hash = {};
            Ext.Array.each(items, function (item) {
                var ref = item._ref || item.get('_ref');
                hash[ref] = item;
            });

            return Ext.Object.getValues(hash);
        },

        _handleStoreResults: function (store) {
            if (store) {
                if (Ext.isArray(store)) {
                    var pis = Ext.Array.map(store, function (pi) {
                        if (Ext.isFunction(pi.getData)) {
                            return pi.getData();
                        }
                        return pi;
                    });

                    this.portfolioItems = this._filterUniquePIs(pis);

                    this.portfolioItemRefs = Ext.Array.map(this.portfolioItems, function (pi) {
                        return pi._ref;
                    });

                    this._setDisplayValue();
                    this.setValue(this.portfolioItemRefs);
                } else if (store.data) {
                    this.portfolioItem = store.data;
                    this._setDisplayValue();
                    this.setValue(this.portfolioItem._ref);
                }
            }
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
                    fetch: ['ObjectID', 'Project', 'WorkSpace', 'FormattedID', 'Name', 'ActualStartDate', 'PlannedStartDate', 'ActualEndDate', 'PlannedEndDate']
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

        setValue: function (value) {

            if (value && value !== "undefined") {
                if (Ext.isString(value)) {
                    value = value.split(',');
                }
                this.value = value;
            }
            else {
                this.value = Rally.getApp().getSetting("portfolioItemPicker");
            }
        },

        getSubmitData: function () {
            var returnObject = {};

            switch (this.portfolioItemScope) {
                case SettingsUtils.SCOPE_RELEASE_PORTFOLIO_ITEMS:
                    //returnObject.portfolioItemScope = this.portfolioItemScope;
                    break;
                case SettingsUtils.SCOPE_INDIVIDUAL_PORTFOLIO_ITEMS:
                default:
                    if (this.portfolioItemRefs && Ext.isArray(this.portfolioItemRefs)) {
                        this.setValue(this.portfolioItemRefs);
                        returnObject.portfolioItemPicker = this.portfolioItemRefs;
                    } else if (this.portfolioItem) {

                        this.setValue(this.portfolioItem._ref);
                        returnObject.portfolioItemPicker = this.portfolioItem._ref;
                    }
                    else {
                        returnObject.portfolioItemPicker = "";
                    }

                    piSettings = SettingsUtils.setPortfolioItems(this.portfolioItems);

                    returnObject.portfolioItemScope = this.portfolioItemScope;

                    _.merge(returnObject, piSettings);

                    break;
            }


            return returnObject;
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