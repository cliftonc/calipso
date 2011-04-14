/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 * 
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 * 
 */
var url = require('url'),Step = require('step'),fs = require('fs'),path = require('path'), calipso = require("./calipso");

module.exports.Router = function(moduleName) {
  
  return {
    
    moduleName: moduleName,
    routes: [],
    configured: false,
    addRoute: function(path, fn, options, next) {  
      
      var router = this;
      
      // Default options
      options = options ? options : {end:true, admin:false};
      
      // Can't do any real checking here as everything is initialised in parallel.
      router.routes.push({path: path, fn: fn, options: options});
      next();
      
    },    
    route: function(req, res, next) {
      
      var router = this;
      var requestUrl = url.parse(req.url);
      var routes = this.routes;      
        
      Step (
          function matchRoutes() {

            var group = this.group(); // Enable parallel execution
            var counter = 0;
            
            for (var i = 0, l = routes.length; i < l; i++) {
              
              var keys = [];
              var route = routes[i];
              var template = null, block = "";
                            
              var routeMethod = "GET";
              var routeRegEx; 
                
              if(typeof route.path === "string") {
                  routeMethod = route.path.split(" ")[0];
                  routeRegEx = normalizePath(route.path.split(" ")[1],keys);          
              } else {
                  routeRegEx = route.path
              }        
                            
              var captures = requestUrl.pathname.match(routeRegEx);
              
              if (captures && req.method === routeMethod) {                                
                
                // Check to see if we matched a non /* route to flag a 404 later
                res.routeMatched = !(routeRegEx.toString() === "/.*/") || res.routeMatched;
                                
                // Lookup the template for this route
                if(route.options.template) {
                  template = calipso.modules[router.moduleName].templates[route.options.template];
                  if(!template && route.options.template) {
                    calipso.error("The specified template: " + route.options.template + " does not exist in the module: " + router.moduleName);
                  }                  
                } 
                
                // Initialise the block if it doesn't exist
                if(route.options.block && !res.renderedBlocks[block]) {
                  block = route.options.block;                 
                  res.renderedBlocks[block] = [];
                }
                                
                // Copy over any params that make sense                      
                req.moduleParams = [];                    
                
                for (var j = 1, len = captures.length; j < len; ++j) {
                  var key = keys[j-1],
                    val = typeof captures[j] === 'string'
                      ? decodeURIComponent(captures[j])
                      : captures[j];
                  if (key) {
                    req.moduleParams[key] = val;
                  } else {
                    req.moduleParams.push(val);
                  }
                } 
                
                req.route_index = i;    
                
                // Check to see if it requires admin access
                if(!route.options.admin || (route.options.admin && req.session.user && req.session.user.isAdmin)) {                  
                  route.fn(req,res,template,block,group());                                
                } else {
                  res.statusCode = 401;
                  res.redirect("/");
                }
                
                if(route.options.end) {
                    // skip all remaining matches
                    i = routes.length;
                }
                                                
              }              
            }
          },
          function allMatched() {            
              next();
          }
      )       
      
    }
     
  };
  
}

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * BORROWED FROM Connect
 *
 * @param  {String} path
 * @param  {Array} keys
 * @return {RegExp}
 * @api private
 */

function normalizePath(path, keys) {
  path = path
    .concat('/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function(_, slash, format, key, capture, optional){
      keys.push(key);
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || '([^/]+?)') + ')'
        + (optional || '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.+)');
  
  return new RegExp('^' + path + '$', 'i');
}
