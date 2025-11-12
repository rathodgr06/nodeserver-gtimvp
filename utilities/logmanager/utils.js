/**
 * Creates nicely looking string representation of object.
 *
 * @param {Object} objectToFormat the object to format into a string.
 */
exports.prettyString = function prettyString(objectToFormat) {
  return JSON.stringify(objectToFormat, undefined, 5);
};

/**
 * Tests if x is of wanted type.
 *
 * @param {*} x the thing to check for
 * @param {String} wantedType the expected or wanted type
 */
exports.isType = function isType(x, wantedType) {
  return Object.prototype.toString.call(x) === `[object ${wantedType}]`;
};
