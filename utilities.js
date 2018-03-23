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
    searchDuplicate (base, name) {
        return name ?
            base.findIndex (record => this.isEqual (record.name, name) ) :
            -1;     // empty name equals to uniq name
    },

    // TREE VIEW
    treeView (mainBase) {
        const isEqual = this.isEqual;
        let tree = [];  
        let root = { _childrenIds: [] };


        mainBase.forEach ((record, i) => { // set IDs, parents and children
            if (!record.text.trim()) return; // jump over empty records
            record._id = i;
            record._parentsIds = getParentsIds (record.tags, mainBase);  // find Ids of all parents (tags)
            setChild (record, mainBase, root);  // register the record in each parent's record as a child
        });

        makeTree (root, mainBase, tree);

        
        return tree;

        function getParentsIds (parents, base) {
            let len = parents.length;
            if (!len || !parents[0]) return ['root'];

            let parentIds = Array (len);
            for (let i=0; i<len; i++) {
                let tag = parents[i];
                let id = base.findIndex (e => isEqual (e.name, tag));

                if (id !== -1) parentIds[i] = id;
                else parentIds[i] = 'root'; 
            };
            return parentIds;
        }
        function setChild (record, base, root) {
            let parents = record._parentsIds;
            for (let i=0; i<parents.length; i++) {
                let parentId = parents[i];
                let parent = parentId === 'root' ? root : base[parentId];
                if (!parent._childrenIds) parent._childrenIds = [record._id];
                else parent._childrenIds.push (record._id);
            }
        }
        function makeTree (root, base, tree) {
            if (!root._childrenIds) return;

            let level = root.level || 0;

            root._childrenIds.forEach (childId => {
                let child = base[childId];
                child.level = level + 1;

                tree.push ({
                    name: child.name,
                    text: child.text,
                    modifier: child.level,
                });

                makeTree (child, base, tree);
            });
        }
    },

    // CONSOLE
    LOG (msg) {
        G.isLogging && console.log ('\x1b[2m%s\x1b[0m', msg);
    },
    ERR (msg) {
        console.log ('\x1b[31m%s\x1b[0m', msg);
    },
}
