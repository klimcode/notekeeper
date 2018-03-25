# Notekeeper

This is a simple Node.js utility for making notes.

- You can save and manage Notes with a full power of your preferred Text Editor.
- Notes are stored in plain text Base files which are easy to read without Notekeeper.
- Helps you to create hierarchically structured knowledge base for storing any texts containing any symbols.

----

## Installation

`sudo npm i -g notekeeper`

> I recommend to make an alias for a command `notekeeper` which bootstraps the utility.

On the first run Notekeeper creates in your Home Directory a folder `notekeeper` containing next files:

1. `config.json` stores paths and settings
2. `template_base.txt` stores a markup for database records'
3. `template_interface.txt` stores a markup for the Interface
4. `template_tree.txt` stores a markup for the Tree-view

Then Notekeeper will ask 3 questions:

1. a **path for a Database** file for storing Notes,
2. a **path for a Interface** file -- a temp file that will be opened in your text editor,
3. a **shell command** which can open your Text Editor.

It's ok to skip all answers to use default settings (`base.note`, `new_note.note`, `subl`).

**Attention!**
> The default shell command `subl` does not work on Windows!
> An example of a working shell command for Windows: `start "" "c:\\Program Files\\Sublime Text 3\\sublime_text.exe"`

### Text Editors

Notekeeper was well tested with **Sublime Text 3**, **Atom**, **VS Code** on Linux.
It should work with any text editor which can be executed by a shell command `<editor> <filepath>`.
Your text editor must support hot reloading of externally edited files.

### Syntax highlighting

Notekeeper uses a extension `.note` for Base files and the Interface file. The syntax of these files may be highlited in your text editor:

- The best choise for **Sublime Text** is `D` syntax.
- An extension `notekeeper-syntax` specially written for **VS Code** uses JS-React syntax highlighting.

.

## How it works

1. At the startup, Notekeeper parses the Database file trying to find already Used Tags there.
2. The **Interface file** is opened in your Text editor and shows you Tags parsed from the base.
3. Write or paste your note in the first line of the Interface. Your note may contain an unlimited count of lines and any symbols.
4. Specify an optional name and comma-separated tags (also optional). A tag may contain whitespaces.
5. Save the file by pressing `ctrl+S` (`Command+S`). Notekeeper will detect the change of the Interface file, parse your note and push it to the Database. If you don't want to save the current Note to the Database just leave the **Commands** field empty. If you specify a name for your note, you will be able to edit it later.

.

## Interface

The default interface looks like this:

```html
  
================================== name ======================================

================================== tags ======================================

================================ commands ====================================
add
========================== tags used previously ==============================
tag

```

The first line is intended for the text of your new Note.

`================================== name ======================================` is a delimeter important for the interface. Don't edit delimeters during the runtime. Otherwise, the Interface can not be parsed by Notekeeper and a warning appears.

A Line under the "**name**" delimeter is a field to enter the name of your Note. It's not required but makes it possible to edit and delete notes later using a name as an identifier. Names must be unique. It's a **single-line field**.

The "**tags**" field may be used to add a list of tags (marks, categories, parents...) to your new note. Tags are not required. It's a **single-line field**.

The "**commands**" field accepts commands for Notekeeper. There also messages appear. A command is a single-line field. Other lines are ignored.

The Tags parsed from Database will be shown it the last field. Their goal is to make Tags reusing more handy with the autocomplete function provided by your Text editor). This is not an input field and is not readed by Notekeeper.

.

## List of commands

1. Empty command -- do nothing
2. `add` -- save the current note to the base
3. `mul` -- add multiple comma-separated records to the base (example: mul a, b,c). All the names must be unique.
4. `mix` -- concat the record from the base and the new record with the same name. It adds only unique information during a concatenation process.
5. `get` -- load a record by a name (example: `load info`)
6. `last` -- load the last edited record
7. `edit` -- edit a record by a name
8. `del` -- delete a record by a name
9. `clr` -- clear all fields of the Interface
10. `tree` -- show the base or a record in a tree-view structure
11. `load` -- load/reload base to work with (example: `load js`)
12. `exit` -- close the program

.

## Templates

You may change a view of the Notekeeper's Interface. It's stored in `template_interface.txt`. The fields are marked by tags like this: `<m>...<text>`. A tag consists of 3 parts:

1. "start" points to a type of the field. `m` means a multi-line field.
2. "value". The default value for the "command" field is `add`.
3. "end" points to a name of the field.

There must be at least one any symbol between the tags. This template will not be parsed correctly: `<><text><><tags>`.

Here is an example of minimalistic template for the Interface:

```html
<m><text>
=========================== name, tags, commands ===========================
<><name>
<><tags>
<m>add<command>
=========================== tags used previously ===========================
<>tag<tags_used>

```
