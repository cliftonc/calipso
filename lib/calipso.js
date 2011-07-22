/*!
 * Calipso Core Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This is the core Calipso middleware that controls the bootstrapping, and core routing functions, required for
 * Calipso to function.  This is loaded into an Express application via:
 *
 *     app.use(require('lib/calipso')(app,options));
 *
 * Further detail is contained in comments for each function and object.
 *
 */

/**
 * Module exports
 *
 *     lib : Libraries that can be re-used in each module (avoids repetition), imported lib or utils (not core lib)
 *     sessionCache : Holds cache of logged in users.
 *     dynamicHelpers : Helper functions that can be used in views (e.g. getBlock etc.)
 *     getDynamicHelpers : Function that loads Dynamic helpers (TODO : refactor into single function)
 *     mr : Tracks running map reduce operations, to ensure that multiple updates do not conflict.
 *     theme : Link to the currently loaded theme (one per site).
 *     data : In memory store of common data (e.g. allows caching vs repetitive returns to mongo)
 *     modules : Object that holds all loaded modules, modules are properties based on their name.
 *     date : shortcut to Calipso date library (link below)
 *     form : shortcut to Calipso form library (link below)
 *
 */

var calipso, app, events = require('events'), sys = require('sys');

calipso = exports = module.exports = {

  //Export module dependencies, reduces need for later modules to require everything.
  lib: {
    fs: require('fs'),
    path: require('path'),
    express: require('express'),
    step: require('step'),
    sys: require('sys'),
    mongoose: require('mongoose'),
    url: require('url'),
    ejs: require('ejs'),
    pager: require('utils/pager'),
    prettyDate: require('utils/prettyDate.js'),
    crypto: require('utils/crypto.js'),
    connect: require('connect'),
    _:require('underscore')
  },
  sessionCache: {},
  dynamicHelpers: require('./Helpers'), // Helpers
  getDynamicHelpers: function(req, res) {
    var helpers = {};
    for(var helper in this.dynamicHelpers) {
      helpers[helper] = this.dynamicHelpers[helper](req, res, this);
    }
    return helpers;
  },
  // Track running MR (Map Reduce) operations
  mr: {},             
  // Loaded theme
  theme: {},
  // Holds global config data
  data: {},      
  modules: {},
  // Core libraries
  cache: require('./Cache').cache(),
  date: require('./Date').CalipsoDate,
  form: require('./Form').CalipsoForm,
  table: require('./Table').CalipsoTable,
  link: require('./Link').CalipsoLink,
  menu: require('./Menu'),
  event: require('./Event'),        
  notifyDependenciesOfInit: notifyDependenciesOfInit,
  notifyDependenciesOfRoute: notifyDependenciesOfRoute,
  e: {},
  
  /**
   * Core router and initialisation function.
   *
   * Called by express e.g.
   *
   *     app.use(require('./lib/calipso')(app,options));
   *
   * Returns a connect middleware function that manages the roucting
   * of requests to modules.
   */
  calipsoRouter: function(appReference, config, initCallback) {

    // Store our references and options
    calipso.app = app = appReference;
    calipso.initCallback = initCallback;

    // Load configuration
    initialiseCalipso(config);
    
    // Create our calipso event emitter
    calipso.e = new calipso.event.CalipsoEventEmitter();

    // Return the function that manages the routing
    // Ok being non-synchro
    return function(req,res,next) {

      // Default menus and blocks for each request
      // More of these can be added in modules, these are jsut the defaults
      res.menu = {admin:new calipso.menu.CalipsoMenu('admin','weight'),
                  adminToolbar:new calipso.menu.CalipsoMenu('adminToolbar','weight'),
                  primary:new calipso.menu.CalipsoMenu('primary'),
                  secondary:new calipso.menu.CalipsoMenu('secondary')};

                  
      // Deal with any form content      
      // This is due to node-formidable / connect / express
      // https://github.com/felixge/node-formidable/issues/30
      // Best to parse the form very early in the chain
      if(req.form) {
        
        calipso.form.process(req,function(form) {

          // Set the form data to the form object
          req.formData = form;
            
          // Route the modules
          eventRouteModules(req,res,next);
  
        });
        
      } else {
          // Route the modules
          eventRouteModules(req,res,next);
      }

    };
  }

};

