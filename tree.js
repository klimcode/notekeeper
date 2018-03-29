let stack = []; // to search circular linkss

module.exports = {
    getFlatten (array, rootId, compareParents, compareChildren) {
        if (!array || !array[0]) return [];
        if (!compareParents) return false;
        
        let result = [];
        let tree = createTree (array, compareParents, result);
        // specifiedRoot -- a root specified by a command like "tree js" (not the main root)
        let specifiedRoot = rootId==null ? tree['root'] : tree[rootId]; // null==undefined


        // recursive functions
        checkCircular (tree['root'], tree, stack, result);
        compareChildren && sortChildren (specifiedRoot, tree, compareChildren);
        scanTree (specifiedRoot, tree, result);

        return result;
    }
}


function createTree (array, compareParents, result) {
    let tree = array.map (el => ({id: el.id, parents: el.parents}));
    tree.isCircular = false;
    tree['root'] = { level: 0, children: [] };

    tree.forEach ((node, i, tree) => {
        const parents = node.parents;
        if (!parents.length || parents[0]==='') { // direct root children
            tree['root'].children.push (node.id);
            return;
        }

        for (let i=0; i<parents.length; i++) {
            const parentName = parents[i];
            const parentIndex = tree.findIndex (n => compareParents(n.id, parentName));
            const parent = (parentIndex === -1) ? tree['root'] : tree[parentIndex];

            if (!parent.children) parent.children = [node.id];
            else parent.children.push (node.id);
        };
    });
    if (tree['root'].children.length === 0) {
        tree.isCircular = true;
        result.error = 0;
        console.error ('Root records were not found');
    }
    return tree;
}
function checkCircular (node, tree, stack, result) {
    if (tree.isCircular) return;
    let children = node.children;

    
    if (children) {
        const newStackTop = {id: node.id, i: 0};
        if (!stack.length) stack.push (newStackTop); // root
        
        if (stack[stack.length-1].id !== node.id) {
            // Searching Circular links
            const victimIndex = stack.findIndex (e => e.id === newStackTop.id);
            if (victimIndex !== -1) {
                const victimId = stack[victimIndex].id;
                const errorLinkId = stack[stack.length-1].id;
                
                result[0] = tree[victimId];
                result.error = errorLinkId;
                tree.isCircular = true;
                console.error ('Circular link is found!');
                return;
            }

            stack.push (newStackTop);
        }
        let stackTop = stack[stack.length-1];
        
        while (children.length > stackTop.i) {
            const childId = children[stackTop.i];
            const child = tree[childId];
            
            stackTop.i++;
            checkCircular (child, tree, stack, result);
        }

        stack.pop();
    }
}
function sortChildren (node, tree, compareChildren) {
    if (tree.isCircular) return;

    let children = node.children;
    if (!children) return;

    if (children.length > 1) children.sort (compareChildren);

    children.forEach (childId => {                
        sortChildren (tree[childId], tree, compareChildren);
    });
}
function scanTree (node, tree, result) {
    if (tree.isCircular) return;
    
    let level = node.level || 0;
    
    // Only tree.root does not have an "id" property
    // If a node has an "id" it's a specified root and must be showed
    if (level === 0 && node.id != undefined) {
        level = 1;
        result.push ({
            id: node.id,
            level,
        });
    }
    
    if (!node.children) return; // no children? finish it
    node.children.forEach (childId => { // pushing children
        let child = tree[childId];
        child.level = level + 1;

        result.push ({
            id: childId,
            level: child.level,
        });

        scanTree (child, tree, result);
    });
}
