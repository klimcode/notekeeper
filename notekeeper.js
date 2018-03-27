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
    'user added/edited records': updateBaseFile,
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
    let commandLine = interface.command.split ('\n')[0];
    let command = commandLine.split (' ')[0];
    let commandArgs = commandLine.split (' ').slice(1);
    let msg = '';

    const commandsList = {
        '': command_empty,
        'add': command_add,
        'mul': command_addMultiple,
        'adopt': command_adopt,
        'mix': command_mix,
        'get': command_getRecord,
        'edit': command_edit,
        'del': command_delete,
        'ren': command_rename,
        'clr': command_clear,
        'last': command_lastRecord,
        'tree': command_tree,
        'load': command_loadBase,
        'exit': command_exit,
    };


    LOG ('executing command: '+ command);
    try {
        commandsList[command](commandArgs);
    } catch (e) {
        message ('wrongCommand', command);
        ERR ('Error in a command '+ command);
        console.log(e);
    }
    interface.command = commandLine + (msg ? "\n\n" + msg : ""); // Show messages under the command field
    FLOW.done ("new data to display for user", interface);




    function command_empty() {
        // LOG ('nothing :)\n');
    }
    function command_clear() {
        placeRecordToInterface ({});
        commandLine = 'add';
    }
    function command_exit() {
        FLOW.done ('finish', 'Tot ziens!\n');
    }

    function command_add(args) {
        const name = args[0] || interface.name;
        const index = UTIL.searchName (base, name); // check if the Name is existed in the Base

        interface.name = name;
        if (index === -1) { // the Base does not have a Record with the Name specified
            if (args[0]) {
                const tagsFromArgs = args.slice(1).join(' ');
                if (tagsFromArgs) interface.tags = tagsFromArgs;
                if (!interface.text) interface.text = '...';
            }

            if (!interface.text) {
                message ('empty');
            } else {
                if (!interface.name) {
                    message ('newNoname');
                } else {
                    message ('newNamed', name);
                }
                pushNewRecordToBase ();
            }
        } else { // the Name is already existed in the Base
            message ('existsMix', name);
            commandLine = 'mix';
        }
    }
    function command_addMultiple(args) {
        const names = UTIL.prettifyList (args.join(' '));
        const namesUsed = names.filter (n => -1 !== UTIL.searchName (base, n));
        const namesToAdd = names.filter (n => -1 === UTIL.searchName (base, n));

        if (namesToAdd.length) {
            interface.text = interface.text || '...';
            
            if (interface.tags.length) {
                const firstTag = interface.tags[0];
                commandLine = 'tree '+ firstTag;
            }
            
            pushSeveralRecordsToBase (namesToAdd);
            message ('mulAdded', namesToAdd.join(', '));
        } else {
            message ('noAdd');
        }

        if (namesUsed.length) {
            message ('+namesUsed', namesUsed.join(', '), interface.tags.join(', '));
            commandLine = 'adopt '+ namesUsed.join(', ');
        } 
    }
    function command_adopt(args) {
        const names = UTIL.prettifyList (args.join(' '));
        const namesUsed = names.filter (n => -1 !== UTIL.searchName (base, n));
        const namesToAdd = names.filter (n => -1 === UTIL.searchName (base, n));

        if (namesUsed.length) { // There records will be abopted
            namesUsed.forEach (name => {
                const adopted = base[UTIL.searchName (base, name)];
                adopted.tags = UTIL.concatUniqTags (adopted.tags, interface.tags);
            });

            commandLine = 'tree '+ interface.tags[0];
            message ('adopted', namesUsed.join(', '), interface.tags.join(', '));
            FLOW.done ('user added/edited records');
        } else {
            message ('noAdopted');
        }
        
        if (namesToAdd.length) { // There records will be offered to add
            commandLine = 'mul '+ namesToAdd.join(', ');    
            message ('+addMul', namesToAdd.join(', '));
        }
    }
    function command_mix() {
        const name = interface.name;
        const index = UTIL.searchName (base, name); // check if the Name is existed in the Base

        if (index === -1) {
            message ('addNew');
            commandLine = 'add';
        } else {
            message ('mixed', name);
            concatRecords (index); // Makes a Record combined from New Note and existing one. Does not change the Base.
            commandLine = 'edit';
        }
    }
    function command_edit(args) {
        const name = args[0] || interface.name;
        const index = UTIL.searchName (base, name); // check if the Name is existed in the Base

        if (index === -1) { // The Base does not have a Record with a Name specified
            message ('addNew');
            commandLine = 'add';
        } else { // The Record is found and may be edited
            if (!interface.text) {
                message ('empty')
                return;
            }
            message ('edited', name);
            deleteBaseRecord (index);
            pushNewRecordToBase ();
        }
    }
    function command_delete(args) {
        const name = args[0] || interface.name;
        const index = UTIL.searchName (base, name); // check if the Name is existed in the Base

        if (index === -1) { // the Base does not have a Record with the Name specified
            message ('addNew');
            commandLine = 'add';
        } else {
            message ('deleted', name);
            deleteBaseRecord (index);
        }
    }

    function command_getRecord(args) {
        const name = args[0] || interface.name;
        if (!name) {
            message ('whatToShow');
            return;
        }
        const index = UTIL.searchName (base, name);
        if (index === -1) {
            message ('notFound', name);
            return;
        }
        const record = base[index];

        placeRecordToInterface (record);
        message ('');
        commandLine = 'edit';
    }
    function command_lastRecord() {
        const record = base[base.length-1];

        placeRecordToInterface (record);

        message ('last');
        commandLine = 'edit';
    }

    function command_rename(args) {
        const oldName = interface.name;
        if (!oldName) {
            message ('whatToRename');
            return;
        }
        const recordId = UTIL.searchName (base, oldName);
        if (recordId === -1) {
            message ('notFound', oldName);
            return;
        }
        if (!args || !args[0]) {
            message ('whatNewName');
            return;
        }
        const newName = args[0];
        if (UTIL.searchName (base, newName) !== -1) {
            message ('nameUsed', newName);
            return;
        }

        let record = base[recordId];
        record.name = newName;

        base.forEach (rec => { // Renaming all links to the Record
            const tagIndex = rec.tags.findIndex (tag => UTIL.isEqual (tag, oldName));
            if (tagIndex !== -1) {
                rec.tags[tagIndex] = newName;
            }
        });

        
        commandLine = 'tree '+ newName;
        message ('renamed', newName, oldName);
        FLOW.done ('user added/edited records');
    }
    function command_loadBase(args) {
        if (args[0]) {
            const alias = args[0];
            let config = G.config;
            let baseIndex = config.bases.findIndex(b => b.alias === alias);
            
            if (baseIndex === -1) {
                message('baseNotFound', alias)
            } else {
                if (baseIndex === 0) {
                    message('baseUsed', alias);
                } else {
                    UTIL.swap(config.bases, 0, baseIndex);
                    config.pathToBase = config.bases[0].path;

                    commandLine = 'add';
                    message('baseSwitched', alias);
                    FLOW.done('user wants to load another base', config);
                }
            }
        } else {
            commandLine = 'add';
            message('baseReloaded');
            FLOW.done('notekeeper is prepared for base loading');
        }
    }
    function command_tree(args) {
        const time = UTIL.clock();
        const rootName = args[0];
        const rootId = rootName ? UTIL.searchName (base, rootName) : null;
        if (rootId === -1) {
            message ('notFound', rootName);
            return;
        }
        
        const tree = UTIL.buildTree (base, rootId);
        if (tree.error) {
            const victim = tree[0];

            commandLine = 'edit';
            message ('treeError', tree.error.toLowerCase());
            placeRecordToInterface (victim);
            return;
        }

        if (rootId != null) {
            const rootRecord = tree[0];
            rootRecord.name += '    //of: '+ rootRecord.parentNames.join(', ');
        }

        const treeString = G.view.treeParser.stringify (tree, indent);
        interface.text = treeString;
        message ('treeTime', UTIL.clock (time));
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
        function message (code, $1, $2, $3) {
            const m = {
                addNew: `ADD A NEW RECORD TO THE BASE?`,
                empty: `THE TEXT FIELD IS EMPTY. \nTHIS RECORD CAN NOT BE ADDED TO THE BASE.`,
                newNoname: `NEW UNNAMED RECORD WAS PUSHED TO THE BASE.`,
                newNamed: `NEW RECORD NAMED "${$1}" \nWAS PUSHED TO THE BASE.`,
                mulAdded: `NEW RECORDS: "${$1}" \nWERE PUSHED TO THE BASE.`,
                existsMix: `A RECORD NAMED "${$1}" \nALREADY EXISTS. \nMIX WITH IT?`,
                mixed: `RECORDS NAMED "${$1}" \nWERE MIXED.`,
                edited: `A RECORD NAMED "${$1}" \nWAS SUCCESSFULLY EDITED.`,
                deleted: `A RECORD NAMED "${$1}" \nWAS DELETED.`,
                wrongCommand: `A COMMAND "${$1}" DOES NOT WORK.`,

                last: `THIS IS THE LATEST EDITED RECORD.`,
                whatToShow: `WHAT A NAME OF A RECORD TO SHOW?`,
                whatToRename: `WHAT RECORD MUST BE RENAMED?`,
                whatNewName: `WHAT A NEW NAME FOR THIS RECORD?`,
                nameUsed: `A NAME "${$1}" IS ALREADY USED.`,
                namesUsed: `THESE NAMES ARE USED ALREADY: "${$1}" \nLET "${$2}" ADOPT THEM?`,
                noAdd: `NO RECORDS WERE ADDED TO THE BASE.`,
                adopted: `THESE RECORDS: "${$1}" WERE ADOPTED BY: "${$2}"`,
                noAdopted: `RECORDS THOSE DON'T EXIST CAN NOT BE ADOPTED.`,
                addMul: `ADD THESE RECORDS: "${$1}" \nTO THE BASE?`,
                notFound: `A RECORD NAMED "${$1}" IS NOT FOUND.`,
                renamed: `THE NAME IS CHANGED TO "${$1}". \nTHE OLD NAME WAS "${$2}"`,

                baseNotFound: `BASE "${$1}" \nIS NOT FOUND.`,
                baseUsed: `BASE "${$1}" \nIS USED RIGHT NOW.`,
                baseSwitched: `BASE IS SWITCHED TO "${$1}"`,
                baseReloaded: `THE BASE IS RELOADED.`,

                treeError: `ERROR IN TREE-VIEW! \nCIRCULAR LINK: "${$1}" \nCAN BE FIXED MANUALLY.`,
                treeTime: `"Tree generation time: ${$1}ms"`,

                _: `$1 \n$2 \n$3`,
                demo: `SORRY, THIS FUNCTION WILL WORK IN FUTURE VERSIONS. \nCHECK A NEW VERSION OF NOTEKEEPER.`,
            };
            if (!code) {
                msg = '';
                return;
            }
            if (code[0] === '+') {
                code = code.slice(1);
                msg += '\n\n';
            } else {
                msg = '';
            }

            if (m[code]) {
                msg += m[code];
            }
            else {
                msg = `Message with code ${code} is not found`;
                ERR (msg);
            }
        }
        function placeRecordToInterface (record) { 
            interface.text = record.text || '';
            interface.name = record.name || '';
            interface.tags = record.tags || '';
        }
        function concatRecords (index) { // Mutates New Note in the Interface
            let baseRecord = base[index];

            interface.tags = UTIL.concatUniqTags (baseRecord.tags, interface.tags);
            interface.text = UTIL.concatUniqText (baseRecord.text, interface.text);
        }
        function pushNewRecordToBase () {
            G.base.data.push ( baseParser.filterObject (interface) );
            FLOW.done ('user added/edited records');
        }
        function pushSeveralRecordsToBase (names) {
            names.forEach (name => {
                const record = {
                    name,
                    tags: interface.tags,
                    text: interface.text
                };
                G.base.data.push (record);
            });
            FLOW.done ('user added/edited records');
        }
        function deleteBaseRecord (index) {
            base.splice (index, 1);
            FLOW.done ('user added/edited records');
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
