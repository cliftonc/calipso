/*!
 * Calipso Core Caching Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This is the core Calipso library that enables caching to be turned on
 * that will cache both module and full page output.
 *
 * The idea is to have a pluggable cache storage module, copied liberally
 * from concepts behind the express session module.
 *
 *
 *
 */
var MemoryStore = require('./cache/memory')
  , Store = require('./cache/store');

// Exports
exports.cache = cache;
exports.Store = Store;
exports.MemoryStore = MemoryStore;

/**
 * Very simple wrapper that
 * Enables pluggability of cache store, defaulting to in Memory
 *
 *    cache.set('cc','RAH!',500,function() {
 *       cache.get('cc',function(err,item) {
 *         console.log(item);
 *       });
 *    });
 *
 */
function cache(options){

  var options = options || {},
      store = store || new MemoryStore(options);

  return store;

}
