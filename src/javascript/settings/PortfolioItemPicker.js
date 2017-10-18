(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("com.ca.technicalservices.Burnupdown.PortfolioItemPicker", {
        extend: "Ext.form.FieldContainer",
        alias: "widget.chartportfolioitempicker",

        requestContext: undefined,

        requires: [
            'Deft.Deferred',
            'Rally.util.Test',
            'Rally.ui.EmptyTextFactory',
            'Rally.ui.dialog.ChooserDialog',
            'Rally.data.wsapi.Store'
        ],

        mixins: [
            'Ext.form.field.Field'
        ],

        emptyText: '<p>No portfolio items match your search criteria.</p>',

        items: [
            {
                xtype: "label",
                text: "Portfolio Item",
                cls: "settingsLabel"
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
                        cls: 'piButton primary small'
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
        ],

        config: {
            app: undefined
        },

        beforeRender: function () {
            this._configureButton();
            this._configurePicker();
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
                workspace: this.app.context.getWorkspaceRef(),
                project: null
            };
        },

        _setValueFromSettings: function () {
            var newSettingsValue = this.app.getSetting("portfolioItemPicker"),
                oldSettingsValue = this.app.getSetting("buttonchooser");

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
            if ( Ext.isEmpty(this.value) || this.value.length === 0 ) {
                return;
            }
            var filters = Rally.data.wsapi.Filter.or(
                Ext.Array.map(this.value,function(pi_ref){
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

        _onPortfolioItemsRetrieved: function (store,records) {
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
            if ( Ext.isEmpty(this.portfolioItems) ) {
                return;
            }
            if ( ! Ext.isArray(this.portfolioItems) ) {
                this.portfolioItems = [this.portfolioItems];
            }

            return Ext.Array.map(this.portfolioItems, function(pi){
                return {
                    xtype:'button',
                    cls: 'project-button',
                    text: pi.FormattedID + " <span class='icon-delete'></span>",
                    listeners: {
                        scope: this,
                        click: function() {
                            this._removeItem(pi);
                        }
                    }
                };
            },this);
        },

        _removeItem: function(record) {
            this.portfolioItems = Ext.Array.filter(this.portfolioItems, function(pi){
                return ( record.FormattedID != pi.FormattedID );
            });

            this.portfolioItemRefs = Ext.Array.map(this.portfolioItems, function(pi) { return pi._ref; });
            this.setValue(this.portfolioItemRefs);

            this._setDisplayValue();
        },

        _onPortfolioItemChosen: function (dialog,resultStore) {
            var items = Ext.Array.merge(resultStore, this.portfolioItems);

            this._handleStoreResults(items);
            this._destroyChooser();
        },

        _filterUniquePIs: function(items) {
            var hash = {};
            Ext.Array.each(items, function(item) {
                var ref = item._ref || item.get('_ref');
                hash[ref] = item;
            });

            return Ext.Object.getValues(hash);
        },

        _handleStoreResults: function(store) {
            if (store) {
                if ( Ext.isArray(store) ) {
                    var pis = Ext.Array.map(store, function(pi) {
                        if ( Ext.isFunction(pi.getData) ) {
                            return pi.getData();
                        }
                        return pi;
                    });

                    this.portfolioItems = this._filterUniquePIs(pis);

                    this.portfolioItemRefs = Ext.Array.map(this.portfolioItems, function(pi) {
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
                _isArtifactEditable: function(record) {
                    return true;
                },
                listeners: {
                    artifactChosen: this._onPortfolioItemChosen,
                    scope: this
                },
                storeConfig: {
                    project: null,
                    context: this.requestContext,
                    fetch: ['ObjectID','Project','WorkSpace','FormattedID','Name','ActualStartDate','PlannedStartDate','ActualEndDate','PlannedEndDate']
                },
                gridConfig: {
                    viewConfig: {
                        emptyText: Rally.ui.EmptyTextFactory.getEmptyTextFor(this.emptyText),
                        getRowClass: function(record) {
                            return Rally.util.Test.toBrowserTestCssClass('row', record.getId()) + '';
                        }
                    }
                }
            };
        },

        setValue: function (value) {

            if (value && value !== "undefined") {
                if ( Ext.isString(value) ) {
                    value = value.split(',');
                }
                this.value = value;
            }
            else {
                this.value = this.app.getSetting("portfolioItemPicker");
            }
        },

        getSubmitData: function () {
            var returnObject = {};

            if ( this.portfolioItemRefs && Ext.isArray(this.portfolioItemRefs) ) {
                this.setValue(this.portfolioItemRefs);
                returnObject.portfolioItemPicker = this.portfolioItemRefs;
            } else if (this.portfolioItem) {

                this.setValue(this.portfolioItem._ref);
                returnObject.portfolioItemPicker = this.portfolioItem._ref;
            }
            else {
                returnObject.portfolioItemPicker = "";
            }

            returnObject.portfolioItems = JSON.stringify(this.portfolioItems.map(function(item){
                return {
                    _ref: item._ref,
                    oid: Rally.util.Ref.getOidFromRef(item._ref),
                    PlannedStartDate: item.PlannedStartDate,
                    ActualStartDate: item.ActualStartDate,
                    PlannedEndDate: item.PlannedEndDate
                }
            }));

            return returnObject;
        }
    });
}());