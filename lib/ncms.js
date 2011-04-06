
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
      ejs: require('ejs')      
    },        
    modules: {},    
    
    /**
     * Core router and initialisation function
     */
    ncmsRouter: function(app,options) {
  
      // Store our references and options
      var ncms = this;
      ncms.app = app;
      
      var options = options ? options : {};
      
      // Load all the modules
      loadModules(ncms,options);
      
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
         
                  
         ncms.lib.step(
             function loadAllModules() {             
                 
               var group = this.group();
                                                   
                 for(var module in ncms.modules) {                     
                     if(ncms.modules[module].enabled) {              
                       ncms.modules[module].lib.load(req,res,ncms.modules[module].router,app,group());
                     }
                 };               
             },
             function allLoaded(err) {             
               if(err) {
                 console.log(err.message);
               }      
               if(app.install) { 
                 app.install = false;
                 res.redirect("/admin/install");
               } else {
                 if(res.reloadConfig) {               
                   
                   app.set('config',res.reloadConfigOptions);
                   loadModules(ncms,res.reloadConfigOptions);
                   
                   // TODO : Theme reload
                   
                   res.reloadConfig = null;
                   res.reloadConfigOptions = null;               
                   
                 }
                 if(res.statusCode == 200) {   
                   res.render("pages/index",{menu:res.menu,blocks:res.blocks,renderedBlocks:res.renderedBlocks});               
                 };
               };
             }           
         );
                  
      };         
  }

}

function loadModules(ncms,options) {
  
  var options = options ? options : {};
  var modules = [];
  var configuredModules = {};
  ncms.modules = {}; // Always reset it
  
  options.modules.forEach(function(module) {
      configuredModules[module.name] = {enabled:module.enabled};
  });    
  
  ncms.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(name){
      if(name != "README") {
        
        var enabled = configuredModules[name] ? configuredModules[name].enabled : false;
        
        ncms.modules[name] = {name:name, 
                              enabled:enabled,
                              lib:require('../modules/' + name + '/' + name + '.module'), 
                              router:require('./moduleRouter').Router()};
      }
  });
  
  return ncms.modules;
    
};