
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
  calipso = require(path.join(rootpath, 'lib/calipso'));

/**
 * Store object - options:
 * prefix - a prefix to attach to all cache keys, defaults to calipso.
 */
var Store = module.exports = function Store(options){
  
  this.options = options || {};
  
};

/**
* Generate a cache key - applies to all store types
*/
Store.prototype.getCacheKey = function(type, name, params) {
  
   var prefix = this.options.prefix || "calipso";   
   var cacheKey = prefix + "::" + type + '::' + name, paramCount = 0;
   
   if(params) {
     cacheKey += "::";
     calipso.lib._.each(params,function(param,key) {
        if(param) {
          cacheKey += (paramCount > 0 ? ":" : "") + (param ? (key + "=" + param) : "");
          paramCount += 1;
        }
     });
   }
   return cacheKey; 
}