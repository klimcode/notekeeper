module.exports = {

    removeDuplicatesFrom (arr) {

        return arr.filter ((el, pos, a) => a.indexOf(el) == pos);
    },
    concatTagsUniq(tags1, tags2) { // Returns Array !
        if (typeof tags1 == 'string') tags1 = tags1.split(', ');
        if (typeof tags2 == 'string') tags2 = tags2.split(', ');

        if (!tags1.length) return tags2;
        if (!tags2.length) return tags1;

        return tags1.concat (tags2).filter ((el, pos, a) => a.indexOf (el) == pos);
    },
    concatTextUniq(str1, str2) {
        if (!str1) return str2;
        if (!str2) return str1;

        if (str2.startsWith (str1))
            return str2;

        return str1 +'\n\n'+ str2;
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
    //      THESE FUNCTIONS DEPEND ON A CURRENT NOTEKEEPER REALISATION
    //===================================================================================================

    createParser (template) { // makes a Regexp with a property contains a list of Template fields (Captures)
        let parser = createRegex (template);

        parser.template = template;
        parser.captures = this.getRegexCaptures (
            template,
            /<(\w+)>.*<>/g,
            (matches, result) => result.push (matches[0])
        );
        return parser;

        function createRegex (template) {
            let mask = template
                .replace (/<text>.*<>/, '([\\s\\S]*?)')  // a multi-line field
                .replace (/<\w+>.*<>/g, '(.*)')          // a single-line field

            return new RegExp (mask, 'g');
        }
    },
    parse (data, parser) { // return a Record object if count of Records == 1, else an array of them
        let result = this.getRegexCaptures (
            data,
            parser,
            (matches, result) => {
                let record = Object.assign (...parser.captures.map ( (prop, i) => {  // makes Obj from 2 Arrays
                    let match = matches[i].replace(/<\w+>(.*)<>/g, '$1')
                    return { [prop]: match };
                }) );

                result.push (record);
            });

        return (result.length == 1)? result[0]: result;
    },
    getUsedTags (base) {
        let tagsArr = base.reduce ((acc, record) => (acc.concat (record.tags.split(', '))), []);
        return this.removeDuplicatesFrom (tagsArr);
        
        // return tagsString;
    },

    stringifyInterface (note, parser) { // creates a string from a Template with replaced Props by values from Note object

        return parser.captures.reduce (insertValuesToTemplate, parser.template);

        function insertValuesToTemplate (acc, prop) {
            let regex = new RegExp ('<'+ prop +'>.*<>');
            let data = note[prop];
            if (data instanceof Array) data = data.join(', ');

            return acc.replace (regex, data);
        }
    },
    stringifyBase (base, template) { // creates a string from a Template with replaced Props by values from Note object

        return base.reduce ( (acc, note) => acc + this.stringifyNote (note, template) );
    },
}
