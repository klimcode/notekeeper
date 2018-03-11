module.exports = {

    removeDuplicatesFrom (arr) {

        return arr.filter ((el, pos, a) => (a.indexOf(el) == pos) && el );
    },
    getRegexCaptures (content, regex, callback) {
        let matches, result = [];

        while ((matches = regex.exec(content)) !== null) {
            if (matches.index === regex.lastIndex) regex.lastIndex++; // This is necessary to avoid infinite loops with zero-width matches
            callback (matches.splice(1), result);
        }

        return result;
    },
    prettifyTagsList (input) { // "a, b ,,b   ,,  c,d,d" ==> [a, b, c, d]
        let tags = input
            .split (',')
            .map (s => s.trim())
            .filter (s => s != '');

        return this.removeDuplicatesFrom (tags);
    },


    //===================================================================================================
    //      PARSER
    //===================================================================================================
    createParser (template) { // makes a Regexp with a property contains a list of Template fields (Captures)
        let parser = createRegex (template);

        parser.template = template; // Stores template string parser for future purposes
        parser.captures = this.getRegexCaptures ( // an array of names of template data fields
            template,
            /<m>[\s\S]*?<(\w+)>|<>.*<(\w+)>/g,
            (matches, result) => result.push (matches[0] || matches[1])
        );
        return parser;

        function createRegex (template) {
            let mask = template
                .replace (/<m>[\s\S]*?<\w+>/g, '([\\s\\S]*?)')  // a multi-line field
                .replace (/<>.*<\w+>/g, '(.*)')          // a single-line field

            return new RegExp (mask, 'g');
        }
    },
    parse (inputString, parser) { // return a Record object if count of Records == 1, else an array of them
        let result = this.getRegexCaptures (
            inputString,
            parser,
            (matches, result) => {
                let record = Object.assign (...parser.captures.map ( (prop, i) => {  // makes Obj from 2 Arrays
                    let match = matches[i]
                        .replace(/<m>([\s\S]*?)<\w+>/g, '$1')
                        .replace(/<>(.*)<\w+>/g, '$1')
                    return { [prop]: match };
                }) );

                result.push (record);
            }
        );
        if (!result.length) return false;

        return (result.length == 1)? result[0]: result;
    },
    stringifyObj (object, parser) { // creates a string from an object according to a Parser's template

        return parser.captures.reduce (insertValuesToTemplate, parser.template);

        function insertValuesToTemplate (template, prop) {
            let regex = new RegExp ('<.*>[\\s\\S]*?<'+ prop +'>', 'g');
            let data = object[prop];
            if (data instanceof Array) data = data.join(', ');

            return template.replace(regex, data);
        }
    },
    stringifyArr (base, parser) { // creates a string from an array of objects according to a Parser's template

        return base.reduce ( (acc, record) => acc + this.stringifyObj (record, parser), '');
    },


    //===================================================================================================
    //      THESE FUNCTIONS DEPEND ON A CURRENT NOTEKEEPER REALISATION
    //===================================================================================================
    getUsedTags (base) {
        let tagsArr = base.reduce ((acc, record) => (acc.concat (record.tags.split(', '))), []);

        return this.removeDuplicatesFrom (tagsArr);
    },
    convertToBaseRecord (note, parser) {
        const targetRecordFields = parser.captures;

        return Object.assign(...targetRecordFields.map( prop => (
            {[prop]: (note[prop] instanceof Array ? note[prop].join (', ') : note[prop]) }) ) );
    },
    concatUniqText (acc, addition) {
        if (!acc) return addition;
        if (!addition) return acc;

        if (addition.startsWith (acc))
            return addition;

        return acc +'\n\n'+ addition;
    },
    concatUniqTags (tags1, tags2) { // Returns Array !
        if (typeof tags1 == 'string') tags1 = tags1.split(', ');
        if (typeof tags2 == 'string') tags2 = tags2.split(', ');

        if (!tags1.length) return tags2;
        if (!tags2.length) return tags1;

        const res = tags1.concat (tags2);
        return this.removeDuplicatesFrom (res);
    },


    /* Future purposes
    function parseTabulation(argument) {
        const arr = [];
        let spaces = 0;
        let line = '';
        for (let i = 0; i < base.length; i++) {
            let char = base[i];

            if (char === '\n') {        // End of a line
                arr.push({'spaces': spaces, 'line': line});

                line = '';
                spaces = 0;
            } else {
                if (!line) {
                    if (char === ' ') {     // somewhere inside a Tabulation
                        spaces++;
                    } else {
                        line += char;       // Start of a line
                    }
                } else {                    // somewhere inside a line
                    line += char;
                }
            }
        }
        arr.push({'spaces': spaces, 'line': line});     // The last line
        console.log(arr);
    }
    */
}
