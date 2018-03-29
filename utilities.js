module.exports = {
    removeDuplicates (arr) {
        return arr.filter ((el, pos, a) => (a.indexOf(el) == pos) && el );
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
    swap (arr, a, b) {
        let temp = arr[a];
        arr[a] = arr[b];
        arr[b] = temp;
        return arr;
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
    searchName (base, name) {
        return name ?
            base.findIndex (record => this.isEqual (record.name, name) ) :
            -1;     // empty name equals to uniq name
    },

    // TREE VIEW
    buildTree (base, rootIndex) {
        const TREE = require('./tree');
        const isEqual = this.isEqual;
        const baseConverted = base
            .map ((record, index) => ({
                id: index,
                parents: record.tags,
            }));
        const rootId = rootIndex;

        const flattenTree = TREE.getFlatten (baseConverted, rootId, compareParents, compareNodes);


        let result = flattenTree.map (node => {
            const record = base[node.id];
            return {
                name: record.name,
                text: record.text,
                tags: record.tags,
                modifier: node.level
            };
        });
        if (flattenTree.error !== undefined) result.error = base[flattenTree.error].name;
        return result;


        function compareParents (recordIndex, tag) {
            const recordName = base[recordIndex].name;
            return isEqual (recordName, tag);
        }
        function compareNodes (indexA, indexB) {
            console.log(base[indexA].name);
            return base[indexA].name > base[indexB].name ? 1 : -1
        }
    },

    // CONSOLE
    LOG (msg) {
        G.isLogging && console.log ('\x1b[2m%s\x1b[0m', msg);
    },
    ERR (msg) {
        console.error ('\x1b[31m%s\x1b[0m', msg);
    },
}