/**
 * Load the application configuration
 * Configure the logging
 * Configure the theme
 * Load the modules
 * Initialise the modules
 *
 * @argument config
 *
 */
function initialiseCalipso(config) {

  // Shortcut to our application configuration
  calipso.config = config;

  // Configure the logging
  configureLogging(config);

  // Initialise the modules and  theming engine
  configureTheme(function() {

      // Load all the modules
      loadModules(config);
      initModules();

  });

}

/**
 * Attach module event emitters and request event listener
 * to this request instance and the enabled modules.
 * This will only last for the context of a current request
 */
function attachRequestEvents(req, res, next) {

  // Create a request event listener for this request
  req.event = new calipso.event.RequestEventListener();

  // Attach all the enabled modules to it
  for(var module in calipso.modules) {
     req.event.registerModule(req,res,module);
  }

}

/**
 * Route all of the modules based on the module event model
 * This replaces an earlier version that only executed modules in
 * parallel via step
 */
function eventRouteModules(req, res, next) {

  // Ignore static content
  // TODO : Make this more connect friendly or at least configurable
  if(req.url.match(/^\/images|^\/js|^\/css|^\/favicon.ico/)) {
    next();
    return;
  }

  req.timeStart = new Date();

  // Attach our event listener to this request
  attachRequestEvents(req, res, next);

  // Initialise the response re. matches
  // Later used to decide to show 404
  res.routeMatched = false;

  // Now, route each of the modules
  for(var module in calipso.modules) {
    routeModule(req,res,module,false,false,next);
  }

}

/**
 * Route a specific module
 * Called by both the eventRouteModules but also by when dependencies trigger
 * a module to be routed
 *
 * req, res : request/resposne
 * module : the module to route
 * depends : has this route been triggered by an event based on dependencies being met
 * last : final modules, after all others have routed
 *
 */
function routeModule(req,res,moduleName,depends,last,next) {

    var module = calipso.modules[moduleName];

    // If module is enabled and has no dependencies, or if we are explicitly triggering this via depends
    // Ignore modules that are specified as post route only
    if(module.enabled && (depends || !module.fn.depends) && (last || !module.fn.last)) {

      // Fire event to start
      req.event.modules[moduleName].route_start();

      // Route
      module.fn.route(req,res,module,app,function(err,moduleName) {

        // Gracefully deal with errors
        if(err) {
          res.statusCode = 500;
          console.log(err.message);
          res.errorMessage = "Module " + moduleName + ", error: " + err.message + err.stack;
        }

        // Finish event
        req.event.modules[moduleName].route_finish();

        // Check to see if we have completed routing all modules
        if(!last) {
          checkAllModulesRouted(req,res,next);
        }

      });

    }

}

/**
 * Check that all enabled modules have been initialised
 * Don't check disabled modules or modules that are setup for postRoute only
 */
function checkAllModulesRouted(req,res,next) {

  var allRouted = true;
  for(var module in req.event.modules) {
    allRouted = (req.event.modules[module].routed || (calipso.modules[module].enabled && calipso.modules[module].fn.last) || !calipso.modules[module].enabled) && allRouted;
  }
  if(allRouted && !req.event.routeComplete) {
    req.event.routeComplete = true;
    doLastModules(req,res,function() {
      req.timeFinish = new Date();
      req.timeDuration = req.timeFinish - req.timeStart;
      doResponse(req,res,next);
    });
  }

}

/**
 * RUn any modules that are defined as post routing modules
 * via postRoute: true
 */
