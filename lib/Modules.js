/*!
 * Calipso Core Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Core library that controls the installation and management of modules.
 * No dependencies back on Calipso, this allows it to be run by the CLI as well
 * as from the web gui.
 *
 * Further detail is contained in comments for each function and object.
 *
 */

/**
 * Module exports
 *
 */
var calipso = require("lib/calipso"), 
    exec = require('child_process').exec,  
    sys = require('sys'), 
    colors = require('colors'), 
    semver = require('semver');

/**
 * Module router - takes params from CLI and passes to appropriate function
 * Controls return based on CLI mode or web mode
 */
exports.moduleRouter = function(path,options,cli,next) {      
  
  switch(options[0]) {
    case 'list':
      listModules(options,cli,next);
      break;      
    case 'check':
      checkAll(options,cli,next);
      break;
    case 'install':
      installModule(options,cli,next);
      break;
  }
  
}

/**
 * Show the list of currently installed modules - highlight those with issues / updates?
 */
function listModules(options,cli,next) {
  
  // Command line  
  if(cli) {
    var currentType = "";
    for(var moduleName in calipso.modules) {
      var module = calipso.modules[moduleName];
      if(module.type != currentType) {
        console.log("\r\n" + module.type.green.bold);
        currentType = module.type;
      }
      console.log(" - " + module.name.white.bold + " @ " + module.about.version + " [".grey + (module.enabled ? "On".green : "Off".grey) + "]".grey);
    }
  } 
  
  // Else return it
  next(calipso.modules);
  
}


/**
 * Show the list of currently installed modules - highlight those with issues / updates?
 * options:  ['install',<module@version>,<force>]
 */
function installModule(options,cli,next) {
  
  // Get the module name
  var moduleName = options[1];
  if(!moduleName) {
    console.log("You must specify a module name (and optional @version).".red.bold);
    next("");
  }
  
  // Split module / version
  var moduleVersion = moduleName.split('@')[1] || "";  
  var moduleName = moduleName.split('@')[0]; 
  
  // Locate the module  
  var installedModule = calipso.modules[moduleName];
  var installed = installedModule ? true : false;
  
  // Assume that we want to re-install the dependencies via NPM
  if(installed) {
    
    // If we have a version, check to see if this is an upgrade or downgrade
    if(moduleVersion) {      
      if(semver.lt(moduleVersion,installedModule.about.version)) {                
        // TODO                      
      }                
    }
    
    var path = __dirname + "/../modules/" + installedModule.type + "/" + installedModule.name;
        
    console.log("Installing " + installedModule.name.green.bold + " via npm, please wait ...");
    exec('npm install', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {
        
      var ok = ((error ? error.message : '') || stderr);
      
      if(!ok) {        
        exec('npm list', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {            
           console.log(stdout);
           console.log("Module " + installedModule.name.green.bold + " installed with all dependencies met.");
           next();
        });
      } else {
        console.log("Module ".red.bold + moduleName + " install failed, reason follows:".red.bold);
        console.log(ok);
        next();
      }
    });
    
  } else {    
    next();  
  }  
}


/**
 * Run through all installed modules (enabled or not), and install dependencies 
 */
function checkAll(options,cli,next) {
    
  calipso.lib.step(
    function validateInstall() {
       this();
    },    
    function validateInstalledModules() {
      var group = this.group();
      for(var moduleName in calipso.modules) {
        var options = [];
        options.push('install');
        options.push(moduleName);
        options.push(true);        
        installModule(options,cli,group());
      }
    },
    function done() {
      console.log("All installed ...");
      next();
    }
   )
}
