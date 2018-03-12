#!/usr/bin/env node

// Global stuff
    const PATH = require('path');
    const Flow = require('flow-code-description');
    const FILE = require('fs-handy-wraps');
    const UTIL = require('./utilities');

    global.G = {
        firstStart: false,
        homedir: PATH.join (require('os').homedir(), 'notekeeper'),
        isStartup: true,
        isLogging: true,
        flowSettings: {isLogging: true},
        base: {},
        view: {},
    };
    const FLOW = new Flow(G.flowSettings);


FLOW.steps = {
    // startup steps
    'start': makeHomedir,
    'home directory is OK': getConfig,
    'config is OK': [ getBase, getBaseTemplate, getInterfaceTemplate ],
    'database is OK': parseBase,
    'template for database is OK': parseBase,
    'base is parsed': renderInterface,
    'interface is prepared': renderInterface,
    'interface is ready to use': [ openTextEditor, detectInterfaceChanges ],

    // change detection and commands execution
    'interface is changed': executeCommands,
    'interface is refreshed': renderInterface,
    'baseFile is updated': nope,
    'interface is restored': renderInterface,

    // messaging
    'interface is broken': showErrorMessage,
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
    const pathToConfig = PATH.join( dir, 'config.json' );
    const defaultValues = {
        pathToBase:             PATH.join( dir, 'base.txt' ),
        pathToBaseTemplate:     PATH.join( dir, 'template_base.txt' ),
        pathToInterface:        PATH.join( dir, 'new_note.txt' ),
        pathToInterfaceTemplate: PATH.join( dir, 'template_interface.txt' ),
        editor: 'subl',
    };
    const CLIQuestions = [
        { prop: 'pathToBase', question: 'New config-file will be created. Please, answer on 3 questions. \nFull path to database file (with filename):' },
        { prop: 'pathToInterface', question: 'Path to new Note file:' },
        { prop: 'editor', question: 'Shell command to open your text editor:' },
    ];


    LOG (`trying to read config: ${pathToConfig}`);
    FILE.getConfig (
        pathToConfig,
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
    LOG (`trying to read database: ${G.config.pathToBase}`);
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


    LOG (`trying to read Template for Database parsing: ${G.config.pathToBaseTemplate}`);
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
        G.base.parser = UTIL.createParser (template);

        FLOW.done('template for database is OK');
    }
}
function parseBase() {
    const baseString = G.base.raw;
    const parser = G.base.parser;
    if (baseString === undefined || !parser) return;   // async race


    let data;
    if (baseString === '') {
        data = UTIL.parse (parser.template, parser)  // New empty base
        G.emptyBase = true;
    }
    else data = UTIL.parse (baseString, parser);


    if (!(data instanceof Array)) 
        G.base.data = [data];   // Parser returned only one Record object. Enforce it to be a array.
    else 
        G.base.data = data;


    delete G.base.raw;

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


    LOG (`trying to read text interface from file: ${G.config.pathToInterfaceTemplate}`);
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
        G.view.parser = UTIL.createParser (template);
        G.view.data = UTIL.parse (template, G.view.parser);

        FLOW.done('interface is prepared', template);
    }
}
function openTextEditor() {
    if (G.view.isEditorOpened) return;


    const config = G.config;
    const shellCommand = `${config.editor} ${config.pathToInterface}`;
    LOG (`trying to open Text Editor by command: ${shellCommand}`);

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
            let interface = UTIL.parse (content, G.view.parser);


            if (!interface) return FLOW.done ('interface is broken');

            interface.tags = UTIL.prettifyTagsList (interface.tags);
            G.view.data = interface;

            FLOW.done('interface is changed', interface);
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


    let interfaceText = UTIL.stringifyObj (interface, G.view.parser); // Rendering text interface

    if (!G.isStartup) G.view.dontRead = true; // prevent reading of InterfaceFile
    G.view.needRestoration = false; // Interface is restored
    FILE.write(
        pathToInterface,
        interfaceText,
        () => G.isStartup && FLOW.done ('interface is ready to use') // this is performed only once till the startup
    );
}


