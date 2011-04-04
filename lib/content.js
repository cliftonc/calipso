
/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 */

/**
 * Module dependencies.
 */  

var fs = require('fs'), express = require('express'), Step = require('step'), sys=require('sys');

module.exports.content = function(app,options) {
  
    var options = options ? options : {};  
    app.modules = loadModules(options);
      
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
       
       Step(
           function loadAllModules() {             
               var group = this.group();
               app.modules.forEach(function(module){         
                   if(module.enabled) {                   
                     module.lib.load(req,res,app,group());                       
                   }
               });               
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
                 app.modules = loadModules(res.reloadConfigOptions);
                 
                 // THIS DOESN@T ACTUALLY WORK :(
                 var theme = res.reloadConfigOptions.theme;               
                 app.use(express.static(app.path + '/themes/' + theme + '/public'));  // Before router to enable dynamic routing               
                 app.set('views', app.path + '/themes/' + theme);
                 
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
      
};

function loadModules(options) {
  
  var options = options ? options : {};
  var modules = [];
  var configuredModules = {};
  
  options.modules.forEach(function(module) {
      configuredModules[module.name] = {enabled:module.enabled};
  });    
  
  fs.readdirSync(__dirname + '/../modules').forEach(function(name){
      var enabled = configuredModules[name] ? configuredModules[name].enabled : false;
      modules.push({name:name, enabled:enabled, lib:require('../modules/' + name + '/' + name + '.module')});            
  });
  
  return modules;
    
};