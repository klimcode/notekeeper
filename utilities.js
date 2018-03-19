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
    clock (start) {
        if ( !start ) return process.hrtime();
        var end = process.hrtime(start);
        return Math.round((end[0]*1000) + (end[1]/1000000));
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
    searchDuplicate (base, name) {
        return name ?
            base.findIndex (record => this.isEqual (record.name, name) ) :
            -1;     // empty name equals to uniq name
    },


    // TREE VIEW
    treeView (inputBase) {
        const isEqual = this.isEqual;
        let base = setLeveles (inputBase);
        sortStructure (base);
        transformView (base);
        return base;
   
    
        function setLeveles (base) {
            return base.filter (rec => {
                if (!rec.text.trim()) return false;     // removes empty records
    
                let level = getAndSetLevel (base, rec);
                if (level < 9) return true;
            });
        }
        function getAndSetLevel (base, record) {
            let level = 0;
            let parent = base [getParentId (base, record)];
    
            if (parent) {
                level++;
                if (parent.level === undefined)
                    getAndSetLevel (base, parent);
                else
                    level = parent.level + 1;
            }
    
            record.level = level;
            return level;
        }
        function getParentId (base, record) {
            let tag = record.tags[0];
            if (!tag) return null;
    
            for (let i=0; i<base.length; i++) {
                if (isEqual (base[i].name, tag)) {
                    return i;
                }
            }
            return null;
        }
        function sortStructure (base) {
            sortBylevels (base);
            
            for (let i=0; i<base.length-2; i++) {
                let j = i+1;
                let record = base[i];
                let next = base[j];
                
                // All steps before this line are correct!
                // Need to make a list of direct children for each record
                for (let k=j; k<base.length; k++) {
                    let possibleChild = base[k];
                    if (isChild (possibleChild, record)) {
                        (k != j) && changePos (base, k, j);
                        j++;
                    }
                }
            }
    
            function sortBylevels (arr) {
                arr.sort ((a,b) => a.level - b.level);
            }
            function isChild (candidate, record) {
                return (candidate.level === record.level + 1) && // check level
                    isEqual (candidate.tags[0], record.name);
            }
            function changePos (arr, from, to) {
                let item = arr.splice (from, 1)[0];
                arr.splice (to, 0, item);
            }
        }
        function transformView (base) {
            base.forEach (rec => {
                if (!rec.level) return;
    
                let padding = Array (rec.level * 2 + 1).join (' ');
                rec.name = padding + rec.name;
                rec.text = rec.text
                    .split('\n')
                    .map(t => padding + t)
                    .join('\n');
            });
        }
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