// ACTIONS
function nope() {/*nothing*/}
function executeCommands(interface) {
    const base = G.base.data;
    const baseParser = G.base.parser;
    let command = interface.command.split ('\n')[0];
    let msg = '';
    LOG ('trying to execute command: '+ command);


    const commandsList = {
        '': command_empty,
        'add': command_add,
        'edit': command_edit,
        'del': command_delete,
        'clr': command_clear,
        'exit': command_exit,
    };
    commandsList[command]();
    interface.command = command + (msg? '\n\n'+ msg : '');
    FLOW.done ('interface is refreshed', interface);


    function command_empty() {

        LOG ('nothing :)\n');
    }
    function command_clear() {
        interface.text = '';
        interface.name = '';
        interface.tags = '';
    }
    function command_exit() {

        FLOW.done ('finish', 'Tot ziens!\n');
    }

    function command_add() {
        const duplicateIndex = searchDuplicate ();

        if (duplicateIndex == -1) { // There are no Records in the Base with the same name as a New Note has

            if (!interface.text) {
                msg = `THE TEXT IS EMPTY. IT WILL NOT BE ADDED TO BASE`;
            } else {
                if (!interface.name) {
                    msg = `NEW UNNAMED RECORD WAS PUSHED TO BASE`;
                } else {
                    msg = `NEW RECORD NAMED "${interface.name}" WAS PUSHED TO BASE`;
                }
                pushNewRecordToBase ();
                updateBaseFile ();
            }
        } else { // The base has already had a record with the same name as a New Note has
            msg = `A RECORD NAMED "${interface.name}" ALREADY EXISTS. EDIT IT?`;
            command = 'edit';
            concatRecords (duplicateIndex); // Shows a Record combined from New Note and existing one. Does not change the Base.
        }
    }
    function command_edit() {
        const duplicateIndex = searchDuplicate();

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = `ADD A NEW RECORD NAMED "${interface.name}" TO THE BASE?`;
            command = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = `A RECORD NAMED "${interface.name}" WAS SUCCESSFULLY EDITED`;
            deleteBaseRecord (duplicateIndex);
            pushNewRecordToBase ();
            updateBaseFile ();
        }
    }
    function command_delete() {
        const duplicateIndex = searchDuplicate();

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = `ADD A NEW RECORD NAMED "${interface.name}" TO THE BASE?`;
            command = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = `A RECORD NAMED "${interface.name}" IS DELETED`;
            deleteBaseRecord (duplicateIndex);
            updateBaseFile ();
        }
    }

    // Utility functions
        function searchDuplicate () {
            let newName = interface.name;
            return newName ?
                base.findIndex (record => record.name.toLowerCase() === newName.toLowerCase() ) :
                -1;     // empty name equals to uniq name
        }
        function pushNewRecordToBase () {

            G.base.data.push ( UTIL.convertToBaseRecord (interface, baseParser) );
        }
        function concatRecords (index) { // Mutates New Note in the Interface
            let baseRecord = base[index];

            interface.tags = UTIL.concatUniqTags (baseRecord.tags, interface.tags);
            interface.text = UTIL.concatUniqText (baseRecord.text, interface.text);
        }
        function deleteBaseRecord (index) {

            base.splice (index, 1);
        }

        function updateBaseFile () {
            // console.LOG ( UTIL.stringifyArr (base, baseParser) );
            if (G.emptyBase) {
                G.emptyBase = false;
                base.shift();
            }
            FILE.write (
                G.config.pathToBase,
                UTIL.stringifyArr (base, baseParser),
                () => FLOW.done ('baseFile is updated')
            );
        }
}
function showErrorMessage(message) {
    const restore = G.view.needRestoration;
    let mesBroken = 
        '\n\n                    INTERFACE IS BROKEN !\n'+
        'PLEASE, FIX IT MANUALLY OR IT WILL BE RESTORED WITH POSSIBLE DATA LOOSING';
    if (G.view.needRestoration) mesBroken = '';
    let msg = message || mesBroken;


    G.view.needRestoration = true;
    G.view.dontRead = true;
    ERR (msg);


    FILE.append (
        G.config.pathToInterface,
        msg,
        () => restore && FLOW.done ('interface is restored')
    );
}
function closeApp(param) {
    LOG (param);
    process.exit ();
}


// CONSOLE LOGGING
    function LOG (msg) {
        G.isLogging && console.log ('\x1b[2m%s\x1b[0m', msg);
    }
    function ERR (msg) {
        console.log ('\x1b[31m%s\x1b[0m', msg);
    }
