const FS = require('fs');
const G = {
    dataBaseFilename: 'base.txt',
    newNoteFilename: 'note.txt',
    delimeter: '\n============================',
    tagRegexp: /\b___\w+/g,
    tagEmpty: '___notag',
};
var FLOW = new Flow();

var OLD_NOTE_CONTENT;
var TAGS_USED;

console.log(G);

(function mainLogic() {

    FLOW.stages = {
        'start': checkFiles,
        'files checked': parseTagsInBase,
        'tags parsed from DB': createNoteInterface,
        'Note interface created': startWatchingOnNoteChanges,
        'Note is changed': updateNoteInterface,
        'Note interface updated (note is empty)': noteIsEmpty,
        'Note interface updated': putNoteToBase,
    };

    FLOW.setStage('start');
})();
function Flow() {
    this.setStage = function flow_setStage(stage, data) {
        var stageHandler = this.stages[stage];
        if (stageHandler) {
            this.currentStage = stage;
            console.log('-- ', stage);

            stageHandler(data);
        } else {
            console.error(`flow_setStage ERROR: undefined handler for stage "${stage}"`);
        }
    }
}


function checkFiles() {

    var filesArray = [
        G.dataBaseFilename,
        G.newNoteFilename,
    ];

    for (let i=filesArray.length; i--;) {
        isFileExists(filesArray[i]);
    }


    function isFileExists(fileName) {
        FS.stat(G.newNoteFilename, (err) => {
            if (!err) {
                markExisted();
            }
            else if (err && err.code == 'ENOENT') {
                createFile(fileName);
            }
        });
    }
    function createFile(fileName) {
        FS.writeFile(fileName, '', (err) => {
            if (err) console.error('creating file ERROR');
            else {
                console.log('Created file: ', fileName);
                markExisted();
            }
        })
    }
    function markExisted() {
        filesArray.shift();
        if (!filesArray.length) {
            FLOW.setStage('files checked');
        }
    }
}

function parseTagsInBase() {
    FS.readFile(G.dataBaseFilename, 'utf8', (err, content) => {
        if (err) {
            console.error('parseTagsInBase ERROR!', err);
        } else {
            TAGS_USED = content.match(G.tagRegexp);
            if (TAGS_USED) {
                removeRepeating(TAGS_USED);
            } else {
                TAGS_USED = [];
            }

            FLOW.setStage('tags parsed from DB');
        }
    });
}
function removeRepeating(arr) {
    for (var i = arr.length; i--;) {
        for (var j = i; j--;) {
            if (arr[j] === arr[i]) {
                arr.splice(i, 1);
                break;
            }
        }
    }
}
function createNoteInterface() {
    var interface = generateNoteInterface();

    writeNoteFile(interface, 'Note interface created');
}
function generateNoteInterface(newNote) {
    var newTags = '', newText = '';

    if (newNote) {
        newTags = newNote.tags;
        newText = newNote.text;

        TAGS_USED = TAGS_USED.concat(newTags);
        removeRepeating(TAGS_USED);

        newTags = newTags.join(', ');
    }

    var interface = newTags + '\n' + newText + G.delimeter + ' tags used previously:\n' + TAGS_USED.join(', ');

    OLD_NOTE_CONTENT = interface;

    return interface;
}

function writeNoteFile(content, stage, data) {
    FS.writeFile(G.newNoteFilename, content, (err) => {
        if (err) {
            console.error('writeNoteFile ERROR', err);
            return;
        }
        FLOW.setStage(stage, data);
    });
}
function startWatchingOnNoteChanges() {
    var timer;

    FS.watch(G.newNoteFilename, () => {
        if ((timer) && (!timer._called)) return; // Removes duplicated fire (FS.watch bug)

        timer = setTimeout(readNoteFile, 30);
    });


    function readNoteFile() {
        FS.readFile(G.newNoteFilename, 'utf8', function readNewNote(err, content) {
            if (err) {
                console.error('readNewNote ERROR!', err);
            } else {
                if (isFileChanged(content)) {
                    parseNote(content);
                }
            }
        });
    }

    function isFileChanged(justChangedNote) {
        if ((OLD_NOTE_CONTENT) && (OLD_NOTE_CONTENT == justChangedNote))
            return false;

        OLD_NOTE_CONTENT = justChangedNote;
        return true;
    }

    function parseNote(input) {

        input = input.split(G.delimeter)[0];

        var inputArr = input.split('\n');
        var note = {
            tags: inputArr.shift().match(G.tagRegexp),
            text: inputArr.join('\n')
        }

        if (!note.tags)
            note.tags = [G.tagEmpty];

        FLOW.setStage('Note is changed', note);
    }
}
function updateNoteInterface(note) {
    var stage = 'Note interface updated';
    var interface = generateNoteInterface(note);

    if (!note.text) {
        stage = 'Note interface updated (note is empty)';
    }

    writeNoteFile(interface, stage, note);
}

function noteIsEmpty() {
}

function putNoteToBase(note) {
    var stream = FS.createWriteStream(G.dataBaseFilename, {flags:'a'});

    var content = '\n' + note.tags.join(', ') + '\n' + note.text + G.delimeter + '\n';
    stream.write(content);
}
