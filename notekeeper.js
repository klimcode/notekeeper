const Flow = require('flow');
const FILE = require('files');

const pathToConfig = 'config.json';
const mainFLOW = new Flow();
global.storage = {};



mainFLOW.steps = {
    'start': getConfig,
    'config is ready': getDatabase,
    'DB is ready': parseTagsFromBase,
    'tags are parsed': createInterface,
    'finish': closeApp,
};
mainFLOW.to('start');



function getConfig() {
    console.log(`trying to read: ${pathToConfig}`);
    FILE.getConfig(
        pathToConfig,
        (content) => { storage.config = content; mainFLOW.to('config is ready', content) }
    );
}
function getDatabase() {
    console.log(`trying to read: ${storage.config.dbPath}`);
    FILE.readOrMake(
        storage.config.dbPath,
        (content) => { storage.db = content; mainFLOW.to('DB is ready') }
    );
}
function parseTagsFromBase() {
    let tags = storage.db.match(/\b___\w+/g);
    if (tags) {
        tags = removeClonesFrom(tags);
    } else {
        tags = [];
    }

    mainFLOW.to('tags are parsed', tags);
}
function removeClonesFrom(arr) {
    for (var i = arr.length; i--;) {
        for (var j = i; j--;) {
            if (arr[j] === arr[i]) {
                arr.splice(i, 1);
                break;
            }
        }
    }
    return arr;
}
function createInterface(tagsFromBase) {
    console.log(`trying to create text interface in: ${storage.config.tempPath}`);


    let interface = `\n================================== tags ======================================\n`;
    interface +=    ``;
    interface +=    `\n================================ commands ====================================\n`;
    interface +=    `save`;
    interface +=    `\n============================ tags used previously ============================\n`;

    for (var i = tagsFromBase.length; i--;) {
        interface += tagsFromBase[i];
        if (i) interface += ', ';
    }

    console.log(interface);

    mainFLOW.to('finish');
}

function closeApp(param) {
    console.log('Tot ziens!\n', param);
}
