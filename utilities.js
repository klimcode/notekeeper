module.exports = {
    removeDuplicates (arr) {

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
    prettifyList (input) { // "a, b ,,b   ,,  c,d,d" ==> [a, b, c, d]
        let tags = input
            .split (',')
            .map (s => s.trim())
            .filter (s => s != '');

        return this.removeDuplicates (tags);
    },
    isEqual (str1, str2) {
        return str1.toLowerCase().trim() === str2.toLowerCase().trim();
    },


    //===================================================================================================
    //      THESE FUNCTIONS DEPEND ON A CURRENT NOTEKEEPER REALISATION
    //===================================================================================================
    getUsedTags (base) {
        let tagsArr = base.reduce ((acc, record) => (acc.concat (record.tags)), []);

        return this.removeDuplicates (tagsArr);
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
        return this.removeDuplicates (res);
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
