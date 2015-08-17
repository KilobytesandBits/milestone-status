Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    getSettingsFields: function() {
        return [
            {
                name: 'notesFilter',
                xtype: 'rallytextfield',
                fieldLabel: 'Notes Filter'    
            }
        ];
    },
    
    launch: function() {
        
        //TODO: build collection of current project and all children
        //Filter out milestones based on the projects in the collection
        var context = this.getContext();
        var project = context.getProject();
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'milestone',
            autoLoad: true,
            filters: this._getMilestoneFilters(),
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
    
    _getMilestoneFilters: function() {
        var filters = [
            {
                    property: 'TargetDate',
                    operator: '>=',
                    value: 'today'
            }   
        ];
        
        //only apply filtering on the notes field if configured
        if (this.getSetting('notesFilter')) {
            filters.push(
                {
                    property: 'Notes',
                    operator: 'contains',
                    value: this.getSetting('notesFilter')
                }
            );
        }
        
        return filters;
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
