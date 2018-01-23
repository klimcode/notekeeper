const FS = require('fs');


function checkFileExistence(path, existCallback, absentCallback) {
    if (!existCallback || !absentCallback) return console.error('files__checkFileExistence arguments ERROR: all callbacks are required');
    FS.stat(path, (err) => {
        if (!err) {
            existCallback(path);  // ---------------------> exit (file exists)
        }
        else if (err && err.code == 'ENOENT') {
            absentCallback(path);  // ---------------------> exit (file does not exist)
        }
    });
}
function readFile(path, successCallback, errCallback) {
    if (!path || !successCallback) return console.error('files__readFile arguments ERROR: "path" and "successCallback" are required');

    FS.readFile(path, 'utf8', (err, content) => {
        if (err) {
            console.error('files__readFile ERROR: ', err);
            errCallback || errCallback();  // ---------------------> exit (unable to read file)
        } else {
            successCallback(content);  // ---------------------> exit (file content goes outside)
        }
    });
}
function writeFile(path, text, successCallback, errCallback) {
    if (!path) return console.error('files__writeFile arguments ERROR: "path" is required');

    const content = text || '';
    FS.writeFile(path, content, (err) => {
        if (err) {
            console.error('files__writeFile ERROR: ', err);
            errCallback || errCallback();  // ---------------------> exit (unable to write a file)
        }
        else {
            successCallback && successCallback();  // ---------------------> exit (file is successfully rewritten or made)
        }
    })
}
function appendToFile(path, text, successCallback, errCallback) {
    if (!path) return console.error('files__append arguments ERROR: "path" is required');

    FS.appendFile(
        path,
        text,
        (err) => {
            if (err) {
                errCallback ? errCallback() : console.error('files__append ERROR:', err);
            } else {
                successCallback && successCallback();
            }
        }
    )
}
function readOrMake(path, readCallback, makeCallback) {
    if (!path || !readCallback) return console.error('files__readOrMake arguments ERROR: "path" and "readCallback" are required');

    const makeFileCallback = makeCallback || makeEmptyFile;


    checkFileExistence(
        path,
        () => { readFile(path, readCallback) },  // ---------------------> exit (file is exist)
        makeFileCallback  // ---------------------> exit (new file will be made by makeCallback)
    );


    function makeEmptyFile(path) {
        console.log('NEW FILE!');
        writeFile(
            path,
            '',
            () => readCallback('')  // ---------------------> exit (new empty file created)
        );
    }
}
function watchFileChanges(path, callback) {
    let timer;

    FS.watch(path, () => {
        if ((timer) && (!timer._called)) return; // Removes duplicated fire (FS.watch bug)

        timer = setTimeout(callback, 30);
    });
}
function getConfig(pathToConfig, successCallback, errCallback) {
    if (!pathToConfig || !successCallback) return console.error('files__getConfig arguments ERROR: "pathToConfig" and "successCallback" are required');

    const configFilePath = pathToConfig;
    const CLIQuestions = [
        { prop: 'dbPath', question: 'New config will be created. \nPath to database file:' },
        { prop: 'tempPath', question: 'Path to temp file:' },
        { prop: 'editor', question: 'Command to open your text editor:' },
    ];
    const CLIAnswers = {};
    let currentLine = CLIQuestions.shift();


    readOrMake(
        configFilePath,
        checkConfigReadability,
        createConfig
    );


    function checkConfigReadability(content) {
        try {
            const parsedConfig = JSON.parse(content);
            successCallback(parsedConfig);  // ---------------------> exit (parsed config goes outside)
        } catch (e) {
            console.error('files__getConfig ERROR: config-file contains non correct JSON\n', e);

            // What to do with broken Config?
        }
    }
    function createConfig(){
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });


        rl.question(currentLine.question + '\n', ask);


        function ask(answer) {
            CLIAnswers[currentLine.prop] = answer;

            if (CLIQuestions.length) {
                currentLine = CLIQuestions.shift();
                rl.question(currentLine.question + '\n', ask);
            } else {
                rl.close();
                const configContent = JSON.stringify(CLIAnswers);

                writeFile(
                    configFilePath,
                    configContent,
                    () => successCallback(CLIAnswers)  // ---------------------> exit (new config data goes outside)
                );
            }
        }
    }
}

module.exports = {
    'check': checkFileExistence,
    'read': readFile,
    'write': writeFile,
    'append': appendToFile,
    'readOrMake': readOrMake,
    'watch': watchFileChanges,
    'getConfig': getConfig,
}
