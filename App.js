var types = Ext.data.Types;
Ext.define('MilestoneTreeModel', {
	extend: 'Ext.data.TreeModel',
	fields: [
                {name: 'FormattedID', mapping: 'FormattedID', type: types.STRING},
                {name: 'Name', mapping: 'Name', type: types.STRING},
                {name: 'TargetDate', mapping: 'AcceptedDate', type: types.DATE },
                {name: 'TargetProject', mapping: 'TargetProject', type: types.OBJECT},
                {name: 'ValueStream', mapping: 'ValueStream', type: types.STRING},
                {name: 'Visibility', mapping: 'Visibility', type: types.STRING},
                {name: 'Status', mapping: 'Status', type: types.STRING},
                {name: 'DisplayColor', mapping: 'DisplayColor', type: types.STRING},
                {name: 'Notes', mapping: 'Notes', type: types.STRING},
                {name: '_ref', mapping: '_ref', type: types.STRING},
                {name: 'AcceptedLeafStoryCount', mapping: 'AcceptedLeafStoryCount', type: types.STRING},
                {name: 'LeafStoryCount', mapping: 'LeafStoryCount', type: types.STRING},
                {name: 'StoryProgressPercent', mapping: 'StoryProgressPercent', type: types.FLOAT}
            ],
    hasMany: {model: 'FeatureTreeModel', name:'features', associationKey: 'features'}
});

