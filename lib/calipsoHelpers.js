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

/**
 * Exports
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
   * Hot date helper
   */
  hotDate: function(req,res,calipso) {

    var hotFn = calipso.lib.prettyDate.hotDate;
    return hotFn;

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
   * TODO Include a script in the response.
   * Thoughts ... What this will actually do is add the file to a internal list.
   * It will check if any of the files are different to the last request, if so,
   * it will minify the contents of all the files, write to a temp js file, and reference
   * that in the response (e.g. in the header of the template via another helper function).
   * If nothing has changed it will just include the link to the previously generated file?
   */
  includeScript: function(req, res){

    return function(block) {

      // TODO - not yet implemented
    };
  },

  /**
   * TODO Retrieve the concatenated / minified js scripts to add to template.
   */
  getScripts: function(req, res){

    return function() {

      // TODO - not yet implemented

    };
  },

  /**
   * Flash message helpers
   */
  messages: function(req, res){
    return function() {
      return req.flash();
    };
  }

}