
/*!
 * Calipso - cache - Memory Store
 * Approach copied from Connect session store
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Store = require('./store');

/**
 * Initialize a new `MemoryStore`.
 *
 * @api public
 */

var MemoryStore = module.exports = function MemoryStore(options) {
  this.cache = {};
  this.options = options || {};
};

/**
 * Inherit from `Store.prototype`.
 */
MemoryStore.prototype.__proto__ = Store.prototype;

/**
 * Attempt to fetch cache by the given `key'.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.get = function(key, fn){
  var self = this;
  //process.nextTick(function(){
    var cache = self.cache[key];
    if (cache) {
      fn(null, cache.item);
    } else {
      fn(new Error('Cache miss: ' + key));
    }
  //});
};

/**
 * Check cache by the given `key'.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.check = function(key, fn){
  var self = this;
  var cache = self.cache[key];
  if (cache) {
    // Check to see if it has expired
    if (!cache.expires || Date.now() < cache.expires) { // TODO
      fn(null, true);
    } else {
      self.destroy(key, fn);
    }
  } else {
    fn(null,false);
  }
};

/**
 * Add an item to the cache, referenced by key
 * with expires
 *
 * @param {String} key
 * @param {String} item
 * @param {Number} expires (milliseconds)
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.set = function(key, item, ttl, fn){
  var self = this;
  //process.nextTick(function(){
    ttl = ttl || (self.options.ttl || 600);
    var expires = Date.now() + ttl;
    self.cache[key] = {item:item,expires:expires}
    fn && fn();
  //});
};

/**
 * Destroy the session associated with the given `key`.
 *
 * @param {String} key
 * @api public
 */

MemoryStore.prototype.destroy = function(key, fn){
  var self = this;
  //process.nextTick(function(){
    delete self.cache[key];
    fn && fn();
  //});
};

/**
 * Invoke the given callback `fn` with all active sessions.
 *
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.all = function(fn){
  var arr = []
    , keys = Object.keys(this.cache);
  for (var i = 0, len = keys.length; i < len; ++i) {
    arr.push(this.cache[keys[i]]);
  }
  fn(null, arr);
};

/**
 * Clear cache
 *
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.clear = function(fn){
  this.cache = {};
  fn && fn();
};

/**
 * Fetch number of cache items
 *
 * @param {Function} fn
 * @api public
 */

MemoryStore.prototype.length = function(fn){
  fn(null, Object.keys(this.cache).length);
};
