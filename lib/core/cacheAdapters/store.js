/*!
 * Calipso - cache - Store
 * Concepts taken from connect session
 * MIT Licensed
 */

/**
 * Initialize abstract `Store`.
 *
 * @api private
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', '..', 'calipso'));

/**
 * Store object - options:
 * prefix - a prefix to attach to all cache keys, defaults to calipso.
 */
var Store = module.exports = function Store(options) {

  this.options = options || {};

};

/**
 * Generate a cache key - applies to all store types
 */
Store.prototype.getCacheKey = function (keys, params) {

  var prefix = this.options.prefix || "calipso";

  // Append the theme, allows for theme change
  var cacheKey = prefix + "::" + calipso.theme.theme, paramCount = 0;

  // Create the key from the keys
  keys.forEach(function (value) {
    cacheKey += "::" + value;
  })

  var qs = require("querystring");

  if (params) {
    cacheKey += "::";
    calipso.lib._.each(params, function (param, key) {
      if (param) {
        cacheKey += (paramCount > 0 ? "::" : "") + (param ? (key + "=" + qs.escape(param)) : "");
        paramCount += 1;
      }
    });
  }

  return cacheKey;
}