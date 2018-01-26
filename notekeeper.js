#!/usr/bin/env node

const PATH = require('path');
const Flow = require('flow-code-description');
const FILE = require('fs-handy-wraps');
const UTIL = require('./utilities');
const HOMEDIR = require('os').homedir();

const configFilename = 'notekeeper_config.json';
const interfaceFilename = 'notekeeper_interface.txt';
const mainFLOW = new Flow(true);
global.storage = {};



mainFLOW.steps = {
    'start': getConfig,
    'config is OK': getDatabase,
    'database is OK': parseTagsFromBase,
    'tags are parsed from database': createInterface,

    'interface is prepared': updateNotefile,
    'interface is recorded in Notefile': [ openTextEditor, watchInterfaceChanges ],

    'note has been changed': executeCommands,
    'interfase must be restored': updateNotefile,
    'new note saved to database': updateNotefile,

    'problem with interface': writeMessageToInterface,
    'problem with interface solved': removeMessageFromInterface,
    'fatal error': closeApp,
    'finish': closeApp,
};
mainFLOW.result('start');



function getConfig() {
    const pathToConfig = PATH.join( HOMEDIR, 'notekeeper_config.json' );
    const defPathToBase = PATH.join( HOMEDIR, 'notekeeper_base.txt' );
    const defPathToNote = PATH.join( HOMEDIR, 'notekeeper_note.txt' );
    const CLIQuestions = [
        { prop: 'pathToBase', question: 'New config-file will be created. Please, answer on 3 questions. \nFull path to database file (with filename):', def: defPathToBase },
        { prop: 'pathToNotefile', question: 'Path to temp file:', def: defPathToNote },
        { prop: 'editor', question: 'Command to open your text editor:', def: 'subl' },
    ];


    console.log(`trying to read config: ${pathToConfig}`);
    FILE.getConfig(
        pathToConfig,
        CLIQuestions,
        (content) => { storage.config = content; mainFLOW.result('config is OK') }
    );
}
function getDatabase() {
    console.log(`trying to read database: ${storage.config.pathToBase}`);
    FILE.readOrMake(
        storage.config.pathToBase,
        (content) => { mainFLOW.result('database is OK', content) }
    );
}
function parseTagsFromBase(dbContent) {
    let tags = dbContent.match(/\b___\w+/g);
    if (tags) {
        tags = UTIL.removeDuplicatesFrom(tags).sort();
    } else {
        tags = [];
    }

    mainFLOW.result('tags are parsed from database', tags);
}
function createInterface(tagsFromBase) {
    const tagsFromBaseString = tagsFromBase.join(', ');
    const pathToInterface = PATH.join( HOMEDIR, interfaceFilename );
    console.log(`trying to read text interface from file: ${pathToInterface}`);


    FILE.readOrMake(
        pathToInterface,
        parseSavedInterface,
        makeDefaultInterface
    );


    function parseSavedInterface(content) {
        const regex = /([^]*?)<(.*)>(.*)<>/g;
        let interface = content;
        let interfaceLogic = [];
        let matches;


        while ((matches = regex.exec(content)) !== null) {
            if (matches.index === regex.lastIndex) regex.lastIndex++; // This is necessary to avoid infinite loops with zero-width matches


            let record = {
                'delimeter': matches[1],
                'type': matches[2],
                'content': matches[3]
            };
            if (record.type == 'tags_used') {
                if (tagsFromBaseString) {
                    record.content = tagsFromBaseString;
                }
            }
            if (!record.delimeter && interfaceLogic.length) {
                return mainFLOW.result('fatal error', 'delimeters must contain 1 or more symbols');
            }


            interfaceLogic.push(record);
        }

        storage.interfaceLogic = interfaceLogic;


        mainFLOW.result('interface is prepared', interfaceLogic);
    }
    function makeDefaultInterface() {
        console.log(`file is absent...`);

        let interface = `<note><>`;
        interface +=    `\n================================== tags ======================================\n`;
        interface +=    `<tags><>`;
        interface +=    `\n================================ commands ====================================\n`;
        interface +=    `<commands>save<>`;
        interface +=    `\n========================== tags used previously ==============================\n`;
        interface +=    `<tags_used>___any_tag<>`;

        FILE.write(
            pathToInterface,
            interface,
            () => console.log(`created file to store Interface: ${pathToInterface}. It may be edited.`)
        );

        parseSavedInterface(interface);
    }
}


