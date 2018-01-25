#!/usr/bin/env node

const PATH = require('path');
const Flow = require('flow-code-description');
const FILE = require('fs-handy-wraps');
const UTIL = require('./utilities');
const HOMEDIR = require('os').homedir();

const configFilename = 'notekeeper_config.json';
const interfaceFilename = 'interface.txt';
const mainFLOW = new Flow(true);
global.storage = {};



mainFLOW.steps = {
    'start': getConfig,
    'config is OK': getDatabase,
    'database is OK': parseTagsFromBase,
    'tags are parsed from database': createInterface,
    'interface created': updateInterface,
    'interface is recorded in Notefile': [ openTextEditor, watchInterfaceChanges ],
    'interfase must be restored': updateInterface,
    'note has been changed': executeCommands,
    'new note saved to database': updateInterface,

    'problem with interface': writeMessageToInterface,
    'problem with interface solved': removeMessageFromInterface,
    'fatal error': closeApp,
    'finish': closeApp,
};
mainFLOW.to('start');



function getConfig() {
    const pathToConfig = PATH.join( HOMEDIR, 'notekeeper_config.json' );
    console.log(`trying to read config: ${pathToConfig}`);
    FILE.getConfig(
        pathToConfig,
        (content) => { storage.config = content; mainFLOW.to('config is OK', content) }
    );
}
function getDatabase() {
    console.log(`trying to read database: ${storage.config.dbPath}`);
    FILE.readOrMake(
        storage.config.dbPath,
        (content) => { mainFLOW.to('database is OK', content) }
    );
}
function parseTagsFromBase(dbContent) {
    let tags = dbContent.match(/\b___\w+/g);
    if (tags) {
        tags = UTIL.removeDuplicatesFrom(tags);
    } else {
        tags = [];
    }
    tags = tags.sort();

    mainFLOW.to('tags are parsed from database', tags);
}
function createInterface(tagsFromBase) {
    const pathToInterface = PATH.join( HOMEDIR, interfaceFilename );
    console.log(`trying to read text interface from file: ${pathToInterface}`);


    FILE.readOrMake(
        pathToInterface,
        parseSavedInterface,
        makeDefaultInterface
    );


    function makeDefaultInterface() {
        console.log(`Default Interface will be created`);


        let interface = `<note><>`;
        interface +=    `\n================================== tags ======================================\n`;
        interface +=    `<tags><>`;
        interface +=    `\n================================ commands ====================================\n`;
        interface +=    `<commands>save<>`;
        interface +=    `\n============================ tags used previously ============================\n`;
        interface +=    `<tags_used>___sometag<>`;

        FILE.write(
            pathToInterface,
            interface,
            () => console.log('interface storing file crated. You may edit it for next usage.')
        );

        parseSavedInterface(interface);
    }
    function parseSavedInterface(content) {
        const regex = /([^]*?)<(.*)>(.*)<>/g;
        let interface = content;
        let interfaceProto = [];
        let matches;


        while ((matches = regex.exec(content)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (matches.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            let record = {
                'title': matches[1],
                'type': matches[2],
                'content': matches[3]
            };
            if (record.type == 'tags_used') {
                record.content = tagsFromBase.join(', ');
            }
            if (!record.title && interfaceProto.length) {
                return mainFLOW.to('fatal error', 'Titles must contain 1 or more symbols');
            }


            interfaceProto.push(record);
        }

        storage.interfaceProto = interfaceProto;


        mainFLOW.to('interface created', interfaceProto);
    }
}
function updateInterface(interface) {
    const pathToTempFile = storage.config.tempPath;
    let interfaceText = '';

    for (let i = 0; i < interface.length; i++) {
        interfaceText += interface[i].title + interface[i].content;
    }

    if (storage.isWatchingStarted) { // Interface updates must not be detected
        storage.dontReadFile = true;
    }

    FILE.write(
        pathToTempFile,
        interfaceText,
        () => mainFLOW.to('interface is recorded in Notefile', interface)
    );
}
function watchInterfaceChanges(interface) {
    const noteFile = storage.config.tempPath;
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
            let delimeter = interface[i+1].title;
            let tempArr;


            tempArr = rawText.split(delimeter);

            if (!tempArr[1]) { // Check for the Interface integrity
                if (storage.brokenInterface) {
                    storage.brokenInterface = false;
                    return mainFLOW.to('interfase must be restored', interface);
                } else {
                    storage.brokenInterface = true;
                    return mainFLOW.to('problem with interface', brokenInterfaceMsg);
                }
            }


            region.content = tempArr[0];
            rawText = tempArr.slice(1,tempArr.length).join(delimeter); // rest
        }

        if (storage.brokenInterface) {  // Removing message about broken interface
            storage.brokenInterface = false;
            mainFLOW.to('problem with interface solved', content);
        }


        mainFLOW.to('note has been changed', interface);
    }
}
function writeMessageToInterface(message) {
    storage.interfaceMsg = message;
    storage.dontReadFile = true;
    console.log('\x1b[31m%s\x1b[0m', message);

    FILE.append(
        storage.config.tempPath,
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
        storage.config.tempPath,
        textWithoutMsg
    );
}
function openTextEditor() {
    if (storage.isEditorOpened) return;


    const config = storage.config;
    const SPAWN = require('child_process').spawn;
    console.log(`trying to open Text Editor by command: ${config.editor} ${config.tempPath}`);


    let child = SPAWN(config.editor, [config.tempPath]);
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
            storage.config.dbPath,
            textForDatabase,
            () => mainFLOW.to('new note saved to database', interface)
        );
    }
    function clearInterface() {
        controls.note = '';
        interface = UTIL.updateArrByObj(interface, controls);

        mainFLOW.to('interfase must be restored', interface);
    }
    function exit() {
        mainFLOW.to('finish', 'Tot ziens!\n');
    }
}




function closeApp(param) {
    console.log(param);
    process.exit();
}
