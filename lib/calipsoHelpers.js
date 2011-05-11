/*!
 * Calipso Core Library
 * 
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 * 
 *  Dynamic helpers for insertion into the templating engine
 *  They all need to take in a req,res pair, these are then
 *  interpreted during the request stack and passed into the
 *  view engine (so for example 'request' is accessible).
 */

exports = module.exports = {
  
  /**
   * Request shortcut
   */
  request: function(req,res){
    return req;
  },
  
  /**
   * User shortcut
   */
  user: function(req,res){
    return req.session && req.session.user || { username: '', anonymous: true };
  },
  
  /**
   * Pretty date helper
   */
  prettyDate: function(req,res,calipso) {
    
    var prettyFn = calipso.lib.prettyDate.prettyDate;
    return prettyFn;
    
  },
  
  /**
   * Get block data not included preloaded in the theme configuration (in blockData)
   */
  getBlock: function(req, res){
    
    return function(block) {
      
      // TODO : Allow block to be passed as a regex (e.g. to include all scripts.* blocks) 
      if(res.renderedBlocks[block]) {
        var output = "";
        res.renderedBlocks[block].forEach(function(content) {
          output += content;
        });
        return output;
      }
      // else return ""; // ?
    };
  },
  
  /**
   * Flash message helpers
   */
  hasMessages: function(req, res) {
    return Object.keys(req.session.flash || {}).length;
    // return false;
  },
  messages: function(req, res){
    return function() {
      var msgs = req.flash();
      return Object.keys(msgs).reduce(function(arr, type){
        return arr.concat(msgs[type]);
      }, []);
    };
  }
  
}