function updateNotefile(interface) {
    const pathToNotefile = storage.config.pathToNotefile;
    let interfaceText = '';


    for (let i = 0; i < interface.length; i++) {
        interfaceText += interface[i].delimeter + interface[i].content;
    }

    if (storage.isWatchingStarted) { // Interface updates must not be detected
        storage.dontReadFile = true;
    }


    FILE.write(
        pathToNotefile,
        interfaceText,
        () => mainFLOW.result('interface is recorded in Notefile', interface)
    );
}
function watchInterfaceChanges(interface) {
    const noteFile = storage.config.pathToNotefile;
    console.log('watching on Note File...');


    if (!storage.isWatchingStarted) { // Make an event for the first time only.
        storage.isWatchingStarted = true;

        FILE.watch(noteFile, readNoteFile);
    }


    function readNoteFile() { // called by tempFile changing
        if (storage.dontReadFile) return storage.dontReadFile = false;

        FILE.read(
            noteFile,
            parseNoteContent
        );
    }
    function parseNoteContent(content) {
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
            let tempArr;


            tempArr = rawText.split(delimeter);

            if (!tempArr[1]) { // Check for the Interface integrity
                if (storage.brokenInterface) {
                    storage.brokenInterface = false;
                    return mainFLOW.result('interfase must be restored', interface);
                } else {
                    storage.brokenInterface = true;
                    return mainFLOW.result('problem with interface', brokenInterfaceMsg);
                }
            }


            region.content = tempArr[0];
            rawText = tempArr.slice(1,tempArr.length).join(delimeter); // rest
        }

        if (storage.brokenInterface) {  // Removing message about broken interface
            storage.brokenInterface = false;
            mainFLOW.result('problem with interface solved', content);
        }


        mainFLOW.result('note has been changed', interface);
    }
}


function openTextEditor() {
    if (storage.isEditorOpened) return;


    const config = storage.config;
    const SPAWN = require('child_process').spawn;
    console.log(`trying to open Text Editor by command: ${config.editor} ${config.pathToNotefile}`);


    let child = SPAWN(config.editor, [config.pathToNotefile]);
    let resp = '';


    storage.isEditorOpened = true;
}
function executeCommands(interface) {
    const controls = UTIL.getObjFromArr(interface);
    const note = controls.note;
    const tagsNew = controls.tags;
    const command = controls.commands;
    console.log('trying to execute command: '+ command);


    const commandsList = {
        '': doNothing,
        'save': saveNote,
        'clear': clearInterface,
        'exit': exit,
    };
    commandsList[command]();


    function doNothing() {

        console.log('nothing :)\n');
    }
    function saveNote() {
        if (!note) return console.log('Empty Note will not be placed to database');


        let tagsArr = (controls.tags_used +', '+ tagsNew).match(/\w+/g);   // New tags added to list of used tags.
        controls.tags_used = UTIL.removeDuplicatesFrom(tagsArr).join(', ');    // Dupes are deleted.
        interface = UTIL.updateArrByObj(interface, controls);


        let textForDatabase = '\n'+
            tagsNew +'\n\n'+
            note + '\n==============================================================================\n';


        FILE.append(
            storage.config.pathToBase,
            textForDatabase,
            () => mainFLOW.result('new note saved to database', interface)
        );
    }
    function clearInterface() {
        controls.note = '';
        interface = UTIL.updateArrByObj(interface, controls);

        mainFLOW.result('interfase must be restored', interface);
    }
    function exit() {
        mainFLOW.result('finish', 'Tot ziens!\n');
    }
}


function writeMessageToInterface(message) {
    storage.interfaceMsg = message;
    storage.dontReadFile = true;
    console.log('\x1b[31m%s\x1b[0m', message);

    FILE.append(
        storage.config.pathToNotefile,
        message
    );
}
function removeMessageFromInterface(content) {
    const message = storage.interfaceMsg;
    storage.interfaceMsg = '';
    storage.dontReadFile = true;

    const textWithMsg = content || '';
    const textWithoutMsg = textWithMsg.split(message)[0];


    FILE.write(
        storage.config.pathToNotefile,
        textWithoutMsg
    );
}
function closeApp(param) {
    console.log(param);
    process.exit();
}