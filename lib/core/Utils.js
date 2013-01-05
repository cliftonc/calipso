/**
 * General utility methods
 */
var _ = require('underscore');

module.exports = {
  /**
   * Basically like getProperty, different return
   * @method hasProperty
   * @param ns {string} A period delimited string of the namespace to find, sans root object
   * @param obj {object} The root object to search
   * @return {boolean} true if property exists, false otherwise
   */
  hasProperty:function (ns, obj) {
    if (!ns) {
      return obj;
    }
    var nsArray = ns.split('.'),
      nsLen = nsArray.length,
      newNs;

    // if nsLen === 0, then obj is just returned
    while (nsLen > 0) {
      newNs = nsArray.shift();
      if (obj[newNs]) {
        obj = obj[newNs];
      } else {
        return false;
      }
      nsLen = nsArray.length;
    }
    return true;
  },
  /**
   * Find a namespaced property
   * @method getProperty
   * @param ns {string} A period delimited string of the namespace to find, sans root object
   * @param obj {object} The root object to search
   * @return {object} the object, either the namespaced obejct or the root object
   */
  getProperty:function (ns, obj) {
    if (!ns) {
      return obj;
    }
    var nsArray = ns.split('.'),
      nsLen = nsArray.length,
      newNs;

    // if nsLen === 0, then obj is just returned
    while (nsLen > 0) {
      newNs = nsArray.shift();
      if (obj[newNs]) {
        obj = obj[newNs];
      }
      nsLen = nsArray.length;
    }
    return obj;
  },

  /**
   * Simple mongo object copier, used to do a shallow copy of objects
   */
  copyMongoObject:function (object, copy, schema) {

    var fields = _.keys(schema.paths);
    _.each(fields, function (key) {
      if (key !== '_id') {
        copy.set(key, object.get(key));
      }
    });

  },
  escapeHtmlQuotes:function (string) {
    if (string && string.replace) {
      return string.replace(/\"/g, '&quot;').replace(/\'/g, '&apos;');
    }
    else {
      return string;
    }
  }
};
