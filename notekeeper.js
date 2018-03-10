#!/usr/bin/env node

// Global stuff
    const PATH = require('path');
    const Flow = require('flow-code-description');
    const FILE = require('fs-handy-wraps');
    const UTIL = require('./utilities');
    const HOMEDIR = require('os').homedir();

    global.G = {
        isStartup: true,
        isLogging: true,
        isFlowLogging: false,
        base: {},
        view: {},
    };
    const FLOW = new Flow({isLogging: G.isFlowLogging});


FLOW.steps = {
    // startup steps
    'start': getConfig,
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
function getConfig() { // TODO: separate CLI and Config file creation
    const pathToConfig = PATH.join( HOMEDIR, 'notekeeper_config.json' );
    const defPathToBase = PATH.join( HOMEDIR, 'notekeeper_base.txt' );
    const defPathToInterface = PATH.join( HOMEDIR, 'notekeeper_note.txt' );
    const CLIQuestions = [
        { prop: 'pathToBase', question: 'New config-file will be created. Please, answer on 3 questions. \nFull path to database file (with filename):', def: defPathToBase },
        { prop: 'pathToInterface', question: 'Path to new Note file:', def: defPathToInterface },
        { prop: 'editor', question: 'Shell command to open your text editor:', def: 'subl' },
    ];


    log(`trying to read config: ${pathToConfig}`);
    FILE.getConfig(
        pathToConfig,
        CLIQuestions,
        postprocessConfig
    );

    function postprocessConfig (config) {
        config.pathToBaseTemplate = PATH.join( HOMEDIR, 'notekeeper_template_base.txt' );
        config.pathToInterfaceTemplate = PATH.join( HOMEDIR, 'notekeeper_template_interface.txt' );

        G.config = config;

        FLOW.done('config is OK');
    }
}
function getBase() {
    const newBaseContent = '';

    log (`trying to read database: ${G.config.pathToBase}`);
    FILE.readOrMake(
        G.config.pathToBase,
        (content) => FLOW.done ('database is OK', content),
        newBaseCreated,
        newBaseContent
    );


    function newBaseCreated (path, content) {
        log (`created database file: ${path}`);

        FLOW.done ('database is OK', content);
    }
}
function getBaseTemplate() {
    let defTemplateText =
    '<name><>\n' +
    '<tags><>\n' +
    '<text><m>\n' +
    '==============================================================================\n';


    log (`trying to read Template for Database parsing: ${G.config.pathToBaseTemplate}`);
    FILE.readOrMake (
        G.config.pathToBaseTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText,
    );


    function defTemplateFileCreated (path, content) {

        log(`created file for Base Template: ${path}. You may edit it manually.`);
        processTemplate (content);
    }
    function processTemplate (template) {
        G.base.parser = UTIL.createParser (template);

        FLOW.done('template for database is OK');
    }
}
function parseBase(base) {
    let parser = G.base.parser;
    if (base === undefined || !parser) return;   // async race

    let data = UTIL.parse (base, parser);
    if (data instanceof Array) 
        G.base.data = data;
    else 
        G.base.data = [data];   // Base must be an array of Records even it's empty

    FLOW.done ('base is parsed');
}
function getInterfaceTemplate() {
    let defTemplateText =
    '<text><m>' +
    '\n================================== tags ======================================\n' +
    '<tags><>' +
    '\n================================ commands ====================================\n' +
    '<commands>add<m>' +
    '\n========================== tags used previously ==============================\n' +
    '<tags_used>___any_tag<>';


    log (`trying to read text interface from file: ${G.config.pathToInterfaceTemplate}`);
    FILE.readOrMake (
        G.config.pathToInterfaceTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText
    );


    function defTemplateFileCreated (path, content) {

        log(`created file for Interface Template: ${path}. You may edit it manually.`);
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
    log(`trying to open Text Editor by command: ${shellCommand}`);


    // An example of working shell command for Windows CMD
    // shellCommand = 'start "" "c:\\Program Files\\Sublime Text 3\\sublime_text.exe"';
    const exec = require ('child_process').exec;
    exec (shellCommand, callback);
    function callback (error, stdout, stderr) {
        // console.log (error, stdout, stderr)
    }


    G.view.isEditorOpened = true;
}
function detectInterfaceChanges() {
    const interfaceFile = G.config.pathToInterface;
    log('detecting changes of Interface File...');


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


    let interfaceText = UTIL.stringifyInterface (interface, G.view.parser); // Rendering text interface


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
    log ('trying to execute command: '+ command);


    const commandsList = {
        '': command_empty,
        'add': command_add,
        'edit': command_edit,
        'del': command_delete,
        'clear': command_clear,
        'exit': command_exit,
    };
    commandsList[command]();
    interface.command = command + (msg? '\n\n'+ msg : '');
    FLOW.done ('interface is refreshed', interface);


    function command_empty() {

        log ('nothing :)\n');
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
            // console.log ( UTIL.stringifyBase (base, baseParser) );
            FILE.write (
                G.config.pathToBase,
                UTIL.stringifyBase (base, baseParser),
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
    err (msg);


    FILE.append (
        G.config.pathToInterface,
        msg,
        () => restore && FLOW.done ('interface is restored')
    );
}
function closeApp(param) {
    log (param);
    process.exit ();
}


// CONSOLE LOGGING
    function log (msg) {
        G.isLogging && console.log ('\x1b[2m%s\x1b[0m', msg);
    }
    function err(msg) {
        console.log ('\x1b[31m%s\x1b[0m', msg);
    }


/*
function parseTabulation(argument) {
    const arr = [];
    let spaces = 0;
    let line = '';
    for (let i = 0; i < base.length; i++) {
        let char = base[i];

        if (char === '\n') {        // End of a line
            arr.push({'spaces': spaces, 'line': line});

            line = '';
            spaces = 0;
        } else {
            if (!line) {
                if (char === ' ') {     // somewhere inside a Tabulation
                    spaces++;
                } else {
                    line += char;       // Start of a line
                }
            } else {                    // somewhere inside a line
                line += char;
            }
        }
    }
    arr.push({'spaces': spaces, 'line': line});     // The last line
    console.log(arr);
}
*/