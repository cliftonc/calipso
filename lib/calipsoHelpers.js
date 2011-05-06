/**
 *  Dynamic helpers for insertion into the templating engine
 *  They all need to take in a req,res pair, these are then
 *  interpreted during the request stack and passed into the
 *  view engine (so for example 'request' is accessible).
 *
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
  
  prettyDate: function(req,res,calipso) {
    
    var prettyFn = calipso.lib.prettyDate.prettyDate;
    return prettyFn;
    
  },
  
  /**
   * Get block data not included in the theme configuration
   */
  getBlock: function(req, res){
    
    return function(block) {
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
   * Flash message helper
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