function doLastModules(req,res,next) {

  // Get all the postRoute modules
  var lastModules = [];
  for(var moduleName in calipso.modules) {
    if(calipso.modules[moduleName].enabled && calipso.modules[moduleName].fn.last) {
      lastModules.push(calipso.modules[moduleName]);
    }
  }

  // Execute their routing functions
  calipso.lib.step(
    function doLastModules() {
      var group = this.group();
      lastModules.forEach(function(module) {
        module.fn.route(req,res,module,app,group());
      });
    },
    function done(err) {

      // Gracefully deal with errors
      if(err) {
        res.statusCode = 500;
        console.log(err.message);
        res.errorMessage = err.message + err.stack;
      }

      next();
    }
  );

}

/**
 * Standard response to all modules completing their routing
 */
function doResponse(req,res,next) {

  // Deal with need to reload config
  // This happens asynch in background, runs on assumption that
  // By the time it is done
  if(res.reloadConfig) {

    app.set('config', calipso.config);
    res.reloadConfig = null;

    // Set the callback for init back to local function
    calipso.initCallback = function() {};
    initialiseCalipso(app.set('config'));
    return;

  }

  // If we are in install mode
  if(calipso.app.set('config').install && (req.url != '/admin/install')) {
    app.doingInstall = true;
    res.redirect("/admin/install");
    return;
  }

  // If nothing could be matched ...
  if(!res.routeMatched) {
    calipso.log("No Calipso module routes matched the current URL.");
    res.statusCode = 404;
  }

  // Render statuscodes dealt with by themeing engine
  if(res.statusCode === 404 || res.statusCode === 500 || res.statusCode === 200) {

    calipso.theme.render(req, res, function(err, content) {

      if(err) {
        
        // Something went wrong at the layout, cannot use layout to render.
        res.statusCode = 500;
        res.end("<html><h2>A fatal error occurred!</h2>" +
                "<p>" + (err.xMessage ? err.xMessage : err.message) + "</p>" +
                "<pre>" + err.stack + "</pre></html>");      
        
      } else {
          
        res.setHeader('Content-Type', 'text/html');  
  
        // Who am I?
        res.setHeader('X-Powered-By','Calipso');
  
        // render
        res.end(content, 'utf-8');
        
      }

    });

  } else {

    // Otherwise just let the default express router deal with it
    // console.log(res._headers);
    // next();
    // res.end();

  }

}

/**
 * Configure winston to provide the logging services.
 *
 * TODO : This can be factored out into a module.
 *
 */
function configureLogging(options) {

  //Configure logging
  var logMsg = "\x1b[36mLogging enabled: \x1b[0m";
  var winston = require("winston");

  try {
    winston.remove(winston.transports.File);
  } catch(exFile) {
    // Ignore the fault
  }

  if(options.logs && options.logs.file.enabled) {
    winston.add(winston.transports.File, { level: options.logs.level, filename: options.logs.file.filepath });
    logMsg += "File @ " + options.logs.file.filepath + " ";
  }

  try {
    winston.remove(winston.transports.Console);
  } catch(exConsole) {
    // Ignore the fault
  }

  if(options.logs && options.logs.console.enabled) {
    winston.add(winston.transports.Console, { level: options.logs.level, colorize: true });
    logMsg += "Console ";
  }

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

  // Output what our log levels are set to in debug
  calipso.debug(logMsg);

}

/**
 * Initialise the modules currently enabled.
 * This iterates through the modules loaded by loadModules (it places them in an array in the calipso object),
 * and calls the 'init' function exposed by each module (in parallel controlled via step).
 */
function initModules(next) {

  // Create a list of all our enabled modules
  var enabledModules = [];
  for(var module in calipso.modules) {
    if(calipso.modules[module].enabled) {
      enabledModules.push(module);
    }
  }  

  // Initialise them all
  enabledModules.forEach(function(module) {
     initModule(module, false);
  });

}


