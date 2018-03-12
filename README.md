# Notekeeper


This is a simple Node.js utility for making notes. 

1. type `notekeeper` in your command line (I prefer just "note" as alias) 
2. the Note Interface will be automatically opened in your preferred Text Editor 
3. write something, save the file and it's done: your new note is appended to the database plain text file 

----

**Installation**: `sudo npm i -g notekeeper`

On the first run Notekeeper creates a folder `notekeeper` in your Home Directory containing next files: 
1. `config.json` stores paths and settings 
2. `template_base.txt` stores a markup for database records' 
3. `template_interface.txt` stores a markup for the Interface 

Then Notekeeper will ask 3 questions: 
a **path for Database** file for storing Notes, 
a **path for Interface** file, 
a **shell command** which opens your Text Editor. 

It's ok to skip all answers to use default settings (`base.txt`, `new_note.txt`, `subl`). 

> **Attention!** 
> The default shell command `subl` does not work on Windows! 
> An example of a working shell command for Windows: `start "" "c:\\Program Files\\Sublime Text 3\\sublime_text.exe"` 


### Text Editors
Notekeeper was well tested with **Sublime Text** only. 
It should work with any text editor which can be executed by a shell command `<editor> <filepath>`. 
Your text editor must support hot reloading of externally edited files. 
The info about other text editors will be added soon.

.


## How it works

1. At the startup, Notekeeper parses the Database file to find already Used Tags there. 
2. The **Interface file** is opened in your Text editor and shows you Tags parsed from the base.
The default interface looks like this:
```

================================== name ======================================

================================== tags ======================================

================================ commands ====================================
add
========================== tags used previously ==============================
any tag

```
> The first line is intended for the text of your new Note. 
>
> `================================== name ======================================` is a delimeter important for the interface. 
> Don't edit delimeters during the runtime. Otherwise, the Interface can not be parsed by Notekeeper and a warning appears. 
> 
> A Line under the "**name**" delimeter is a field to enter the name of your Note. It's not required but makes it possible to edit and delete notes later using a name as an identifier. Names must be unique. It's a **single-line field**. 
> 
> The "**tags**" field may be used to add a list of tags (marks, categories, parents...) to your new note. Tags are not required. It's a **single-line field**. 
> 
> The "**commands**" field accepts commands for Notekeeper. There also messages appear. A command is a single-line field. Other lines are ignored. 
> 
> The Tags parsed from Database will be shown it the last field. Their goal is to make Tags reusing more handy with the autocomplete function provided by your Text editor). This is not an input field and is not readed by Notekeeper. 

3. Write or paste your note in the first line of the Interface. Your note may contain an unlimited count of lines and any symbols. 

4. Specify an optional name and tags (also optional). 

5. Save the file by pressing `ctrl+S` (`Command+S`). 
Notekeeper will detect the changes, parse your note and push it to the Database. 
If you don't want to save the current Note to the Database just leave the **Commands** field empty. 
If you specified a name for your note, you will be able to edit it later.

5. Type `exit` in the **Commands** field to close Notekeeper.

.

## List of commands

1. Empty -- do nothing
2. `add` -- save the current note to the Database
3. `mix` -- concat the record from the base and the new record with the same name. It adds only unique information during a concatenation process.
4. `edit` -- edit a record specified by a name in the base
5. `del` -- delete a record specified by a name from the base
6. `clr` -- clear all fields of the Interface
7. `exit` -- close the program

.

## Templates

You may change a view of the Notekeeper's Interface. It's stored in `template_interface.txt`. The fields are marked by tags like this `<m>...<text>`. A tag contains 3 parts:

1. "start" means a type of the field. Only 2 types are available: a **single-line** and a **multi-line**.
2. "value" for defaults
3. "end" means a name the field.

There must be at least one any symbol between the tags. This template will not be parsed correctly: `<><text><><tags>`. 
