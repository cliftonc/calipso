/*!
 * Calipso Core Library - Storage of Rendered Blocks
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This class controls the storage and retrieval of blocks rendered via the Router, e.g. specific pieces of output.
 *
 */

/**
 * Holder for rendered blocks (get / set)
 * Idea is that this will give us an opportunity
 * to cache expensive sections of a page.
 */
function RenderedBlocks(cache) {

  this.content = {};
  this.contentCache = {};
  this.cache = cache;

}

/**
 * Set block content
 */
RenderedBlocks.prototype.set = function (block, content, layout, next) {

  var cacheKey = calipso.helpers.getCacheKey('block',block,true);
  this.content[block] = this.content[block] || [];
  this.content[block].push(content);

  // If we are caching, then cache it.
  if(this.contentCache[block]) {
    this.cache.set(cacheKey,{content:content,layout:layout},null,next);
  } else {
    next();
  }

};

/**
* Get block content
*/
RenderedBlocks.prototype.get = function (key, next) {

  // Check to see if the key is a regex
  if (typeof key === 'function') {
    var item, items = [];
    for (item in this.content) {
      if (this.content.hasOwnProperty(item)) {
        if (item.match(key)) {
          items.push(this.content[item]);
        }
      }
    }
    next(null, items);
  } else {
    next(null, this.content[key] || []);
  }

};

/**
* Get content from cache and load into block
*/
RenderedBlocks.prototype.getCache = function (key, block, next) {

  var self = this;
  this.cache.get(key,function(err,cache) {

    self.content[block] = self.content[block] || [];
    self.content[block].push(cache.content);
    next(err,cache.layout);

  });

}

module.exports.RenderedBlocks = RenderedBlocks;
