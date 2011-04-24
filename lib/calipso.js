/**
 * Calip.so Core Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 */

/**
 * Module dependencies
 */
var sys = require("sys");

/**
 * Calip.so Module
 */
module.exports = {

    /**
     * Export module dependencies, reduces need for later modules to require everything.
     */  
    lib: { 
      fs: require('fs'), 
      path: require('path'), 
      express: require('express'), 
      step: require('../support/step'), 
      sys: require('sys'),
      mongoose: require('mongoose'),          
      url: require('url'),        
      ejs: require('ejs'),
      pager: require("../utils/pager"),
      prettyDate: require("../utils/prettyDate.js")    
    },
    sessionCache: {},    
    dynamicHelpers: require('./calipsoHelpers'), // Helpers
    getDynamicHelpers: function(req,res) {
        var helpers = {};
        for(var helper in this.dynamicHelpers) {
            helpers[helper] = this.dynamicHelpers[helper](req,res,this);
        }
        return helpers;
    },
    mr: {},             // Track running MR operations
    theme: {},
    data: {},           // Holds global config data
    modules: {},    
    
    /**
     * Core router and initialisation function
     */
    calipsoRouter: function(app,options) {
  
      // Store our references and options
      var calipso = this;
      calipso.app = app;
      
      var options = options ? options : {};
      
      // Logger
      configureLogging(calipso,options);
      
      // Load all the modules
      loadModules(calipso,options);

      // Initialise the modules and then the theming engine
      initModules(calipso,function() {
        calipso.silly("Modules loaded ...");
        configureTheme(calipso,function() {
          calipso.silly("Theme loaded ...");
          // Do nothing ...
          
        });                  
      });                       
                    
      // Return the function that manages the routing
      return function(req,res,next) {             
             
         // Clear our menus and blocks for each request
         res.menu = {admin:{primary:[],secondary:[]},primary:[],secondary:[]};
         
         res.blocks = {};
         res.renderedBlocks = {};
         
         routeModules(req,res,next,calipso,app);
         
                  
      };         
  }

}

/** 
 * Module Router
 * 
 * @param req
 * @param res
 * @param next
 * @param calipso
 * @param app
 */

function routeModules(req,res,next,calipso,app) {
  
  // Just in case there is a twist and media slips through
  if(req.url.match(/^\/images|^\/js|^\/css|^\/favicon.ico/)) {
    next()
    return;
  }
  
  // Initialise the response re. matches
  res.routeMatched = false;
  
  // Route Modules
  calipso.lib.step(             
      function routeAllModules() {                              
          var group = this.group();                                                   
          for(var module in calipso.modules) {                     
              if(calipso.modules[module].enabled) {  
                calipso.silly("Routing module " + module);
                calipso.modules[module].fn.route(req,res,calipso.modules[module],app,group());
              }
          };               
      },
      function reloadConfig() {        
        
        if(res.reloadConfig) {                                                                   
          
          var self = this;
          app.set('config',calipso.config);               
          calipso.config = null;          
          configureLogging(calipso,app.set('config'));  
          loadModules(calipso,app.set('config'));            
          res.reloadConfig = null;               
          initModules(calipso,function() {
            calipso.silly("Modules loaded ...");
            configureTheme(calipso,function() {
              calipso.silly("Theme loaded ...");
              self();
            });                  
          });                  
                              
        } else {         
          
          this();
          
        }
        
      },
      function allRouted(err) {                
        
        calipso.silly("All routed ...");
        
        if(err) {
          calipso.error(err);
        }
        
        if(!res.routeMatched) {
          
          calipso.silly("No routes matched the current URL!");
          res.statusCode = 404;
          
        }
        
        if(app.install) { 
          
          app.install = false;
          app.doingInstall = true;
          res.redirect("/admin/install");
          
        } else {          
                                        
          // If we have now reached the end!
          switch(res.statusCode) {
            
            case 404:              
              // Handled by normal router              
            case 500:
              // Handled by normal router                            
            case 200:                    
              
              if(res.format === 'json') {               
                // Assume response already sent                
              } else {                                               
                calipso.theme.render(req,res,function(content) {
                  res.end(content,'utf-8');  
                });                                                       
              }              
              break;
              
            default:
              // Do Nothing
              
          }
                    
        };
      }           
  );
     
}

/**
 * Logging configuration
 * @param calipso
 * @param options
 */
