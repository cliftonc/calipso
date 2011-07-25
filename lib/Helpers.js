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
 * removes any trailing query string or hash values
 * @method stripUrlToConvert
 * @param url {string} The url to convert
 * @return {String} Converted url, if applicable
 */

function stripUrlToConvert(url) {
  var qs = url.search(/\?|#/);
  if (qs > -1) {
    url = url.substring(0, qs);
  }
  return url;
}

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
   * Translation shortcut
   */
  t: function(req,res){
    return req.t;
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

    return function(block, next) {

      // TODO : Allow block to be passed as a regex (e.g. to include all scripts.* blocks)
      var output = "";
      res.renderedBlocks.get(block,function(err,blocks) {

        blocks.forEach(function(content) {
          output += content;
        });

        if(typeof next === 'function')
          next(null,output);

      });

    };
  },
  
  /**
   * Get a menu html, synchronous
   */
  getMenu: function(req, res){

    return function(menu) {

      // Render menu 
      if(res.menu[menu]) {
        var output = res.menu[menu].render(req);
        return output;        
      } else {
        return 'Menu ' + menu + ' does not exist!';
      }

    };
  },
  
  /**
   * Directly call an exposed module function (e.g. over ride routing rules and inject it anywhere)
   */
  getModuleFn: function(req, res){

    return function(req,moduleFunction,options,next) {
        
        // Call an exposed module function        
        // e.g. user.loginForm(req, res, template, block, next)
        
        // First see if function exists
        var moduleName = moduleFunction.split(".")[0];
        var functionName = moduleFunction.split(".")[1];
        
        if(calipso.modules[moduleName] && calipso.modules[moduleName].enabled && calipso.modules[moduleName].fn[functionName]) {
          
          var fn = calipso.modules[moduleName].fn[functionName];
          
          // Get the template
          var template;
          if(options.template && calipso.modules[moduleName].templates[options.template]) {
            template = calipso.modules[moduleName].templates[options.template];
          }          
          
          // Call the fn
          try {
            fn(req,res,template,null,next);
          } catch(ex) {
            next(ex);
          }          
          
        } else {         
          next(null,"<div class='error'>Function " + moduleFunction + " requested via getModuleFn does not exist or module is not enabled.</div>");
        }
        
    };
    
  },

  /**
   * Constructs individual classes based on the url request
   */
  getPageClasses: function(req, res) {
    var url = stripUrlToConvert(req.url);
    return url.split('/').join(' ');
  },
  
  /**
   * Constructs a single id based on the url request
   */
  getPageId: function(req, res) {
    var url = stripUrlToConvert(req.url),
      urlFrags = url.split('/');
    for (var i = 0, len = urlFrags.length; i < len; i++) {
      var frag = urlFrags[i];
      if (frag === '') {
        urlFrags.splice(i, 1);
      }
    }
    return urlFrags.join('-');
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
  flashMessages: function(req, res){
    return function() {
      return req.flash();
    };
  }

};
