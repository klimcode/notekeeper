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
    prettifyTagsList (string) { // "a, b  ,, c,d," --> [a, b, c, d]
        return string
            .split (',')
            .map (s => s.trim())
            .filter (s => s != '');
    },


    //===================================================================================================
    //      THESE FUNCTIONS DEPEND ON A CURRENT NOTEKEEPER REALISATION
    //===================================================================================================

    getObjFromArr (arr) { 
        let obj = {};
        arr.forEach (item => obj[item.type] = item.content);
        return obj;
    },

    updateArrByObj (arr, obj) {

        return arr.map (item => {item.content = obj[item.type]; return item });
    },

    createParser (template) { // makes a Regexp with a property contains a list of Template fields. Used for Base parsing.
        let parser = createRegex (template);

        parser.props = this.getRegexCaptures (
            template,
            /<(\w+)>/g,
            (matches, result) => result.push(matches[0])
        );

        return parser;

        function createRegex (template) {
            let mask = template
                .replace(/<text>/, '([\\s\\S]*?)')  // a multi-line field
                .replace(/<\w+>/g, '(.*)');         // a single-line field

            return new RegExp (mask, 'g');
        }
    },

    stringifyNote (note, template) { // creates a string from a Template with replaced Props by values from Note object

        return template.props.reduce (replaceTemplatePropsByValues, template.text);

        function replaceTemplatePropsByValues (acc, val) {
            let regex = new RegExp ('<'+ val +'>');
            let data = note[val];
            if (data instanceof Array) data = data.join(', ');

            return acc.replace (regex, data);
        }
    },
    stringifyBase (base, template) { // creates a string from a Template with replaced Props by values from Note object

        return base.reduce ( (acc, note) => acc + this.stringifyNote (note, template) );
    },
}