function configureLogging(calipso,options) {

  //Configure logging
  var logMsg = "\x1b[36mLogging enabled: \x1b[0m";
  var winston = require("winston");
 
  try {
    winston.remove(winston.transports.File);  
  } catch(ex) {
    // Ignore the fault
  }
  if(options.logs.file.enabled) {        
    winston.add(winston.transports.File, { level: options.logs.level, filename: options.logs.file.filepath });
    logMsg += "File @ " + options.logs.file.filepath + " ";
  }
    
  try {
    winston.remove(winston.transports.Console);  
  } catch(ex) {
    // Ignore the fault
  }
  if(options.logs.console.enabled) {
    winston.add(winston.transports.Console, { level: options.logs.level, colorize: true });
    logMsg += "Console ";
  }
  
  // Output what our log levels are set to.
  console.log(logMsg);
  
  calipso.lib.winston = winston; 
  
  // Shortcuts to Default
  calipso.log = winston.info; // Default function
  
  // Shortcuts to NPM levels
  calipso.silly = winston.silly;
  calipso.verbose = winston.verbose; 
  calipso.info = winston.info;
  calipso.warn = winston.warn;
  calipso.debug = winston.debug; 
  calipso.error = winston.error;
   
}

/**
 * Module initialisation
 */
function initModules(calipso,next) {
  
  // Create a list of all our enabled modules
  var enabledModules = [];  
  for(var module in calipso.modules) {            
    if(calipso.modules[module].enabled) {
      enabledModules.push(module);
    }
  }

  // Initialise them all
  calipso.lib.step(             
      function loadAllModules() {                                        
          var group = this.group();          
          enabledModules.forEach(function(module) {                          
              calipso.modules[module].fn.init(calipso.modules[module],calipso.app,group());  
          });                         
      },
      function allLoaded(err) {   
        calipso.silly("All modules initialised ...");
        next();
      }           
  );
  
}

/**
 * Load Modules
 * @param calipso
 * @param options
 * @returns
 */
function loadModules(calipso,options) {
  
  var options = options ? options : {};
  var modules = [];
  var configuredModules = {};
  
  options.modules.forEach(function(module) {
      configuredModules[module.name] = {enabled:module.enabled};
  });    
  
  // Run any disable and reload hooks
  for(var module in calipso.modules) {
        
    // Check to see if the module is currently enabled, if we are disabling it.
    if (calipso.modules[module].enabled && configuredModules[module].enabled == false && typeof calipso.modules[module].fn.disable === 'function') {
      
      calipso.modules[module].fn.disable();
    } else {
      
      // Check to see if the module has a reset function
      if (typeof calipso.modules[module].fn.reload === 'function') {
        
        calipso.modules[module].fn.reload();
      }
      
    }    
  };
   
  delete calipso['modules'];      // 'Delete' it.
  calipso.modules = {};         // Always reset it - TODO : Create a hook for disabling modules  
    
  calipso.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(name){
      if(name != "README") {
        
        var enabled = configuredModules[name] ? configuredModules[name].enabled : false;
        
        calipso.modules[name] = {name:name, 
                                enabled:enabled,
                                fn:require('../modules/' + name + '/' + name + '.module'), 
                                router:require('./calipsoRouter').Router(name),
                                templates:loadModuleTemplates(calipso,__dirname + '/../modules/' + name + '/templates')};
      }
  });
  
  return calipso.modules;
    
};

/** 
 * Pre load all the templates in a module, synch, but only happens on app start up and config reload
 * This is attached to the templates attribute so used later.
 * 
 * @param calipso
 * @param moduleTemplatePath
 * @returns template object
 */
function loadModuleTemplates(calipso,moduleTemplatePath) {
  
  var templates = {};
  
  if(calipso.lib.path.existsSync(moduleTemplatePath)) {        

    calipso.lib.fs.readdirSync(moduleTemplatePath).forEach(function(name){
      
      var template=calipso.lib.fs.readFileSync(moduleTemplatePath + "/" + name, 'utf8');
      if(template) {      
        templates[name.replace(/\.html$/,'')] = calipso.lib.ejs.compile(template);
      }
      
    });
    
    return templates;   

  } else {
    return;
  }
  
};

/**
 * Configure a theme
 * @param calipso
 * @param next
 */
function configureTheme(calipso, next) {
  
  var themeName = calipso.app.set('config').theme;  
  
  require('./calipsoTheme').Theme(themeName,function(theme) {
     calipso.theme = theme;
     next();
  });
  
};