/**
 * Init a specific module, called by event listeners re. dependent modules
 */
function initModule(module, depends) {

  // If the module has no dependencies, kick start it
  if(depends || !calipso.modules[module].fn.depends) {
    // Init start event
    calipso.modules[module].event.init_start();
    calipso.modules[module].fn.init(calipso.modules[module], calipso.app,function() {
      // Init finish event
      calipso.modules[module].inited = true;
      calipso.modules[module].event.init_finish();
      checkAllModulesInited();
    });
  }

}

/**
 * Check that all enabled modules have been initialised
 * If they have been initialised, then call the callback supplied on initialisation
 */
function checkAllModulesInited() {

  var allLoaded = true;
  for(var module in calipso.modules) {
    allLoaded = (calipso.modules[module].inited || !calipso.modules[module].enabled) && allLoaded;
  }

  if(allLoaded && !calipso.initComplete) {
    calipso.initComplete = true;
    calipso.initCallback();
  }

}

/**
 * Load the modules from the file system, into a 'modules' array
 * that can be managed and iterated.
 *
 * The first level folder is the module type (e.g. core, contrib, ui).
 * It doesn't actually change the processing, but that folder structure is
 * now stored as a property of the module (so makes admin easier).
 *
 * It will take in an options object that holds the configuration parameters
 * for the modules (e.g. if they are enabled or not).
 * If they are switching (e.g. enabled > disabled) it will run the disable hook.
 *
 */
function loadModules(options) {

  options = options || {};
  var modules = [];
  var configuredModules = {};

  options.modules.forEach(function(module) {
    configuredModules[module.name] = {enabled:module.enabled};
  });

  // Run any disable hooks
  for(var module in calipso.modules) {

    // Check to see if the module is currently enabled, if we are disabling it.
    if (calipso.modules[module].enabled && configuredModules[module].enabled === false && typeof calipso.modules[module].fn.disable === 'function') {
      calipso.modules[module].fn.disable();
    }

  }

  // Clear the modules object (not sure if this is required, but was getting strange errors initially)
  delete calipso.modules;      // 'Delete' it.
  calipso.modules = {};           // Always reset it

  // Read the modules in from the file system, sync is fine as we do it once on load.
  calipso.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(type){

    if(type != "README" && type != '.DS_Store') {  // Ignore the readme file and .DS_Store file for Macs

      calipso.lib.fs.readdirSync(__dirname + '/../modules/' + type).forEach(function(name){

        if(name != "README" && name != '.DS_Store') { // Ignore the readme file and .DS_Store file for Macs

              var enabled = configuredModules[name] && configuredModules[name].enabled;

              var modulePath = 'modules/' + type + '/' + name;

              // Create the module object
              calipso.modules[name] = {
                name: name,
                type: type,
                path: modulePath,
                enabled: enabled,
                inited: false
              };

              // Load the about info from package.json
              loadAbout(calipso.modules[name], modulePath);
              
              if(enabled) {

                // Load the module itself via require
                requireModule(calipso.modules[name], modulePath);              
                
                // Load the templates (factored out so it can be recalled by watcher)
                loadModuleTemplates(calipso.modules[name], modulePath + '/templates');

              }

         }

       });
    }

  });

  // Now that all are loaded, attach events & depends
  attachModuleEventsAndDependencies();
    
}

/**
 *
 */
function loadAbout(module, modulePath) {

  var fs = calipso.lib.fs, path = require('path');
  var packageFile = modulePath + '/package.json';
  
  if(path.existsSync(packageFile)) {
      var json = fs.readFileSync(packageFile);           
      try {
        module.about = JSON.parse(json.toString()); 
      } catch(ex) {
        module.about = {description:'Invalid package.json'};
        console.log("Error parsing package.json for " + module.name + ".");
      }
  };

}
 
