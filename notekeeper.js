#!/usr/bin/env node

// Global stuff
    const PATH = require('path');
    const Flow = require('flow-code-description');
    const FILE = require('fs-handy-wraps');
    const PARSER = require('parser-template');
    const UTIL = require('./utilities');
    const {LOG, ERR} = require('./utilities');

    global.G = {
        firstStart: false,
        homedir: PATH.join (require('os').homedir(), 'notekeeper'),
        isStartup: true,
        isLogging: true,
        flowSettings: {isLogging: false},
        base: {},
        view: {},
    };
    G.pathToConfig = PATH.join( G.homedir, 'config.json' );
    
    
const FLOW = new Flow(G.flowSettings);
FLOW.steps = {
    // startup steps
    'start': makeHomedir,
    'home directory is OK': getConfig,
    'config is OK': [ getBase, getBaseTemplate, getInterfaceTemplate, getTreeTemplate ],
    'database is OK': parseBase,
    'template for database is OK': parseBase,
    'base is parsed': renderInterface,
    'interface is prepared': renderInterface,
    'interface is ready to use': [ openTextEditor, detectInterfaceChanges ],

    // change detection and interface's health
    'new data to display for user': renderInterface,
    'interface is broken': showErrorMessage,
    'interface is restored by force': renderInterface,
    'user entered something': [ executeCommands, test ],

    // base/config modifications
    'user added/edited a record': updateBaseFile,
    'base file is updated': nope,
    'user wants to load another base': switchBase,
    'notekeeper is prepared for base loading': getBase,
    'config file is updated': nope,
    
    // other
    'fatal error': closeApp,
    'finish': closeApp,
};
FLOW.done('start');


