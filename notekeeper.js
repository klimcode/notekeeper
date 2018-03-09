#!/usr/bin/env node

// Global stuff
    const PATH = require('path');
    const Flow = require('flow-code-description');
    const FILE = require('fs-handy-wraps');
    const UTIL = require('./utilities');
    const HOMEDIR = require('os').homedir();

    const FLOW = new Flow();
    global.G = {
        isStartup: true,
        base: {},
        view: {},
    };


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
    'interface must be restored': renderInterface,
    'note is saved to database': renderInterface,
    'update existing record?': renderInterface,

    // messaging
    'problem with interface': writeMessageToInterface,
    'problem with interface solved': removeMessageFromInterface,
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


    console.log(`trying to read config: ${pathToConfig}`);
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

    console.log (`trying to read database: ${G.config.pathToBase}`);
    FILE.readOrMake(
        G.config.pathToBase,
        (content) => FLOW.done ('database is OK', content),
        newBaseCreated,
        newBaseContent
    );


    function newBaseCreated (path, content) {
        console.log (`created database file: ${path}`);

        FLOW.done ('database is OK', content);
    }
}
function getBaseTemplate() {
    let defTemplateText =
    '<text><>' +
    '\n================================== tags ======================================\n' +
    '<tags><>' +
    '\n================================ commands ====================================\n' +
    '<commands>save<>' +
    '\n========================== tags used previously ==============================\n' +
    '<tags_used>___any_tag<>';


    console.log (`trying to read Template for Database parsing: ${G.config.pathToBaseTemplate}`);
    FILE.readOrMake (
        G.config.pathToBaseTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText,
    );


    function defTemplateFileCreated (path, content) {

        console.log(`created file for Base Template: ${path}. You may edit it manually.`);
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
    '<text><>' +
    '\n================================== tags ======================================\n' +
    '<tags><>' +
    '\n================================ commands ====================================\n' +
    '<commands>save<>' +
    '\n========================== tags used previously ==============================\n' +
    '<tags_used>___any_tag<>';


    console.log (`trying to read text interface from file: ${G.config.pathToInterfaceTemplate}`);
    FILE.readOrMake (
        G.config.pathToInterfaceTemplate,
        processTemplate,
        defTemplateFileCreated,
        defTemplateText
    );


    function defTemplateFileCreated (path, content) {

        console.log(`created file for Interface Template: ${path}. You may edit it manually.`);
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
    console.log(`trying to open Text Editor by command: ${shellCommand}`);


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
    console.log('watching on Interface File...');


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
    FILE.write(
        pathToInterface,
        interfaceText,
        () => G.isStartup && FLOW.done ('interface is ready to use') // this is performed only once till the startup
    );
}








function executeCommands(interface) {
    const base = G.base.data;
    const baseParser = G.base.parser;
    const command = interface.command;
    console.log ('trying to execute command: '+ command);


    const commandsList = {
        '': doNothing,
        'add': addNewRecord,
        'update': updateExistingNote,
        'clear': clearInterface,
        'exit': exit,
    };
    commandsList[command]();


    function doNothing() {

        console.log ('nothing :)\n');
    }
    function clearInterface() {
        newNote.note = '';
        interface = UTIL.updateArrByObj(interface, newNote);

        FLOW.done('interface must be restored', interface);
    }
    function exit() {

        FLOW.done('finish', 'Tot ziens!\n');
    }




    function addNewRecord() {
        const nameDuplicatedIndex = checkNamesForDuplicate (base, interface.name);


console.log ('***************************** executeCommands \n\n', G.view.data);
// console.trace('_________')
/*▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐▐

        if (nameDuplicatedIndex == -1) { // There are no duplicates in the Base

            G.baseParsed.push ( record (newNote, template) );
        } else { // The base has already had a record with the same name as a New Note has

            newNote.command = 'update';
            mixWithExistingRecord (newNote, base[nameDuplicatedIndex]);
        }

        updateInterface();
/**/
    }


    function updateExistingNote() {
        const nameDuplicatedIndex = checkNamesForDuplicate();

        if (nameDuplicatedIndex == -1) { // There are no duplicates in the Base

            newNote.command = 'add';
        } else { // The base has already had a record with the same name as a New Note has

            G.baseParsed.splice (nameDuplicatedIndex, 1);     // delete an old record
            G.baseParsed.push ( record (newNote, template) ); // push a new record
        }

        updateInterface();
    }

    // Utility functions
        function checkNamesForDuplicate (base, newName) {
            return newName ?
                base.findIndex (record => record.name.toLowerCase() === newName.toLowerCase() ) :
                -1;     // empty name equals to uniq name
        }
        function record (note, template) {

            return record = Object.assign(...template.props.map( prop => ({[prop]: note[prop]}) ) );
        }
        function mixWithExistingRecord (note, existedRecord) { // Mutates Note

            note.tags = UTIL.concatTagsUniq (existedRecord.tags, note.tags);
            note.text = UTIL.concatTextUniq (existedRecord.text, note.text);
        }
        function updateInterface (){
            newNote.tags_used = UTIL.concatTagsUniq (newNote.tags_used, newNote.tags).join (', ');
            interface = UTIL.updateArrByObj(interface, newNote);
            FLOW.done('note is saved to database', interface);

            console.log( UTIL.stringifyBase (base, template) );
            // FILE.append(
            //     G.config.pathToBase,
            //     UTIL.stringifyNote (newNote, template),
            //     () => FLOW.done(FLOWresult, interface)
            // );
        }
}


function writeMessageToInterface(message) {
    G.viewMsg = message;
    G.view.dontRead = true;
    console.log('\x1b[31m%s\x1b[0m', message);

    FILE.append(
        G.config.pathToInterface,
        message
    );
}
function removeMessageFromInterface(content) {
    const message = G.viewMsg;
    G.viewMsg = '';
    G.view.dontRead = true;

    const textWithMsg = content || '';
    const textWithoutMsg = textWithMsg.split(message)[0];


    FILE.write(
        G.config.pathToInterface,
        textWithoutMsg
    );
}
function closeApp(param) {
    console.log(param);
    process.exit();
}





/*
function parseInterface (content) {
    let rawText = content;
    const brokenInterfaceMsg =
        '\n\n! Interface is broken !\n\n' +
        'It will be completely restored on next saving.\n' +
        'Please, copy your Note (Ctrl+C).\n' +
        'Then press Ctrl+S and paste it to the restored interface.\n\n' +
        'It also may be restored manually...';


    for (let i = 0; i < interface.length-1; i++) {  // Parsing
        let region = interface[i];
        let delimeter = interface[i+1].delimeter;
        let tempArr = rawText.split(delimeter);

        if (!tempArr[1]) { // Check for the Interface integrity
            if (G.brokenInterface) {
                G.brokenInterface = false;
                return FLOW.done('interface must be restored', interface);
            } else {
                G.brokenInterface = true;
                return FLOW.done('problem with interface', brokenInterfaceMsg);
            }
        }


        region.content = tempArr[0];
        rawText = tempArr.slice(1,tempArr.length).join(delimeter); // rest
    }

    if (G.brokenInterface) {  // Removing message about broken interface
        G.brokenInterface = false;
        FLOW.done('problem with interface solved', content);
    }
}
*/

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