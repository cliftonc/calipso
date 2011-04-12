var sys = require("sys");

/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 */

module.exports = {

    /**
     * Export module dependencies, reduces need for later modules to require everything.
     */  
    lib: { 
      fs: require('fs'), 
      express: require('express'), 
      step: require('step'), 
      sys: require('sys'),
      mongoose: require('mongoose'),          
      url: require('url'),        
      ejs: require('ejs'),
      pager: require("../utils/pager.js")         
    },            
    data: {},     // Holds temporary config data
    modules: {},    
    
    /**
     * Core router and initialisation function
     */
    ncmsRouter: function(app,options) {
  
      // Store our references and options
      var ncms = this;
      ncms.app = app;
      
      var options = options ? options : {};
      
      // Logger
      configureLogging(ncms,options);
      
      // Load all the modules
      loadModules(ncms,options);

      initModules(ncms,app,function() {
        // Do nothing
      });
                    
      return function(req,res,next) {             
             
         res.menu = {admin:[],primary:[],secondary:[]};
         
         res.blocks = {header:[],
             footer:[],
             left:[],
             body:[],
             right:[]};
         
         res.renderedBlocks = {header:[],
             footer:[],
             left:[],
             body:[],
             right:[]};          
         
         routeModules(req,res,next,ncms,app);
                  
      };         
  }

}

function routeModules(req,res,next,ncms,app) {

  
  // Configure Modules
  ncms.lib.step(             
      function loadAllModules() {                              
          var group = this.group();                                                   
          for(var module in ncms.modules) {                     
              if(ncms.modules[module].enabled) {              
                ncms.modules[module].fn.route(req,res,ncms.modules[module],app,group());
              }
          };               
      },
      function reloadConfig() {
        
        if(res.reloadConfig) {                                                         
          app.set('config',ncms.config);               
          ncms.config = null;          
          configureLogging(ncms,app.set('config'));  
          loadModules(ncms,app.set('config'));            
          res.reloadConfig = null;          
          initModules(ncms,app,this);          
        } else {          
          this();          
        }
        
      },
      function allRouted(err) {                 
        if(err) {
          ncms.error(err);
        }      
        if(app.install) { 
          app.install = false;
          res.redirect("/admin/install");
        } else {
          if(res.statusCode == 200) {   
            res.render("pages/index",{menu:res.menu,blocks:res.blocks,renderedBlocks:res.renderedBlocks});               
          };
        };
      }           
  );
     
}

function configureLogging(ncms,options) {

  //Configure logging
  var winston = require("winston");
 
  try {
    winston.remove(winston.transports.File);  
  } catch(ex) {
    // Ignore the fault
  }
  if(options.logs.file.enabled) {        
    winston.add(winston.transports.File, { level: options.logs.level, filename: options.logs.file.filepath });    
  }
    
  try {
    winston.remove(winston.transports.Console);  
  } catch(ex) {
    // Ignore the fault
  }
  if(options.logs.console.enabled) {
    winston.add(winston.transports.Console, { level: options.logs.level, colorize: true });
  }
  
  ncms.lib.winston = winston; 
  
  // Shortcuts to Default
  ncms.log = winston.info; // Default function
  
  // Shortcuts to NPM levels
  ncms.silly = winston.silly;
  ncms.verbose = winston.verbose; 
  ncms.info = winston.info;
  ncms.warn = winston.warn;
  ncms.debug = winston.debug; 
  ncms.error = winston.error;
   
}

function initModules(ncms,app,next) {
  
  ncms.lib.step(             
      function loadAllModules() {                              
          var group = this.group();                                                   
          for(var module in ncms.modules) {
              if(ncms.modules[module].enabled) {              
                ncms.modules[module].fn.init(ncms.modules[module],app,group());
              }
          };               
      },
      function allLoaded(err) {   
        next();
      }           
  );
  
}

function loadModules(ncms,options) {
  
  var options = options ? options : {};
  var modules = [];
  var configuredModules = {};
  
  options.modules.forEach(function(module) {
      configuredModules[module.name] = {enabled:module.enabled};
  });    
  
  // Run any disable and reload hooks
  for(var module in ncms.modules) {
        
    // Check to see if the module is currently enabled, if we are disabling it.
    if (ncms.modules[module].enabled && configuredModules[module].enabled == false && typeof ncms.modules[module].fn.disable === 'function') {
      
      ncms.modules[module].fn.disable();
    } else {
      
      // Check to see if the module has a reset function
      if (typeof ncms.modules[module].fn.reload === 'function') {
        
        ncms.modules[module].fn.reload();
      }
      
    }    
  };
  
  delete ncms['modules'];      // 'Delete' it.
  ncms.modules = {};         // Always reset it - TODO : Create a hook for disabling modules  
  
  
  ncms.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(name){
      if(name != "README") {
        
        var enabled = configuredModules[name] ? configuredModules[name].enabled : false;
        
        ncms.modules[name] = {name:name, 
                              enabled:enabled,
                              fn:require('../modules/' + name + '/' + name + '.module'), 
                              router:require('./moduleRouter').Router()};
      }
  });
  
  return ncms.modules;
    
};