// STARTUP FUNCTIONS
function makeHomedir() {
    const dir = G.homedir;

    FILE.makeDir (
        dir,
        () => FLOW.done ('home directory is OK', dir)
    );
}
function getConfig(dir) { // TODO: separate CLI and Config file creation
    const defaultValues = {
        pathToBase:             PATH.join( dir, 'base.txt' ),
        pathToBaseTemplate:     PATH.join( dir, 'template_base.txt' ),
        pathToInterface:        PATH.join( dir, 'new_note.txt' ),
        pathToInterfaceTemplate: PATH.join( dir, 'template_interface.txt' ),
        pathToTreeTemplate:     PATH.join( dir, 'template_tree.txt' ),
        editor: 'subl',
        bases: [{ alias: "first", path: "base.txt" }],
    };
    const CLIQuestions = [
        { prop: 'pathToBase', question: 'New config-file will be created. Please, answer on 3 questions. \nFull path to database file (with filename):' },
        { prop: 'pathToInterface', question: 'Path to new Note file:' },
        { prop: 'editor', question: 'Shell command to open your text editor:' },
    ];


    LOG (`trying to read Config: ${G.pathToConfig}`);
    FILE.getConfig (
        G.pathToConfig,
        postprocessConfig,
        defaultValues,
        CLIQuestions
    );

    function postprocessConfig (config) {
        G.config = config;

        FLOW.done('config is OK');
    }
}
function getBase() {
    LOG (`trying to read Database: ${G.config.pathToBase}`);
    FILE.readOrMake(
        G.config.pathToBase,
        storeBaseContent,
        newBaseCreated
    );


    function newBaseCreated (path, content) {
        LOG (`created database file: ${path}`);
        storeBaseContent (content);
    }
    function storeBaseContent (content) {
        G.base.raw = content;
        FLOW.done ('database is OK', content);
    }
}
function getBaseTemplate() {
    let defTemplateText =
    '<><name>\n' +
    '<><tags>\n' +
    '<m><text>\n' +
    '==============================================================================\n';


    LOG (`trying to read Template for Database: ${G.config.pathToBaseTemplate}`);
    FILE.readOrMake (
        G.config.pathToBaseTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText,
    );


    function defTemplateFileCreated (path, content) {

        LOG (`created file for Base Template: ${path}. You may edit it manually.`);
        processTemplate (content);
    }
    function processTemplate (template) {
        G.base.parser = new PARSER (template);

        FLOW.done('template for database is OK');
    }
}
function parseBase() {
    const baseBarser = G.base.parser;
    let data;
    if (G.base.raw === undefined || !baseBarser) return;   // async race


    if (G.base.raw === '') {
        data = baseBarser.parse (baseBarser.template)  // New empty base
        G.emptyBase = true;
    }
    else data = baseBarser.parse (G.base.raw);
    delete G.base.raw;


    data = data instanceof Array ? data : [data]; // if Parser returned only one Record object -> enforce it to be an array.
    data.forEach (record => record.tags = record.tags.trim().split (', ')); // convert tags to Array

    G.base.data = data;
    
    FLOW.done ('base is parsed');
}
function getInterfaceTemplate() {
    let defTemplateText =
    '<m><text>' +
    '\n================================== name ======================================\n' +
    '<><name>' +
    '\n================================== tags ======================================\n' +
    '<><tags>' +
    '\n================================ commands ====================================\n' +
    '<m>add<command>' +
    '\n========================== tags used previously ==============================\n' +
    '<>any tag<tags_used>\n';


    LOG (`trying to read Template for Interface: ${G.config.pathToInterfaceTemplate}`);
    FILE.readOrMake (
        G.config.pathToInterfaceTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText
    );


    function defTemplateFileCreated (path, content) {

        LOG (`created file for Interface Template: ${path}. You may edit it manually.`);
        processTemplate (content);
    }
    function processTemplate (template) {
        let interfaceParser = new PARSER (template);
        G.view.parser = interfaceParser;
        G.view.data = interfaceParser.parse (template)[0];
        G.view.defData = G.view.data;

        FLOW.done('interface is prepared', template);
    }
}
function getTreeTemplate() {
    let defTemplateText =
    '<><name>\n' +
    '<m><text>\n' +
    '~~~\n';


    LOG (`trying to read Template for Tree-view: ${G.config.pathToTreeTemplate}`);
    FILE.readOrMake (
        G.config.pathToTreeTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText
    );


    function defTemplateFileCreated (path, content) {

        LOG (`created file for Tree-view Template: ${path}. You may edit it manually.`);
        processTemplate (content);
    }
    function processTemplate (template) {
        G.view.treeParser = new PARSER (template);
    }
}
function openTextEditor() {  //return FLOW.done('finish'); 
    if (G.view.isEditorOpened) return;

    const config = G.config;
    const shellCommand = `${config.editor} ${config.pathToInterface}`;
    LOG (`opening Text Editor by command: ${shellCommand}`);

    // An example of working shell command for Windows CMD:
    // shellCommand = 'start "" "c:\\Program Files\\Sublime Text 3\\sublime_text.exe"';

    require ('child_process').exec (shellCommand, callback);
    function callback (error, stdout, stderr) {
        error && console.error ('error: ', error);
        stdout && console.error ('stdout: ', stdout);
        stderr && console.error ('stderr: ', stderr);
    }
    G.view.isEditorOpened = true;
}
function detectInterfaceChanges() {
    const interfaceFile = G.config.pathToInterface;
    LOG ('detecting changes of Interface File...');


    G.isStartup = false; // Notekeeper is started
    FILE.watch (interfaceFile, readInterfaceFile);


    function readInterfaceFile() { // called every time interfaceFile is saved
        // interface must be read only after external changes made by User
        // internal changes affect on a "dontRead" Flag only
        if (G.view.dontRead) return G.view.dontRead = false;

        FILE.read (
            interfaceFile,
            parseInterface
        );

        function parseInterface (content) {
            let interface = G.view.parser.parse (content)[0];


            if (!interface) return FLOW.done ('interface is broken');

            interface.tags = UTIL.prettifyList (interface.tags);
            G.view.data = interface;

            FLOW.done('user entered something', interface);
        }
    }
}


