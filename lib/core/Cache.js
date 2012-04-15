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
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso')),
  MemoryStore = require('./cacheAdapters/memory'),
  Store = require('./cacheAdapters/store');

// Exports
exports.Cache = Cache;
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

function Cache(options) {

  var options = options || {},
    store = store || new MemoryStore(options);

  return store;

}
