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
      step: require('step'), 
      sys: require('sys'),
      mongoose: require('mongoose'),          
      url: require('url'),        
      ejs: require('ejs'),
      pager: require("../utils/pager.js")         
    },
    sessionCache: {},
    mr: {},  // Track running MR operations
    theme: {},
    data: {},     // Holds global config data
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

      // Theme
      configureTheme(calipso, function() {
        // Do nothing
      });      
      
      initModules(calipso, function() {
        // Do nothing
      });
                    
      return function(req,res,next) {             
             
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
  
  // Configure Modules
  calipso.lib.step(             
      function loadAllModules() {                              
          var group = this.group();                                                   
          for(var module in calipso.modules) {                     
              if(calipso.modules[module].enabled) {              
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
            configureTheme(calipso, self);                  
          });      
          
        } else {         
          this();          
        }
        
      },
      function allRouted(err) {                 
        if(err) {
          calipso.error(err);
        }      
        if(!res.routeMatched) {
          res.statusCode = 404;
        }
        if(app.install) { 
          app.install = false;
          res.redirect("/admin/install");
        } else {          
                    
          // If we have now reached the end!
          switch(res.statusCode) {
            case 404:              
              res.send("404");
              break;
            case 500:
              res.send("500");              
              break;
            case 200:      
              // Override the Express powered by
              if(res.format === 'json') {
                // Do nothing!
              } else {
                res.header('X-Powered-By',"Calip.so");                
                calipso.theme.render(req,res,next);  
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
  
  calipso.lib.step(             
      function loadAllModules() {                              
          var group = this.group();                                                   
          for(var module in calipso.modules) {
              if(calipso.modules[module].enabled) {              
                calipso.modules[module].fn.init(calipso.modules[module],calipso.app,group());
              }
          };               
      },
      function allLoaded(err) {   
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