function removeDuplicates(arr) {
    for (var i = arr.length; i--;) {
        for (var j = i; j--;) {
            if (arr[j] === arr[i]) {
                arr.splice(i, 1);
                break;
            }
        }
    }
    return arr;
}
function getObjFromArr(arr) {
    let obj = {};
    arr.forEach((item) => obj[item.type] = item.content);
    return obj;
}
function updateArrByObj(arr, obj) {
    arr.forEach((item) => item.content = obj[item.type]);
    return arr;
}
function getRegexCaptures(content, regex, callback) {
    let matches, result = [];

    while ((matches = regex.exec(content)) !== null) {
        if (matches.index === regex.lastIndex) regex.lastIndex++; // This is necessary to avoid infinite loops with zero-width matches
        callback (matches.splice(1), result);
    }

    return result;
}


module.exports = {
    'removeDuplicatesFrom': removeDuplicates,
    'getObjFromArr': getObjFromArr,
    'updateArrByObj': updateArrByObj,
    'getRegexCaptures': getRegexCaptures,
}