/**
 * Connect up events and dependencies
 * Must come after all modules are loaded
 */
function attachModuleEventsAndDependencies() {

  for(var module in calipso.modules) {
    
    // Register dependencies
    registerModuleDependencies(calipso.modules[module]);

    // Attach event listener
    calipso.event.addModuleEventListener(calipso.modules[module]);

  }

  // Sweep through the dependency tree and make sure any broken dependencies are disabled
  disableBrokenDependencies();

}

/**
 * Ensure dependencies are mapped and registered against parent and child
 */
function registerModuleDependencies(module) {

  if(module.fn && module.fn.depends && module.enabled) {

    // Create object to hold dependent status
    module.check = {};

    // Register depends on parent
    module.fn.depends.forEach(function(dependentModule) {

      module.check[dependentModule] = false;

      if(calipso.modules[dependentModule] && calipso.modules[dependentModule].enabled) {

          // Create a notification array to allow this module to notify modules that depend on it
          calipso.modules[dependentModule].notify = calipso.modules[dependentModule].notify || [];
          calipso.modules[dependentModule].notify.push(module.name);

      } else {

          calipso.modules[module.name].error = "Module " + module.name + " depends on " + dependentModule + ", but it does not exist or is disabled - this module will not load.";
          calipso.error(calipso.modules[module.name].error);
          calipso.modules[module.name].enabled = false;

      }

    });

  }

}


/**
 * Disable everythign in a broken dependency tree
 */
function disableBrokenDependencies() {

  var disabled = 0;  
  for(var moduleName in calipso.modules) {
      var module = calipso.modules[moduleName];
      if(module.enabled && module.fn && module.fn.depends) {
        module.fn.depends.forEach(function(dependentModule) {
            if(!calipso.modules[dependentModule].enabled) {
              calipso.modules[module.name].error = "Module " + module.name + " depends on " + dependentModule + ", but it does not exist or is disabled - this module will not load.";
              calipso.error(calipso.modules[module.name].error);
              calipso.modules[module.name].enabled = false;
              disabled = disabled + 1;
            }
        });
      }
  }

  // Recursive
  if(disabled > 0)
    disableBrokenDependencies();

}

/**
 * Notify dependencies for initialisation
 */
function notifyDependenciesOfInit(moduleName,options) {

  var module = calipso.modules[moduleName];
  if(module.notify) {
    module.notify.forEach(function(notifyModuleName) {
        notifyDependencyOfInit(moduleName,notifyModuleName,options);
    });
  }

}


/**
 * Notify dependencies for routing
 */
function notifyDependenciesOfRoute(req,res,moduleName,reqModules) {

  var module = calipso.modules[moduleName];
  if(module.notify) {
    module.notify.forEach(function(notifyModuleName) {
        notifyDependencyOfRoute(req, res, moduleName, notifyModuleName);
    });
  }

}

/**
 * Notify dependency
 * moduleName - module that has init'd
 * notifyModuleName - module to tell
 */
function notifyDependencyOfInit(moduleName,notifyModuleName,options) {

    // Set it to true
    var module = calipso.modules[notifyModuleName];
    module.check[moduleName] = true;
    checkInit(module);

}



/**
 * Notify dependency
 * req - request
 * res - response
 * moduleName - module that has init'd
 * notifyModuleName - module to tell
 */
function notifyDependencyOfRoute(req,res,moduleName,notifyModuleName) {

    var module = req.event.modules[notifyModuleName];
    module.check[moduleName] = true;
    checkRouted(req,res,moduleName,notifyModuleName);

}

/**
 * Check if all dependencies are met and we should init the module
 */
function checkInit(module,next) {

  var doInit = true;
  for(var check in module.check) {
    doInit = doInit & module.check[check];
  }
  if(doInit) {
    // Initiate the module, no req for callback
    initModule(module.name,true,function() {});
  }

}

/**
 * Check if all dependencies are met and we should route the module
 */
