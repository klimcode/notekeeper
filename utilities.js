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


module.exports = {
    'removeDuplicatesFrom': removeDuplicates,
    'getObjFromArr': getObjFromArr,
    'updateArrByObj': updateArrByObj,
}
