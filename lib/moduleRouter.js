
/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 * 
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 * 
 */
var url = require('url'),Step = require('step'),fs = require('fs'),path = require('path');

module.exports.Router = function() {
  
  return {
      
    routes: [],
    configured: false,
    addRoute: function(path, fn, options, next) {  
      
      var router = this;
      
      options = options ? options : {end:true, admin:false, templatePath:''};     
      
      if(options.templatePath) {        
        loadTemplate(options.templatePath, function(data) {
          if(data) {            
            options.templateData = data;
          }
          router.routes.push({path: path, fn: fn, options: options});
          next();
        });
      } else {
        options.templateData = '';
        router.routes.push({path: path, fn: fn, options: options});
        next();
      }            
    },    
    route: function(req, res, next) {
      
      var requestUrl = url.parse(req.url);
      var matched = false;
      var routes = this.routes;      
        
      Step (
          function matchRoutes() {

            var group = this.group(); // Enable parallel execution
            var counter = 0;
            
            for (var i = 0, l = routes.length; i < l; i++) {
              
              var keys = [];
              var route = routes[i];
              var template = route.options.templateData;
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
                
                // Copy over any params that make sense
                matched = true;      
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
                  route.fn(req,res,group(),template);                                
                } else {
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
 * Load a template
 */

function loadTemplate(templatePath, next) {
    
  path.exists(templatePath,function(exists) {
    if(exists) {
      fs.readFile(templatePath, 'utf8', function(err,data) {
           if(!err) {
             next(data);               
           } else {
             next('');
           }
      });
    } else {
      console.log("CANT FIND " + templatePath);
      next('');
    }
  });
  
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
