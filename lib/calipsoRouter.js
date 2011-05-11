/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 * 
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 */
var url = require('url'),
    fs = require('fs'),
    path = require('path'),
    calipso = require("./calipso");


/**
 * Core router object, use the return model to ensure
 * that we always return a new instance when called.
 * 
 * A Router is attached to each module, and allows each module to effectively
 * act as its own controller in a mini MVC model.
 * 
 * This class exposes:
 * 
 * addRoutes: function, to add Routes to a module.
 * route: iterate through the routes, match, and then call the matched function in the module.
 * 
 */
var Router = function(moduleName) {
  
  return {
    
    moduleName: moduleName,
    routes: [],
    configured: false,
   
    /**
     * A route is defined by three parameters:
     * 
     * path:  a string in the form 'GET /url' where the first piece is the HTTP method to respond to.
     *        OR
     *        a regex function (it matches only on GET requests).
     * fn:    the function in the module to call if the route matches.
     * options: additional configuration options, specifically:
     *    end - deprecated. TODO CLEANUP
     *    admin - is the route an administrative route (user must have isAdmin = true).
     */
    addRoute: function(path, fn, options, next) {  
      
      var router = this;
      
      // Default options
      options = options || {end:true, admin:false};
      
      // Can't do any real checking here as everything is initialised in parallel.
      router.routes.push({path: path, fn: fn, options: options});
      next();
      
    },    
    /**
     * Module routing function, iterates through the configured routes and trys to match.
     * This has been borrowed from the Express core routing module and refactored slightly 
     * to deal with the fact this is much more specific.
     */
    route: function(req, res, next) {
            
      var router = this;
      var requestUrl = url.parse(req.url,true);
      var routes = this.routes;
      
      // Use step to enable parallel execution
      calipso.lib.step(
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
              routeRegEx = normalizePath(route.path.split(" ")[1], keys);
            } else {
              routeRegEx = route.path;
            }
            
            var captures = requestUrl.pathname.match(routeRegEx);
            
            if (captures && req.method === routeMethod) {
              
              // Check to see if we matched a non /* route to flag a 404 later
              res.routeMatched = !(routeRegEx.toString() === "/.*/") || res.routeMatched;
              
              // Debugging
              calipso.silly("Module " + router.moduleName + " matched route: " + requestUrl.pathname + " / " + routeRegEx.toString() + " [" + res.routeMatched + "]");
              
              // Lookup the template for this route
              if(route.options.template) {
                template = calipso.modules[router.moduleName].templates[route.options.template];
                if(!template && route.options.template) {
                  calipso.error("The specified template: " + route.options.template + " does not exist in the module: " + router.moduleName);
                } else {
                  calipso.silly("Using template: " + route.options.template + " for module: " + router.moduleName)
                }
              }
              
              // Initialise the block if it doesn't exist
              if(route.options.block && !res.renderedBlocks[block]) {
                block = route.options.block;
                res.renderedBlocks[block] = [];
              }
              
              // Copy over any params that make sense from the url
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
              
              // Convert any url parameters
              if(requestUrl.query) {
                for(var param in requestUrl.query) {
                  req.moduleParams[param] = requestUrl.query[param];
                }
              }
              
              // Check to see if it requires admin access
              if(!route.options.admin || (route.options.admin && req.session.user && req.session.user.isAdmin)) {
                // Call the module function
                route.fn(req, res, template, block, group());
              } else {
                res.statusCode = 401;
                res.redirect("/");
              }
              
              
            }
          }
        },
        
        function allMatched(err) {
          // Once all functions have been called, log the error and pass it back up the tree.
          if(err) {
            // Enrich the error message with info on the module
            // calipso.error("Error in module " + this.moduleName + ", of " + err.message);
            err.message = err.message + " Calipso Module: " + this.moduleName;
          }
          next(err);
        }
      );
      
    }
    
  };
  
};

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

/**
 * Exports
 */
module.exports.Router = Router;