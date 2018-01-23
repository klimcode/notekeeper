const Flow = require('flow');
const FILE = require('files');
const UTIL = require('utilities');

const pathToConfig = 'config.json';
const pathToInterface = 'interface.txt';
const mainFLOW = new Flow();
global.storage = {};



mainFLOW.steps = {
    'start': getConfig,
    'config is OK': [ openTextEditor, getDatabase ],
    'database is OK': parseTagsFromBase,
    'tags are parsed': createInterface,
    'interface created': updateInterface,
    'interface is recorded in Notefile': watchInterfaceChanges,
    'note was changed': closeApp,

    'problem with interface': writeMessageToInterface,
    'problem with interface solved': removeMessageFromInterface,
    'fatal error': closeApp,
    'finish': closeApp,
};
mainFLOW.to('start');



function getConfig() {
    console.log(`trying to read: ${pathToConfig}`);
    FILE.getConfig(
        pathToConfig,
        (content) => { storage.config = content; mainFLOW.to('config is OK', content) }
    );
}
function getDatabase() {
    console.log(`trying to read database: ${storage.config.dbPath}`);
    FILE.readOrMake(
        storage.config.dbPath,
        (content) => { storage.db = content; mainFLOW.to('database is OK') }
    );
}
function parseTagsFromBase() {
    let tags = storage.db.match(/\b___\w+/g);
    if (tags) {
        tags = UTIL.removeClonesFrom(tags);
    } else {
        tags = [];
    }
    tags = tags.sort();

    mainFLOW.to('tags are parsed', tags);
}
function createInterface(tagsFromBase) {
    console.log(`trying to create text interface in: ${storage.config.tempPath}`);


    FILE.readOrMake(
        pathToInterface,
        parseSavedInterface,
        makeDefaultInterface
    );


    function makeDefaultInterface() {
        let interface = `<note><>`;
        interface +=    `\n================================== tags ======================================\n`;
        interface +=    `<tags><>`;
        interface +=    `\n================================ commands ====================================\n`;
        interface +=    `<commands>save<>`;
        interface +=    `\n============================ tags used previously ============================\n`;
        interface +=    `<tags_used><>`;

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

    FILE.write(
        pathToTempFile,
        interfaceText,
        () => mainFLOW.to('interface is recorded in Notefile', interface)
    );
}
function watchInterfaceChanges(interface) {
    const noteFile = storage.config.tempPath;


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
            '\n\n!!! Interface is broken !!!!\n\n' +
            'It will be completely restored on next saving.\n' +
            'Please, copy your Note (Ctrl+C).\n' +
            'Then press Ctrl+S and paste it to the restored interface\n\n' +
            'It also may be restored manually...';


        for (let i = 0; i < interface.length-1; i++) {  // Parsing
            let region = interface[i];
            let delimeter = interface[i+1].title;
            let tempArr;


            tempArr = rawText.split(delimeter);
            if (!tempArr[1]) {
                storage.brokenInterface = true;
                return mainFLOW.to('problem with interface', brokenInterfaceMsg);
            }


            region.content = tempArr[0];
            rawText = tempArr.slice(1,tempArr.length).join(delimeter); // rest
        }

        if (storage.brokenInterface) {  // Removing message about broken interface
            storage.brokenInterface = false;
            mainFLOW.to('problem with interface solved', content);
        }

        console.log(interface);
        // mainFLOW.to('note was changed', interface);
    }
}
function writeMessageToInterface(message) {
    storage.interfaceMsg = message;
    storage.dontReadFile = true;
    console.log(message);

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


function openTextEditor(config) {
    const PATH = require('path');
    const SPAWN = require('child_process').spawn;

    const dir = process.cwd();
    const filePath = PATH.resolve(dir, config.tempPath);
    console.log(`trying to open Text Editor by command: ${config.editor} ${filePath}`);


    let child = SPAWN(config.editor, [filePath]);
    let resp = '';

    child.stdout.on('data', (buffer) => { resp += buffer.toString() });
    child.stdout.on('end', () => {});
}


function closeApp(param) {
    console.log(param);
    process.exit();
}
