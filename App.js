var Ext = window.Ext4 || window.Ext;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    //items:{ html:'<a href="https://help.rallydev.com/apps/2.0/doc/">App SDK 2.0 Docs</a>'},
    launch: function() {
        this._boxcontainer = Ext.create('Ext.form.Panel', {
            title: 'Grid Filters',
            layout: { type: 'hbox'},
            width: '95%',
            bodyPadding: 10
        });
        
        this._releaseCombobox = this.add({
            xtype: 'rallyreleasecombobox',
            stateful: true,
            padding: 5,
            stateId: this.getContext().getScopedStateId('release'),
            allowNoEntry: true,
            noEntryValue: '/release/-1',
            clearText: '-- Ignore Release Filter --',
            allowClear: true,
            emptyText: 'Filter by release...',
            context: this.getContext(),
            defaultToCurrentTimebox: false,
            defaultSelectionPosition: null,
            listeners: {
                ready: this._onReleaseAvailable,
                select: this._onReleaseChanged,
                scope: this
            }
        });
    }, //end launch
    
    _onReleaseAvailable: function(combo) {
        combo.getStore().getAt(0).set('formattedName', '-- Ignore Release Filter --');
        this._boxcontainer.add(this._releaseCombobox); //new
        this._addPICombobox();
    },
    
    _onReleaseChanged: function() {
        // if we don't yet have a PI combo box or if this is anything other than
        // the lowest level PI, bail
        if ( this._piCombobox ) {
            if (this._piCombobox.getRecord().get('Ordinal') === 0)
            {
                var grid = this.down('rallygrid');
                if ( grid ) {
                    var store = grid.getStore(),
                    filter = this._getReleaseFilter();
            
                    store.clearFilter(filter.length > 0);
                    if(filter.length) {
                      store.filter(this._getReleaseFilter());
                    }
                }
            }
        }
    },
    
    _addPICombobox: function() {
        this._piCombobox = this.add({
            xtype: "rallyportfolioitemtypecombobox",
            padding: 5,
            listeners: {
                //ready: this._onPICombobox,
                select: this._onPICombobox,
                scope: this
            }
        });
        this._boxcontainer.add(this._piCombobox); //new
        this._checkbox = this.add({
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Show Values After the Decimal',
            labelWidth: 200,
            padding: '5, 5, 5, 10',
            stateful: true,
            stateId: this.getContext().getScopedStateId('mycheckbox'),
            stateEvents: ['change'],
            value: false,
            listeners: {
                change: this._onPICombobox,
                scope: this
            }
        });
        this._boxcontainer.add(this._checkbox);
        this.add(this._boxcontainer);
    },

    _onPICombobox: function() {
        if( this._piCombobox ) {
            var selectedType = this._piCombobox.getRecord();
            if (this._piCombobox.getRecord().get('Ordinal') === 0) {
                // Only use the release filter if the PI is the lowest level
                // and then ensure it is enabled
                this._releaseCombobox.enable();
            } else { // disable the ReleaseComboBox if Feature not selected
               this._releaseCombobox.disable();
            }
        
            Rally.data.ModelFactory.getModel({
                type: selectedType.get('TypePath'),
                success: function(model){
                    if (this._myGrid === undefined) {
                        Ext.create("Rally.data.WsapiDataStore", {
                            model: model,
                            autoLoad: true,
                            filters: this._getReleaseFilter(),
                            remoteSort: false,
                            listeners: {
                                load: function(store, records, success) {
                                    this._calculateScore(records);
                                    this._updateGrid(store);
                                },
                               update: function(store, rec, modified, opts) {
                                    this._calculateScore([rec]);
                                },
                                scope: this
                            },
                            fetch: ["Name", "FormattedID", "Release", "c_ValuetoWK", 
                                "c_ImportancetotheMarket", "c_DissatisfactionwithCurrentSolution", 
                                "ValueScore", "c_EffortandRisktoDeliver"]
                        });
                    }
                    else { // grid exists, reset the model to the correct PI type
                        this._myGrid.reconfigureWithModel(model);
                        
                        // clear and re-apply filter since reconfiguring model 
                        // doesn't do this
                        var store = this._myGrid.getStore();
                         if (this._piCombobox.getRecord().get('Ordinal') === 0) {
                            var filter = this._getReleaseFilter();
                    
                            store.clearFilter(filter.length > 0);
                            if(filter.length) {
                              store.filter(this._getReleaseFilter());
                            }
                        }
                       
                        // re-apply grid update listeners
                        var that = this;
                        store.addListener('update', function(store, rec, modified, opts) {
                            that._calculateScore([rec]);
                        });
                        store.addListener('load', function(store, records, modified, opts) {
                            that._calculateScore(records); that._updateGrid(store);
                        });
                    }
                },
                scope: this
            });
        }
    },
    
    _calculateScore: function(records) {
        var that = this;
        var jobSize;
        
        Ext.Array.each(records, function(feature) {

            if( feature.data.c_EffortandRisktoDeliver ) {
                jobSize = parseInt(feature.data.c_EffortandRisktoDeliver, 10);
            }
            var timeValue;
            if( feature.data.c_ValuetoWK ) {
                timeValue = parseInt(feature.data.c_ValuetoWK, 10);
            }

            var OERR;
            if( feature.data.c_ImportancetotheMarket ) {
                OERR = parseInt(feature.data.c_ImportancetotheMarket, 10);
            }
            var userValue;
            if (feature.data.c_DissatisfactionwithCurrentSolution ) {
                userValue = parseInt(feature.data.c_DissatisfactionwithCurrentSolution, 10);
            }
            
            var oldScore = feature.data.ValueScore;
            
            var isChecked = false;
            if( that._checkbox) {
                isChecked = that._checkbox.getValue();
            }
            
            if (jobSize > 0) { // jobSize is the denominator so make sure it's not 0
                var score = 0;
    
                if( !isChecked ) {
                    score = Math.floor(((userValue * timeValue * OERR ) / jobSize) + 0.5);
                }
                else {
                    score = Math.floor(((userValue * timeValue * OERR ) / jobSize) * 100)/100;
                }

            if (oldScore !== score && !isNaN(score)) { // only update if score changed
                    feature.set('ValueScore', score); // set score value in db
                }
            }
        });
    },
    
    _createGrid: function(myStore) {
        this._myGrid = Ext.create("Rally.ui.grid.Grid", {
            xtype: "rallygrid",
            title: "Feature Scoring Grid",
            showPagingToolbar: true,
            pagingToolbarCfg: {
               pageSizes: [25, 50, 100, 200, 400, 800]
            },
            height: "98%",
            width: "98%",
            store: myStore,
            enableBulkEdit: true,
            enableRanking: true,
            defaultSortToRank: true,
            selType: "cellmodel",
            columnCfgs: [
                {
                    text: "Portfolio ID",
                    dataIndex: "FormattedID",
                    flex: 1,
                    xtype: "templatecolumn",
                    tpl: Ext.create("Rally.ui.renderer.template.FormattedIDTemplate")
                }, 
                {
                    text: "Name",
                    dataIndex: "Name",
                    flex: 2
                }, 
                {
                    text: "Value to WK",
                    dataIndex: "ValuetoWK"
                },
                 "ImportancetotheMarket", "DissatisfactionwithCurrentSolution", "EffortandRisktoDeliver", 
                {
                    text: "Score",
                    dataIndex: "ValueScore",
                    editor: null
                }
            ],
            scope: this
        }), this.add(this._myGrid);
    },
    
    _updateGrid: function(myStore) {
        if (this._myGrid === undefined) {
            this._createGrid(myStore);
        }
        else {
            this._myGrid.reconfigure(myStore);
        }
    },
    
    _getReleaseFilter: function() {
        var combo = this.down('rallyreleasecombobox');
        return combo.getValue() ?
          [combo.getQueryFromSelected()] : [];
    }
});