// INTERFACE RENDERING
function renderInterface() {
    const pathToInterface = G.config.pathToInterface;
    let base = G.base.data;
    let interface = G.view.data;
    if (!base || !interface) return;   // async race


    let tagsUsed = UTIL.getUsedTags (base);
    if (tagsUsed.length) interface.tags_used = tagsUsed;
    else interface.tags_used = G.view.defData.tags_used;


    let interfaceText = G.view.parser.stringify (interface); // Rendering text interface

    if (!G.isStartup) G.view.dontRead = true; // prevent reading of InterfaceFile
    FILE.write(
        pathToInterface,
        interfaceText,
        () => G.isStartup && FLOW.done ('interface is ready to use') // this is performed only once till the startup
    );
}
function showErrorMessage(message) {
    const forcedRestoration = G.view.needsRestoration; // it's false on the first appear
    let mesBroken = 
        '\n\n                    INTERFACE IS BROKEN !\n'+
        'PLEASE, FIX IT MANUALLY OR IT WILL BE RESTORED WITH POSSIBLE DATA LOSS';
    let msg = message || mesBroken;
    
    
    if (forcedRestoration) {
        message = '';
        G.view.needsRestoration = false;
    } else {
        ERR (msg);
        G.view.needsRestoration = true;
    }
    
    G.view.dontRead = true;
    FILE.append (
        G.config.pathToInterface,
        msg,
        () => forcedRestoration && FLOW.done ('interface is restored by force') // rendering of restored interface
    );
}


