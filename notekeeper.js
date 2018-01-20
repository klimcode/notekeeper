const Flow = require('flow');
const FILE = require('files');

const pathToConfig = 'config.json';
const mainFLOW = new Flow();
global.storage = {};



mainFLOW.steps = {
    'start': getConfig,
    'config is ready': getDatabase,
    'DB is ready': createInterface,
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
        (content) => { storage.db = content; mainFLOW.to('finish') }
    );
}
function createInterface() {
    console.log(`trying to read: ${storage.config.dbPath}`);
    FILE.readOrMake(
        storage.config.dbPath,
        (content) => { storage.db = content; mainFLOW.to('finish') }
    );
}

function closeApp(param) {
    console.log('Tot ziens!\n', param);
}
