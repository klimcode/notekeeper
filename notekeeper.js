#!/usr/bin/env node

// Global stuff
    const PATH = require('path');
    const Flow = require('flow-code-description');
    const FILE = require('fs-handy-wraps');
    const PARS = require('parser-template');
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
        G.base.parser = PARS.createParser (template);

        FLOW.done('template for database is OK');
    }
}
function parseBase() {
    const parser = G.base.parser;
    let data;
    if (G.base.raw === undefined || !parser) return;   // async race


    if (G.base.raw === '') {
        data = PARS.parse (parser.template, parser)  // New empty base
        G.emptyBase = true;
    }
    else data = PARS.parse (G.base.raw, parser);
    delete G.base.raw;


    data = data instanceof Array ? data : [data]; // if Parser returned only one Record object -> enforce it to be an array.
    data.forEach (record => record.tags = record.tags.split (', '));

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
        G.view.parser = PARS.createParser (template);
        G.view.data = PARS.parse (template, G.view.parser);

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
            let interface = PARS.parse (content, G.view.parser);


            if (!interface) return FLOW.done ('interface is broken');

            interface.tags = UTIL.prettifyList (interface.tags);
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


    let interfaceText = PARS.fillTemplate (interface, G.view.parser); // Rendering text interface

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
    const duplicateIndex = searchDuplicate ();
    let command = interface.command.split ('\n')[0];
    let msg = '';


    const commandsList = {
        '': command_empty,
        'add': command_add,
        'mix': command_mix,
        'edit': command_edit,
        'del': command_delete,
        'clr': command_clear,
        'exit': command_exit,
    };
    const m = {
        empty: `THE TEXT FIELD IS EMPTY.\nIT WILL NOT BE ADDED TO BASE`,
        newNoname: `NEW UNNAMED RECORD WAS PUSHED TO BASE`,
        newNamed: `NEW RECORD NAMED "${interface.name}"\nWAS PUSHED TO BASE`,
        existsMix: `A RECORD NAMED "${interface.name}"\nALREADY EXISTS.\nMIX WITH IT?`,
        mixed: `RECORDS NAMED "${interface.name}"\nWERE MIXED.`,
        addNew: `ADD A NEW RECORD TO THE BASE?`,
        edited: `A RECORD NAMED "${interface.name}"\nWAS SUCCESSFULLY EDITED`,
        deleted: `A RECORD NAMED "${interface.name}"\nWAS DELETED`,
        wrongCommand: `A COMMAND "${command}" DOES NOT EXIST`
    };


    LOG ('trying to execute command: '+ command);
    try {
        commandsList[command]();
    } catch (e) {
        msg = m.wrongCommand;
        ERR (m.wrongCommand + '\n');
    }
    interface.command = command + (msg? '\n'+ msg : '');
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
                updateBaseFile ();
            }
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.existsMix;
            command = 'mix';
        }
    }
    function command_mix() {
        const duplicateIndex = searchDuplicate();

        if (duplicateIndex == -1) {
            msg = m.addNew;
            command = 'add';
        } else {
            msg = m.mixed;
            command = 'edit';
            concatRecords (duplicateIndex); // Shows a Record combined from New Note and existing one. Does not change the Base.
        }
    }
    function command_edit() {
        const duplicateIndex = searchDuplicate();

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = m.addNew;
            command = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.edited;
            deleteBaseRecord (duplicateIndex);
            pushNewRecordToBase ();
            updateBaseFile ();
        }
    }
    function command_delete() {
        const duplicateIndex = searchDuplicate();

        if (duplicateIndex == -1) { // There are no duplicates in the Base
            msg = m.addNew;
            command = 'add';
        } else { // The base has already had a record with the same name as a New Note has
            msg = m.deleted;
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

            G.base.data.push ( PARS.filterObject (interface, baseParser) );
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
            if (G.emptyBase) {
                G.emptyBase = false;
                base.shift();
            }
            // console.log(PARS.fillTemplatesArray (base, baseParser));
            FILE.write (
                G.config.pathToBase,
                PARS.fillTemplatesArray (base, baseParser),
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