// ACTIONS
function nope() {/*do nothing*/}
function executeCommands(interface) {
    const base = G.base.data;
    const baseParser = G.base.parser;
    const duplicateIndex = UTIL.searchDuplicate (base, interface.name);
    let commandLine = interface.command.split ('\n')[0];
    let command = commandLine.split (' ')[0];
    let commandArgs = commandLine.split (' ').slice(1);
    let msg = '';

    const commandsList = {
        '': command_empty,
        'add': command_add,
        'mix': command_mix,
        'edit': command_edit,
        'del': command_delete,
        'clr': command_clear,
        'last': command_lastRecord,
        'tree': command_tree,
        'load': command_loadBase,
        'exit': command_exit,
    };
    const m = {
        empty: `THE TEXT FIELD IS EMPTY.\nTHIS RECORD WILL NOT BE ADDED TO THE BASE.`,
        newNoname: `NEW UNNAMED RECORD WAS PUSHED TO THE BASE.`,
        newNamed: `NEW RECORD NAMED "${interface.name}"\nWAS PUSHED TO THE BASE.`,
        existsMix: `A RECORD NAMED "${interface.name}"\nALREADY EXISTS.\nMIX WITH IT?`,
        mixed: `RECORDS NAMED "${interface.name}"\nWERE MIXED.`,
        addNew: `ADD A NEW RECORD TO THE BASE?`,
        edited: `A RECORD NAMED "${interface.name}"\nWAS SUCCESSFULLY EDITED.`,
        deleted: `A RECORD NAMED "${interface.name}"\nWAS DELETED.`,
        wrongCommand: `A COMMAND "${command}" DOES NOT EXIST.`
    };


    LOG ('executing command: '+ command);
    try {
        commandsList[command](commandArgs);
    } catch (e) {
        msg = m.wrongCommand;
        ERR (m.wrongCommand);
        console.log(e);
    }
    interface.command = commandLine + (msg ? "\n" + msg : "");
    FLOW.done("new data to display for user", interface);




    function command_empty() {
        // LOG ('nothing :)\n');
    }
    function command_clear() {
        interface.text = '';
        interface.name = '';
        interface.tags = '';
        commandLine = 'add';
    }
    function command_exit() {
        FLOW.done ('finish', 'Tot ziens!\n');
    }

    function command_add() {
        if (duplicateIndex == -1) { // There are no Records in the Base with the same name as a New Note has

            if (!interface.text) {
                msg = m.empty;
            } else {
                if (!interface.name) {
                    msg = m.newNoname;
                } else {
                    msg = m.newNamed;
                }
                pushNewRecordToBase ();
                updateBaseFile();
            }
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.existsMix;
            commandLine = 'mix';
        }
    }
    function command_mix() {
        const duplicateIndex = UTIL.searchDuplicate (base, interface.name);

        if (duplicateIndex == -1) {
            msg = m.addNew;
            commandLine = 'add';
        } else {
            msg = m.mixed;
            commandLine = 'edit';
            concatRecords (duplicateIndex); // Shows a Record combined from New Note and existing one. Does not change the Base.
        }
    }
    function command_edit() {
        const duplicateIndex = UTIL.searchDuplicate (base, interface.name);

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = m.addNew;
            commandLine = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.edited;
            deleteBaseRecord (duplicateIndex);
            pushNewRecordToBase ();
            updateBaseFile();
        }
    }
    function command_delete() {
        const duplicateIndex = UTIL.searchDuplicate (base, interface.name);

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = m.addNew;
            commandLine = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.deleted;
            deleteBaseRecord (duplicateIndex);
            updateBaseFile();
        }
    }

    // UNSTABLE
    function command_lastRecord() {
        const record = base[base.length-1];

        interface.text = record.text;
        interface.name = record.name;
        interface.tags = record.tags;

        msg = `THE LAST RECORD IS LOADED`;
        commandLine = 'edit';
    }
    function command_loadBase(params) {
        if (params && params[0]) {
            const alias = params[0];
            let config = G.config;
            let baseIndex = config.bases.findIndex(b => b.alias === alias);
            
            if (baseIndex === -1) {
                msg = `BASE "${alias}" \nIS NOT FOUND`;
            } else {
                if (baseIndex === 0) {
                    msg = `BASE "${alias}" \nIS USED RIGHT NOW`;
                } else {
                    UTIL.swap(config.bases, 0, baseIndex);
                    config.pathToBase = config.bases[0].path;

                    commandLine = 'add';
                    msg = `BASE IS SWITCHED TO \n"${alias}"`;
                    FLOW.done('user wants to load another base', config);
                }
            }
        } else {
            commandLine = 'add';
            msg = "THE BASE IS RELOADED";
            FLOW.done('notekeeper is prepared for base loading');
        }
    }
    function command_tree(args) {
        const time = UTIL.clock();
        const rootId = args[0] ? UTIL.searchDuplicate (base, args[0]) : null;
        if (rootId === -1) {
            msg = `RECORD "${root} IS NOT FOUND"`;
            return;
        }

        const treeString = G.view.treeParser.stringify (UTIL.treeView (base, rootId), indent);
        interface.text = treeString;
        msg = '"generation time: '+ UTIL.clock (time) +'ms"';
        commandLine = 'clr';

        
        function indent (string, tabwidth) {
            let padding = Array (tabwidth).join ('  ');
            return string
                .split ('\n')
                .map ((line, i) => padding + ( i>0 ? '  ' : '' ) + line) // additional padding for non-first lines
                .join ('\n') + '\n';
        }
    }



    // Utility functions
        function concatRecords (index) { // Mutates New Note in the Interface
            let baseRecord = base[index];

            interface.tags = UTIL.concatUniqTags (baseRecord.tags, interface.tags);
            interface.text = UTIL.concatUniqText (baseRecord.text, interface.text);
        }
        function pushNewRecordToBase () {
            G.base.data.push ( baseParser.filterObject (interface) );
        }
        function deleteBaseRecord (index) {
            base.splice (index, 1);
        }
        function updateBaseFile () { // Mutates Base File !
            FLOW.done('user added/edited a record');
        }
}
function updateBaseFile() { // Mutates a Base File !
    const base = G.base.data;
    if (G.emptyBase) {
        G.emptyBase = false;
        base.shift();
    }
    // console.log(G.base.parser.stringify (base));
    FILE.write (
        G.config.pathToBase,
        G.base.parser.stringify (base),
        () => FLOW.done ('base file is updated')
    );
}
function switchBase(newConfig) { // Mutates a Config File !
    FILE.write(
        G.pathToConfig,
        JSON.stringify (newConfig, null, 2),
        () => FLOW.done ('config file is updated')
    );
    FLOW.done('notekeeper is prepared for base loading');
}


function closeApp(param) {
    LOG (param);
    process.exit ();
}
function test(param) {
    //process.exit ();
}
