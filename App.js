Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    //items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {
        this.releaseCombobox = this.add({
            xtype: "rallyreleasecombobox",
            allowNoEntry: true,
            listeners: {
                ready: this._onReleaseComboboxLoad,
                change: this._onReleaseComboboxChanged,
                scope: this
            }
        });
    },

    _onReleaseComboboxLoad: function() {
        var query = this.releaseCombobox.getQueryFromSelected();
        this._loadFeatures(query);
    },
    _onReleaseComboboxChanged: function() {
        if(this._myGrid) {
            var store = this._myGrid.getStore();
            store.clearFilter(!0), store.filter(this.releaseCombobox.getQueryFromSelected());
        }
        else {
            var query = this.releaseCombobox.getQueryFromSelected();
            this._loadFeatures(query);            
        }
    },
    _loadFeatures: function(query) {
        Ext.create("Rally.data.WsapiDataStore", {
            model: "PortfolioItem/Feature",
            autoLoad: true,
            filters: query,
            remoteSort: false,
            listeners: {
                load: function(store, records, success) {
                    this._calculateScore(records), this._updateGrid(store);
                },
                update: function(store, rec, modified, opts) {
                    //console.log("calling store update");
                    this._calculateScore([rec]);
                },
                scope: this
            },
            fetch: ["Name", "FormattedID", "Release", "c_ValuetoWK", 
            "c_ImportancetotheMarket", "c_DissatisfactionwithCurrentSolution", 
            "ValueScore", "c_EffortandRisktoDeliver"]
        });
    },
    _calculateScore: function(records) {
        Ext.Array.each(records, function(feature) {
            //console.log("feature", feature.data);
            var jobSize;
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
            
            if (jobSize > 0) { // jobSize is the denominator so make sure it's not 0
                var score = Math.floor(((userValue * timeValue * OERR ) / jobSize) + 0.5);
                //console.log("newscore: ", score);
                if (oldScore !== score) { // only update if score changed
                    feature.set('ValueScore', score); // set score value in db
                    //feature.save(); SDF: used to need this, now it causes a concurrency error :/
                    //console.log("Setting a new score", score);
                }
            }
        });
    },
    _createGrid: function(myStore) {
        this._myGrid = Ext.create("Rally.ui.grid.Grid", {
            xtype: "rallygrid",
            title: "Feature Scoring Grid",
            height: "98%",
            store: myStore,
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
            ]
        }), this.add(this._myGrid);
    },
    _updateGrid: function(myStore) {
        if (this._myGrid === undefined) {
            this._createGrid(myStore);
        }
        else {
            this._myGrid.reconfigure(myStore);
        }
    }
});