Ext.define('MilestoneDataModel', {
    extend: 'Ext.data.Model',
    fields: [
                {name: 'FormattedID', mapping: 'FormattedID', type: types.STRING},
                {name: 'Name', mapping: 'Name', type: types.STRING},
                {name: 'TargetDate', mapping: 'AcceptedDate', type: types.DATE },
                {name: 'TargetProject', mapping: 'TargetProject', type: types.OBJECT},
                {name: 'ValueStream', mapping: 'ValueStream', type: types.STRING},
                {name: 'Visibility', mapping: 'Visibility', type: types.STRING},
                {name: 'Status', mapping: 'Status', type: types.STRING},
                {name: 'DisplayColor', mapping: 'DisplayColor', type: types.STRING},
                {name: 'Notes', mapping: 'Notes', type: types.STRING},
                {name: '_ref', mapping: '_ref', type: types.STRING},
                {name: 'AcceptedLeafStoryCount', mapping: 'AcceptedLeafStoryCount', type: types.INT},
                {name: 'LeafStoryCount', mapping: 'LeafStoryCount', type: types.INT},
                {name: 'StoryProgressPercent', mapping: 'StoryProgressPercent', type: types.FLOAT}
            ]
});


Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    getSettingsFields: function() {
        return [
            {
                name: 'executiveVisibilityOnly',
                xtype: 'rallycheckboxfield',
                fieldLabel: '',
                boxLabel: 'Only show Milestones with Executive Visibility'    
            },
            {
                name: 'includeGlobalMilestones',
                xtype: 'rallycheckboxfield',
                fieldLabel: '',
                boxLabel: 'Include global milestones'
            },
            {
                name: 'showNumberOfMonths',
                xtype: 'rallynumberfield',
                fieldLabel: 'Date Range (months)'
            }
        ];
    },
    
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
            compact: false,
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
                    this.requiredProjectsList.push(selectedProj.ObjectID);
                        
                    //identifying whether selected project has any children.
                    var selectedProjChildren = selectedProj.Children;
                    if(selectedProjChildren && selectedProjChildren.Count > 0){
                        this._loadAllChildProjectsFromParent(selectedProjRef);
                    }
                    
                    //creating the milestone Store Filter.
                    this._createMilestoneStoreFilter();
                             
                    //creating Milestone store.
                    this._createMilestoneStore();
                    
                    
                },
                scope: this
            }
         });
    },
    
    _loadAllChildProjectsFromParent: function(parentProjRef) {
        var that = this;
        
        Ext.Array.each(this.allProjectsColl, function(thisProject) {
            //identifying current project is child of the Project with reference..
            if(thisProject.get('Parent') && thisProject.get('Parent')._ref !== null && thisProject.get('Parent')._ref == parentProjRef){
                that.requiredProjectsList.push(thisProject.data.ObjectID);
                
                //identifying whether the project as any further children.
                var projChildren = thisProject.get('Children');
                if(projChildren && projChildren.Count > 0){
                    that._loadAllChildProjectsFromParent(thisProject.get('_ref'));
                }
            }
        });
    },
    
    _createMilestoneStoreFilter: function(){
        this.projectMilestoneFilter =  Ext.create('Rally.data.wsapi.Filter', {
                                    property: 'TargetDate',
                                    operator: '>=',
                                    value: 'today'
                                });
        
        //only apply filtering on the notes field if configured
        if (this.getSetting('executiveVisibilityOnly')) {
            this.projectMilestoneFilter = this.projectMilestoneFilter.and(Ext.create('Rally.data.wsapi.Filter', {
                                    property: 'c_ExecutiveVisibility',
                                    operator: '=',
                                    value: this.getSetting('executiveVisibilityOnly')
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
    
    _createMilestoneStore: function() {

        Ext.create("Rally.data.wsapi.Store", {
            model: 'milestone',
            autoLoad: true,
            compact: false,
            listeners: {
                load: function(store, data, success) {
                    this._filterMileStones(data);
                },
                scope: this
            },
            filters : this.projectMilestoneFilter,
            sorters: [
                {
                    property: 'c_ValueStream',
                    direction: 'ASC'
                },
                {
                    property: 'TargetDate',
                    direction: 'ASC'
                }
            ]
        }); 
    },
    
    //Only include milestones based on the current project and it's children
    _filterMileStones: function(milestones) {
        var that = this;
        
        //Filter out milestone will be stored here
        var filteredMilestonesArr = [];
        
        Ext.each(milestones, function(milestone, index) {
            
            if (milestone.data.TargetProject !== null && milestone.data.TargetProject !== "" && (that.requiredProjectsList.indexOf(milestone.data.TargetProject.ObjectID) > -1)) {
                filteredMilestonesArr.push(milestone);
            }
            
            //If including global milestones, get milestones where TargetProject is not specific as well
            if (that.getSetting('includeGlobalMilestones') && milestone.data.TargetProject === null){
                filteredMilestonesArr.push(milestone);
            }
        });
        
        this._loadArtifactsForMilestones(filteredMilestonesArr);
        //this._organiseMilestoneBasedOnValuestream(filteredMilestonesArr);
    },
    
    _loadArtifactsForMilestones: function(milestoneArr){
        var that = this;
        //console.log('inside _loadArtifactsForMilestones.....');
        //console.log('imilestone records: ', milestoneArr);
        
        this._loadArtifacts(milestoneArr).then({
                success: function(records){
                    that.milestoneDataArray = [];
                    
                    Ext.Array.each(records, function(record, index){
                        //console.log('print milestone recs: ', record);
                        //console.log('print milestone index: ', index);
                        //console.log('milestone array: ', milestoneArr);
                        
                        var storyCountInfo = that._computeArtifactsAssociation(record);
                        //console.log('Milestone: [',  that.milestoneNameList[index] + '] has : (', storyCountInfo.acceptedCount + '/', storyCountInfo.storyCount + ') stories done.');
                        var milestoneRec = milestoneArr[index];
                        
                        var milestoneCustomData = that._createCustomMilestoneData(milestoneRec, storyCountInfo);
                        that.milestoneDataArray.push(milestoneCustomData);
                    });
                    
                    //console.log('Milestone Artifact Data list: ', that.milestoneDataArray);
                    
                    that._organiseMilestoneBasedOnValuestream(that.milestoneDataArray);
                },
                failure: function(error){
                    console.log('There are some errors');
                    Ext.getBody().unmask();
                },
            scope: that
            });
    },
    
    _createCustomMilestoneData: function(milestoneItem, storyCountInfo){
        var milestoneData = Ext.create('MilestoneDataModel', {
            FormattedID : milestoneItem.get('FormattedID'),
            Name: milestoneItem.get('Name'),
            TargetDate : milestoneItem.get('TargetDate'),
            TargetProject : milestoneItem.get('Name'),
            ValueStream: milestoneItem.get('c_ValueStream'),
            Visibility: milestoneItem.get('c_ExecutiveVisibility'),
            Status: milestoneItem.get('c_Test'),
            DisplayColor: milestoneItem.get('DisplayColor'),
            Notes: milestoneItem.get('Notes'),
            _ref: milestoneItem.get('_ref'),
            AcceptedLeafStoryCount: storyCountInfo.acceptedCount,
            LeafStoryCount: storyCountInfo.storyCount,
            StoryProgressPercent: storyCountInfo.storyCount > 0 ? (storyCountInfo.acceptedCount/storyCountInfo.storyCount) : 0
        });
        
        return milestoneData;
    },
    
    _loadArtifacts: function(milestoneList){
        var promises = [];
        var that = this;
        
        Ext.Array.each(milestoneList, function(milestone){
            
            var artifactStore = Ext.create('Rally.data.wsapi.artifact.Store', {
                    models: ['portfolioitem/feature', 'defect', 'userstory'],
                    context: {
                        workspace: that.getContext().getWorkspace()._Ref,
                        project: null,
                        limit: Infinity,
                        projectScopeUp: false,
                        projectScopeDown: true
                    },
                    filters: [
                        {
                            property: 'Milestones.ObjectID',
                            operator: '=',
                            value: milestone.get('ObjectID')
                        }
                    ]
            });
            
            promises.push(that._loadArtifactStore(artifactStore));
            
        });
        
        return Deft.Promise.all(promises);
    },
    
    _loadArtifactStore: function(store){
        var deferred;
        deferred = Ext.create('Deft.Deferred');
        
        store.load({
                callback: function(records, operation, success) {
                  if (success) {
                    deferred.resolve(records);
                  } else {
                    deferred.reject("Error loading Companies.");
                  }
                }
            });
            
        return deferred.promise;
    },
    
    _computeArtifactsAssociation: function(artifactColl){
        var storyCountInfo = {
            storyCount: 0,
            acceptedCount: 0
        };
        var leafStoryCount = 0, acceptedLeafStoryCount = 0;
        
        if(artifactColl.length > 0){
            Ext.Array.each(artifactColl, function(item){
                var itemType = item.get('_type');
                var scheduleState = item.get('ScheduleState');
                
                if (itemType == 'hierarchicalrequirement' || itemType == 'defect') {
                    leafStoryCount += 1;
                    
                    if (scheduleState == 'Accepted') {
                        acceptedLeafStoryCount += 1;   
                    }
                }
                else {
                    leafStoryCount += item.get('LeafStoryCount');
                    acceptedLeafStoryCount += item.get('AcceptedLeafStoryCount'); 
                }
            });
        }
        
        storyCountInfo.storyCount = leafStoryCount;
        storyCountInfo.acceptedCount = acceptedLeafStoryCount;
        
        return storyCountInfo;
    },
    
    _organiseMilestoneBasedOnValuestream: function(filteredMilestonesArr){
        this.valueStreamMilestoneColl = [];
        this.valueStreamColl = [];
        var nonVSCount = 0;
        var that = this;
        
        Ext.Array.each(filteredMilestonesArr, function(thisData){
            var valuestream = thisData.get('ValueStream');
            
            if(valuestream !== null && valuestream !== ''){
                if(that.valueStreamColl.length === 0){
                    that.valueStreamColl.push(valuestream);
                }
                else if(that.valueStreamColl.length > 0 && that.valueStreamColl.indexOf(valuestream) === -1){
                    that.valueStreamColl.push(valuestream);
                }
            }
            else{
                nonVSCount++;
            }
        });
        
        this.valueStreamColl.sort();
         //console.log('VS: coll', this.valueStreamColl);
        
        if(nonVSCount > 0) {
            this.valueStreamColl.push('N/A');
        }
        
        Ext.Array.each(this.valueStreamColl, function(valuestream) {
            var milestoneColl = that._getAllAssociatedMilestones(valuestream, filteredMilestonesArr);
            
            that.valueStreamMilestoneColl.push({
                key: valuestream,
                value: milestoneColl
            });
        });
        
        //console.log('Milestone by VS: ', this.valueStreamMilestoneColl);
        
        this._createValueStreamMilestonesTreeNode();
    },
    
    _createValueStreamMilestonesTreeNode: function(){
        
        var valueStreamRootNode = Ext.create('MilestoneTreeModel',{
                    Name: 'ValueStream Root',
                    text: 'ValueStream Root',
                    root: true,
                    expandable: true,
                    expanded: true
                });
                
        this._createValueStreamNodesAlongWithAssociatedChildMilestoneNodes(valueStreamRootNode);
        
        //console.log('milestone tree node: ', valueStreamRootNode);
        
        this._createValueStreamMilestoneGrid(valueStreamRootNode);
        
    },
    
    _createValueStreamMilestoneGrid: function(valueStreamRootNode){
        
       var me = this;
       var milestoneValueStreamTreeStore = Ext.create('Ext.data.TreeStore', {
            model: 'MilestoneTreeModel',
            root: valueStreamRootNode
        }); 
        
       var valuestreamMilestoneTreePanel = Ext.create('Ext.tree.Panel', {
            store: milestoneValueStreamTreeStore,
            useArrows: true,
            rowLines: true,
            displayField: 'Name',
            rootVisible: false,
            width: this.getWidth(true),
            height: this.getHeight(true), // Extra scroll for individual sections:
            viewConfig: {
                getRowClass: function(record, index) {
                    var nameRecord = Ext.String.format("{0}", record.get('Name'));
                    if(nameRecord && nameRecord.search('valuestream:') === -1){
                        return 'row-child';
                    }
                    return 'row-parent';
                }
            },
            columns: [{
                          xtype: 'treecolumn',
                          text: 'Name',
                          dataIndex: 'Name',
                          resizeable: true,
                          flex: 3,
                          minWidth:200,
                          //width : 300,
                          renderer: function(value,style,item,rowIndex) {
                                var link = Ext.String.format("{0}", value);
                                if(link.search('valuestream:') === -1){
                                    var ref = item.get('_ref');
                                    link = Ext.String.format("<a target='_top' href='{1}'><b>{0}</b></a>", value, Rally.nav.Manager.getDetailUrl(ref));
                                }
                                else{
                                    var onlyName = link.replace('valuestream:', '');
                                    link= Ext.String.format("<b>{0}</b>", onlyName);
                                }
                                    
                                return link;
                            }
                    },
                    {
                        text: 'Project', 
                        dataIndex: 'TargetProject',
                        flex: 2,
                        hidden: true
                    },
                    {
                        text: 'Target Date', 
                        dataIndex: 'TargetDate',
                        flex: 1,
                        renderer: function(value){
                            if(value)
                                return Rally.util.DateTime.format(value, 'M Y');
                        }
                    },
                    {
                        xtype: 'templatecolumn',
                        text: 'Progress',
                        dataIndex: 'StoryProgressPercent',
                        tpl: Ext.create('Rally.ui.renderer.template.progressbar.ProgressBarTemplate', {
                             percentDoneName: 'StoryProgressPercent',
                             showOnlyIfInProgress: true,
                             calculateColorFn: function(value){
                                 //console.log('inside calculateColorFn.....value: ', value);
                                 var targetDate = value.TargetDate;
                                 var per = 0;
                                 var colorHex = '#77D38D';
                                 if(value.StoryProgressPercent && targetDate){
                                     per = parseFloat(value.StoryProgressPercent);
                                     colorHex = me._getPercentDoneColor(targetDate);
                                 }
                                 //console.log('color in hex: ', colorHex);
                                 return colorHex;
                             }
                        }),
                        flex: 1
                    },
                    {
                        text: 'Accepted Count',
                        dataIndex: 'AcceptedLeafStoryCount',
                        flex: 1,
                        hidden: true
                    },
                    {
                        text: 'Story Count',
                        dataIndex: 'LeafStoryCount',
                        flex: 1,
                        hidden: true
                    },
                    {
                        text: 'Status',
                        dataIndex: 'DisplayColor',
                        flex: 1,
                        renderer: function(value){
                            if(value){ 
                                var colorHtml = Ext.String.format("<div class= 'color-box' style= 'background-color: {0};'></div>", value);
                                return colorHtml;
                            }
                        }
                    },
                    {
                        text: 'Notes',
                        dataIndex: 'Notes',
                        flex: 4
                    }
                ]
        });
        
        this.add(valuestreamMilestoneTreePanel);
        
        Ext.getBody().unmask();
    },
    
    _getPercentDoneColor: function(targetDate){
        
        var colorCode = '#40FF00';
        //console.log('inside _getPercentDoneColor.....');
        var dt = Rally.util.DateTime.getDifference(targetDate, new Date(), 'day');
        
        //console.log('Date difference: ', dt);
        
        if(dt < 0)
            colorCode = '#8A0829';
        else if(dt > 0 && dt <=5)
            colorCode = '#FE2E2E';
        else if(dt > 5 && dt <=15)
            colorCode = '#FE9A2E';
         else if(dt > 15 && dt <=30)
            colorCode = '#F7FE2E';
            
        return colorCode;
    },
    
    _createValueStreamNodesAlongWithAssociatedChildMilestoneNodes: function(valustreamRootNode){
        var that = this;
        
        Ext.Array.each(this.valueStreamMilestoneColl, function(thisData) {
            var valueStreamNode = that._createValueStreamNode(thisData.key);
            
            Ext.Array.each(thisData.value, function(thisMilestoneData) {
                var milestoneNode = that._createMilestoneNode(thisMilestoneData);
                valueStreamNode.appendChild(milestoneNode);
            });
            
            valustreamRootNode.appendChild(valueStreamNode);
        });
    },
    
    _createValueStreamNode: function(valuestreamData){
        var valueStreamLable = 'valuestream: ' + valuestreamData;
        var valustreamTreeNode = Ext.create('MilestoneTreeModel',{
                    Name: valueStreamLable,
                    AcceptedLeafStoryCount: '',
                    LeafStoryCount: '',
                    StoryProgressPercent: '',
                    leaf: false,
                    expandable: true,
                    expanded: true,
                    iconCls :'no-icon'
                });
                
        return  valustreamTreeNode;
    },
    
    _createMilestoneNode: function(milestoneData){
        //console.log('Percentage Done rec: ', milestoneData.get('StoryProgressPercent').toString());
        var targetProjectName = milestoneData.get('TargetProject') !== null ?  milestoneData.get('TargetProject')._refObjectName : 'Global';
        
        var milestoneTreeNode = Ext.create('MilestoneTreeModel',{
            FormattedID: milestoneData.get('FormattedID'),
            Name: milestoneData.get('Name'),
            TargetDate: milestoneData.get('TargetDate'),
            TargetProject: targetProjectName,
            DisplayColor: milestoneData.get('DisplayColor'),
            Notes: milestoneData.get('Notes'),
            _ref: milestoneData.get('_ref'),
            AcceptedLeafStoryCount: milestoneData.get('AcceptedLeafStoryCount').toString(),
            LeafStoryCount: milestoneData.get('LeafStoryCount').toString(),
            StoryProgressPercent: milestoneData.get('StoryProgressPercent').toString(),
            leaf: true,
            expandable: false,
            expanded: false,
            iconCls :'no-icon'
        });
        
        return milestoneTreeNode;
    },
    
    _getAllAssociatedMilestones: function(valuestream, milestoneStoreData){
        var milestoneColl = [];
        var that = this;
        
        Ext.Array.each(milestoneStoreData, function(milestone) {
            var vsRecord = milestone.get('ValueStream');
            vsRecord = (vsRecord !== null && vsRecord !== '') ? vsRecord : 'N/A';
            
            if(vsRecord === valuestream){
                milestoneColl.push(milestone);
            }
        });
        
        return milestoneColl;
    }
});