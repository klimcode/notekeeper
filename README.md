# Notekeeper


This is a simple Node.js utility for making notes.  

1. type `notekeeper` in your command line (I prefer just "note" as alias)  
2. the Notefile will be automatically opened in your preferred Text Editor  
3. write something, press **save** and it's done: your new note is appended to the database txt-file  

----

**Installation**: `sudo npm i -g notekeeper`

This program will create 4 files:  
1. `notekeeper_config.json` (storing paths for Database and Notefile) is located in HOME directory  
2. `notekeeper_interface.txt` (storing Interface markup for Notefile) is located in HOME directory  
3. Database file (storing all the Notes). Name and location must be chosen by user  
4. Notefile (used for adding new Notes). Name and location must be chosen by user  

On the first run Notekeeper will ask 3 questions: a path for Database, a path for Notefile and a shell command for your Text Editor.  
The questions have default values: `~/base.txt`, `~note.txt`, `subl` accordingly.

> Attention!  
> Windows users may get an Error with the default shell command.  
> A working example of shell command: `start "" "c:\\Program Files\\Sublime Text 3\\sublime_text.exe"`  

Notekeeper was tested with Sublime text only.  
It should work with any text editor which can be executed with shell command `editor filepath`.


.


## How it works

1. Notekeeper parses the Database file trying to find the Tags there. 
Each tag must have 3 underscores in the begining like this: `___sample_tag`. An underscore sign must be used as a word delimeter.  

2. The Notefile is opened in your Text editor and contains the Interface.
The default interface looks like this:
```

================================== tags ======================================

================================ commands ====================================
save
========================== tags used previously ==============================
___sometag,
```
> The first field is intended for your new Note.  
>
> `================================== tags ======================================` is a delimeter important for the interface. 
> It should not be changed in the Notefile. 
> Otherwise, the Interface can not be parsed by Notekeeper and a warning appears.  
> 
> Line under "tags" delimeter is a field to enter your Tags for the current Note.  
> 
> The next field accepts Commands listed below...  
> 
> The Tags parsed from Database will be shown it the last field. Their goal is to make Tags reusing more handy with autocomplete function (depends on a Text editor).

3. Write or paste your note to the first line of the Notefile. Your note may contain unlimited count of lines and any symbols.

4. Save the Notefile by pressing `ctrl+S` (`Command+S`).  
Notekeeper will detect the changes, parse your note and metatags and push them to the Database.  
If you don't want to save current Note to the Database just remove word `save` from the Commands field.  

5. Type `exit` in the Commands field to close Notekeeper.

.

## List of commands

1. Empty command -- do nothing
2. `save` -- save current note to the Database
3. `clear` -- clear the Note field
4. `exit` -- close the program
