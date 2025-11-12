var checkProperties = function (obj, props) {
    return true;
    // return props
    //     .map(function (prop) { 
    //         return obj.hasOwnProperty(prop); })
    //     .reduce(function (p, q) { 
    //         return p && q; });
}
module.exports = checkProperties;