function removeClonesFrom(arr) {
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


module.exports = {
    'removeClonesFrom': removeClonesFrom,
}
