Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    getSettingsFields: function() {
        return [
            {
                name: 'notesFilter',
                xtype: 'rallytextfield',
                fieldLabel: 'Notes Filter'    
            },
            {
                name: 'showNumberOfMonths',
                xtype: 'rallynumberfield',
                fieldLabel: 'Date Range (months)'
            }
        ];
    },

    //for storing all project rerence
    projRefCollection: [],
    
    launch: function() {
        this._getAllChildProjectsForCurrentProject(this.project);
    },
    
    _getAllChildProjectsForCurrentProject: function(currProject){
        Ext.getBody().mask('Loading...');
        
        this.allProjectsList = [];
        var that = this;
        var projectStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name', 'State', 'Parent', 'Children'],
            autoLoad: true,
            context: {
                workspace: that.getContext().getWorkspace()._Ref,
                projectScopeUp: false,
                projectScopeDown: true
            },
            limit: Infinity,
            filters:[{
                property:'State',
                operator: '=',
                value: 'Open'
            }],
            sorters: [{
                property: 'Name',
                direction: 'ASC'
            }],
            listeners: {
                load: function(projectStore, data, success){
                    //initiatilinzing the list containing the required and all projects.
                    this.requiredProjectsList = [];
                    this.allProjectsColl = data;
                    
                    //identifying the selected project and constructing its reference.
                    var selectedProj = this.getContext().getProject();
                    var selectedProjRef = '/project/' + selectedProj.ObjectID;
                        
                    //registering the selected project reference.
                    this.requiredProjectsList.push(selectedProjRef);
                        
                    //identifying whether selected project has any children.
                    var selectedProjChildren = selectedProj.Children;
                    if(selectedProjChildren && selectedProjChildren.Count > 0){
                        this._loadAllChildProjectsFromParent(selectedProjRef);
                    }
                        
                    //creating the milestone Store Filter.
                    this._createMilestoneStoreFilter();
                             
                    //creating Milestone store.
                    this._createMilestoneStore();
                        
                    Ext.getBody().unmask();
                },
                scope: this
            }
         });
    },
    
    _loadAllChildProjectsFromParent: function(parentProjRef){
        var that = this;
        
        Ext.Array.each(this.allProjectsColl, function(thisProject) {
            //identifying current project is child of the Project with reference..
            if(thisProject.get('Parent') && thisProject.get('Parent')._ref == parentProjRef){
                that.requiredProjectsList.push(thisProject.get('_ref'));
                
                //identifying whether the project as any further children.
                var projChildren = thisProject.get('Children');
                if(projChildren && projChildren.Count > 0){
                    that._loadAllChildProjectsFromParent(thisProject.get('_ref'));
                }
            }
        });
    },
    
    _createMilestoneStoreFilter: function(){
         this.projectMilestoneFilter = Ext.create('Rally.data.wsapi.Filter', {
                            property: 'TargetProject',
                            operator: '=',
                            value : this.requiredProjectsList[0]
                        });

        for(i=1; i<this.requiredProjectsList.length; i++){
            this.projectMilestoneFilter = this.projectMilestoneFilter.or(Ext.create('Rally.data.wsapi.Filter', {
                                    property: 'TargetProject',
                                    operator: '=',
                                    value : this.requiredProjectsList[i]
                                }));
        }
        
        this.projectMilestoneFilter = this.projectMilestoneFilter.and(Ext.create('Rally.data.wsapi.Filter', {
                                    property: 'TargetDate',
                                    operator: '>=',
                                    value: 'today'
                                }));
        
        //only apply filtering on the notes field if configured
        if (this.getSetting('notesFilter')) {
            this.projectMilestoneFilter = this.projectMilestoneFilter.and(Ext.create('Rally.data.wsapi.Filter', {
                                    property: 'Notes',
                                    operator: 'contains',
                                    value: this.getSetting('notesFilter')
                                }));
        }
        
        //only filter on date range if configured
        if (this.getSetting('showNumberOfMonths') && this.getSetting('showNumberOfMonths') > 0) {
            var endDate = Rally.util.DateTime.add(new Date(), "month", this.getSetting('showNumberOfMonths'));
            
            this.projectMilestoneFilter = this.projectMilestoneFilter.and(Ext.create('Rally.data.wsapi.Filter', {
                property: 'TargetDate',
                operator: '<=',
                value: endDate
            }));
        }
    },
                    
    _createMilestoneStore: function(){
        var that = this;
        Ext.create('Rally.data.wsapi.Store', {
            model: 'milestone',
            autoLoad: true,
            filters: that.projectMilestoneFilter ,
            sorters: [
                {
                    property: 'TargetDate',
                    direction: 'ASC'
                },
                {
                    property: 'TargetProject',
                    direction: 'ASC'
                }
            ],
            listeners: {
                load: this._onStoreBuilt,
                scope: this
            }
        });
    },
                    
    _onStoreBuilt: function(store) {
        this.add({
            xtype: 'rallygrid',
            columnCfgs: [
                {
                    text:'Name', 
                    dataIndex:"Name",
                    width: 500,
                    resizeable: true,
                    renderer: function(value,style,item,rowIndex) {
                        return Ext.String.format("<a target='_top' href='{1}'>{0}</a>", value, Rally.nav.Manager.getDetailUrl(item));
                    }
                },
                {
                    text: 'Project', 
                    dataIndex: 'TargetProject',
                    renderer: function(value) {
                        if (value && value._refObjectName) {
                            return value._refObjectName;
                        }
                        else {
                            return '';
                        }
                    }
                },
                {
                    text: 'Target Date', 
                    dataIndex: 'TargetDate',
                    width: 100,
                    renderer: function(value){
                        if(value)
                            return Rally.util.DateTime.format(value, 'M Y');
                    }
                },
                'DisplayColor',
                'Notes'
            ],
            context: this.getContext(),
            enableEditing: false,
            showRowActionsColumn: false,
            store: store
        });
    }
});