function checkRouted(req,res,moduleName,notifyModuleName) {

  var doRoute = true;

  for(var check in req.event.modules[notifyModuleName].check) {
    // console.log("CHK" + moduleName + " " + notifyModuleName + " " + check + " " + reqModules[notifyModuleName].check[check])
    doRoute = doRoute && req.event.modules[notifyModuleName].check[check];
  }

  if(doRoute) {
    // Initiate the module, no req for callback
    // initModule(module.name,true,function() {});
    routeModule(req,res,notifyModuleName,true,false,function() {});
  }

}

/**
 * Load the module itself, refactored out to enable watch / reload
 * Note, while it was refactored out, you can't currently reload
 * a module, will patch in node-supervisor to watch the js files and restart
 * the whole server (only option :())
 */
function requireModule(module, modulePath, reload) {

  var fs = calipso.lib.fs;
  var moduleFile = modulePath + '/' + module.name;

  try {
    
    // Require the module
    module.fn = require(moduleFile);
  
    // Attach a router
    module.router = require('./Router').Router(module.name);

  } catch(ex) {
     
    calipso.error("Unable to load module " + module.name + ", module has been disabled because " + ex.message);     
    calipso.modules[module.name].enabled = false;
    
  }
  
}

/**
 * Pre load all the templates in a module, synch, but only happens on app start up and config reload
 * This is attached to the templates attribute so used later.
 *
 * @param calipso
 * @param moduleTemplatePath
 * @returns template object
 */
function loadModuleTemplates(module, moduleTemplatePath) {

  var templates = {};

  // Default the template to any loaded in the theme (overrides)
  var fs = calipso.lib.fs;

  if(!calipso.lib.path.existsSync(moduleTemplatePath)) {
    return null;
  }

  fs.readdirSync(moduleTemplatePath).forEach(function(name){

    // Template paths and functions
    var templatePath = moduleTemplatePath + "/" + name;
    var templateExtension = templatePath.match(/([^\.]+)$/)[0];
    var template = fs.readFileSync(templatePath, 'utf8');
    var templateName = name.replace(/\.([^\.]+)$/,'');

    // Load the template - only if not already loaded by theme (e.g. overriden)
    if(calipso.theme.cache.modules && calipso.theme.cache.modules[module.name] && calipso.theme.cache.modules[module.name].templates[templateName]) {

       // Use the theme version
       templates[templateName] = calipso.theme.cache.modules[module.name].templates[templateName];

    } else {

      // Else load it
      if(template) {
        templates[templateName] = calipso.theme.compileTemplate(template,templatePath,templateExtension);

        // Watch / unwatch files - always unwatch (e.g. around config changes)
        if(calipso.app.set('config').watchFiles) {

          fs.unwatchFile(templatePath); // Always unwatch first due to recursive behaviour
          calipso.silly("Adding watcher for module " + module.name + " template " + name);
          fs.watchFile(templatePath, { persistent: true, interval: 200}, function(curr,prev) {
              loadModuleTemplates(module, moduleTemplatePath);

              calipso.silly("Module " + module.name + " template " + name + " reloaded.");

          });

        }

      }
    }
  });

  module.templates = templates;

}

/**
 * Configure a theme using the theme library.
 */
function configureTheme(next) {

  var themeName = calipso.app.set('config').theme;

  require('./Theme').Theme(themeName,function(theme) {

    calipso.theme = theme;

    // Search for middleware that already has themeStatic tag
    calipso.app.stack.forEach(function(middleware,key) {
     if(middleware.handle.tag === 'themeStatic') {
        // Replace it
        var oneDay = 86400000;
        var themeStatic = calipso.lib.express.static(calipso.app.path + '/themes/' + themeName + '/public',{maxAge:oneDay});        
        themeStatic.tag = 'themeStatic';
        calipso.app.stack[key].handle = themeStatic;
     }
    });

    next();

  });

}