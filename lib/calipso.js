/*!
 * Calipso Core Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This is the core Calipso middleware that controls the bootstrapping, and core routing functions, required for
 * Calipso to function.  This is loaded into an Express application via:
 *
 *     app.use(calipso.calipsoRouter(next);
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

var app,
  rootpath = process.cwd(),
  path = require('path'),
  events = require('events'),
  mongoStore = require(path.join(rootpath, 'support/connect-mongodb')),
  mongoose = require('mongoose'),
  calipso = exports = module.exports = {

  //Export module dependencies, reduces need for later modules to require everything.
  lib: {
    fs: require('fs'),
    path: require('path'),
    express: require('express'),
    step: require('step'),
    util: require('util'),
    mongoose: require('mongoose'), 
    url: require('url'),
    ejs: require('ejs'),
    pager: require(path.join(rootpath, 'utils/pager')),
    prettyDate: require(path.join(rootpath, 'utils/prettyDate.js')),
    crypto: require(path.join(rootpath, 'utils/crypto.js')),
    connect: require('connect'),
    _:require('underscore'),
    async: require('async')
  },
  sessionCache: {},
  dynamicHelpers: require('./Helpers'),
  getDynamicHelpers: function(req, res) {
    req.helpers = {};
    for(var helper in this.dynamicHelpers) {
      req.helpers[helper] = this.dynamicHelpers[helper](req, res, this);
    }
  },
  mongoConnect: mongoConnect,
  reloadConfig: reloadConfig,
  // Track running MR (Map Reduce) operations
  mr: {},
  // Loaded theme
  theme: {},
  // Holds global config data
  data: {},
  modules: {},
  // Core libraries
  date: require('./Date').CalipsoDate,
  table: require('./Table').CalipsoTable,
  link: require('./Link').CalipsoLink,
  menu: require('./Menu'),
  event: require('./Event'),
  utils: require('./Utils'),
  logging: require('./Logging'),
  permissions: require('./Permission').PermissionHelpers,
  form: require('./Form').CalipsoForm,
  notifyDependenciesOfInit: notifyDependenciesOfInit,
  notifyDependenciesOfRoute: notifyDependenciesOfRoute,
  e: {},

  /**
   * Core router and initialisation function.
   *
   * Returns a connect middleware function that manages the roucting
   * of requests to modules.
   */
  calipsoRouter: function(app, initCallback) {

    calipso.app = app;
    
    // Load the calipso package.json into about
    loadAbout(app, rootpath, 'package.json');

    calipso.config = app.config;

    // Configure the cache
    calipso.cache = require('./Cache').Cache({ttl:calipso.config.get('performance:cache:ttl')});

    // Store the callback function for later
    calipso.initCallback = function() {
      initCallback();
    };

    // Create our calipso event emitter
    calipso.e = new calipso.event.CalipsoEventEmitter();

    // Load configuration
    initialiseCalipso();

    // Return the function that manages the routing
    // Ok being non-synchro
    return function(req,res,next) {

      // Default menus and blocks for each request
      // More of these can be added in modules, these are jsut the defaults
      res.menu = {admin:new calipso.menu.CalipsoMenu('admin','weight','root',{cls:'admin'}),
                  adminToolbar:new calipso.menu.CalipsoMenu('adminToolbar','weight','root',{cls:'admin-toolbar toolbar'}), // TODO - Configurable!
                  userToolbar:new calipso.menu.CalipsoMenu('userToolbar','weight','root',{cls:'user-toolbar toolbar'}),
                  primary:new calipso.menu.CalipsoMenu('primary','name','root',{cls:'primary'}),
                  secondary:new calipso.menu.CalipsoMenu('secondary','name','root',{cls:'secondary'})};


      // Initialise our clientJS library linked to this request
      var Client = require('./client/Client');
      res.client = new Client();

      // Initialise helpers - first pass
      calipso.getDynamicHelpers(req, res);

      // Deal with any form content
      // This is due to node-formidable / connect / express
      // https://github.com/felixge/node-formidable/issues/30
      // Best to parse the form very early in the chain
      if(req.form) {

        calipso.form.process(req, function() {

          // Route the modules
          eventRouteModules(req, res, next);

        });

      } else {

        // Route the modules
        eventRouteModules(req, res, next);

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
function initialiseCalipso(reloadConfig) {

  // Check if we need to reload the config from disk (e.g. from cluster mode)
  if(reloadConfig) {
    calipso.config.load();
  }

  // Clear Event listeners
  calipso.e.init();

  // Configure the logging
  calipso.logging.configureLogging();

  // Check / Connect Mongo
  mongoConnect(calipso.config.get('database:uri'), false, function(err, connected) {

     if(err) {
       console.log("There was an error connecting to the database: " + err.message);
       process.exit();
     }

    // Load all the themes
    loadThemes(function() {

      // Initialise the modules and  theming engine
      configureTheme(function() {

        // Load all the modules
        loadModules();

        // Initialise, callback via calipso.initCallback
        initModules();

      });

    });

  });

}

/**
 * Route all of the modules based on the module event model
 * This replaces an earlier version that only executed modules in
 * parallel via step
 */
function eventRouteModules(req, res, next) {

  // Ignore static content
  // TODO : Make this more connect friendly or at least configurable
  if(req.url.match(/^\/images|^\/js|^\/css|^\/favicon.ico|png$|jpg$|gif$|css$|js$/)) {
    return next();
  }

  req.timeStart = new Date();

  // Attach our event listener to this request
  attachRequestEvents(req, res, next);

  // Initialise the response re. matches
  // Later used to decide to show 404
  res.routeMatched = false;

  // Now, route each of the modules
  for(var module in calipso.modules) {
    routeModule(req, res, module, false, false, next);
  }

}

/**
 * Attach module event emitters and request event listener
 * to this request instance.
 * This will only last for the context of a current request
 */
function attachRequestEvents(req, res, next) {

  // Create a request event listener for this request
  req.event = new calipso.event.RequestEventListener();

  // Attach all the modules to it
  for(var module in calipso.modules) {
     req.event.registerModule(req, res, module);
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
function routeModule(req, res, moduleName, depends, last, next) {

    var module = calipso.modules[moduleName];

    // If module is enabled and has no dependencies, or if we are explicitly triggering this via depends
    // Ignore modules that are specified as post route only
    if(module.enabled && (depends || !module.fn.depends) && (last || !module.fn.last)) {

      // Fire event to start
      req.event.modules[moduleName].route_start();

      // Route
      module.fn.route(req, res, module, app, function(err, moduleName) {

        // Gracefully deal with errors
        if(err) {
          res.statusCode = 500;
          calipso.error(err.message);
          res.errorMessage = "Module " + moduleName + ", error: " + err.message + err.stack;
        }

        // Finish event
        req.event.modules[moduleName].route_finish();

        // Check to see if we have completed routing all modules
        if(!last) {
          checkAllModulesRouted(req, res, next);
        }

      });

    }

}

/**
 * Check that all enabled modules have been initialised
 * Don't check disabled modules or modules that are setup for postRoute only
 */
function checkAllModulesRouted(req, res, next) {

  var allRouted = true;

  for(var module in req.event.modules) {
    var moduleRouted = (req.event.modules[module].routed || (calipso.modules[module].enabled && calipso.modules[module].fn.last) || !calipso.modules[module].enabled);
    allRouted = moduleRouted && allRouted;
  }

  if(allRouted && !req.event.routeComplete) {
    req.event.routeComplete = true;
    doLastModules(req, res, function() {
      req.timeFinish = new Date();
      req.timeDuration = req.timeFinish - req.timeStart;
      calipso.silly("All modules routed in " + req.timeDuration + " ms");
      doResponse(req, res, next);
    });
  }

}

/**
 * RUn any modules that are defined as last routing modules
 * via last: true, dependencies are ignored for these atm.
 */
function doLastModules(req, res, next) {

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
        module.fn.route(req, res, module, app, group());
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
function doResponse(req, res, next) {

  // If we are in install mode, and are not in the installation process, then redirect
  if(!calipso.config.get('installed') && !req.url.match(/^\/admin\/install/)) {
    calipso.silly("Redirecting to admin/install ...");
    calipso.app.doingInstall = true;
    res.redirect("/admin/install");
    return;
  }

  // If nothing could be matched ...
  if(!res.routeMatched) {
    calipso.log("No Calipso module routes matched the current URL.");
    res.statusCode = 404;
  }

  // Render statuscodes dealt with by themeing engine
  // TODO - this is not very clean
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

  }

}

/**
* Called both via a hook.io event as
* well as via the server that initiated it.
*/
function reloadConfig(event, data, next) {

    // Create a callback
    calipso.initCallback = function (err) {
      // If called via event emitter rather than hook
      if(typeof next === "function") next(err);
    }
    initialiseCalipso(true);
    return;

}

/**
 * Initialise the modules currently enabled.
 * This iterates through the modules loaded by loadModules (it places them in an array in the calipso object),
 * and calls the 'init' function exposed by each module (in parallel controlled via step).
 */
function initModules() {

  // Reset
  calipso.initComplete = false;

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

      // Next run any init functions
      calipso.modules[module].fn.init(calipso.modules[module], calipso.app, function(err) {

        // Init finish event
        calipso.modules[module].inited = true;
        calipso.modules[module].event.init_finish();

        // Now, load any routes to go along with it
        if(calipso.modules[module].fn.routes && calipso.modules[module].fn.routes.length > 0) {
          calipso.lib.async.map(calipso.modules[module].fn.routes, function(options, next) { calipso.modules[module].router.addRoute(options, next) }, function(err, data) {
            if(err) calipso.error(err);
            checkAllModulesInited();
          });
        } else {
          checkAllModulesInited();
        }

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
function loadModules() {

  var configuredModules = calipso.config.get('modules') || {};

  // Run any disable hooks
  for(var module in calipso.modules) {
    // Check to see if the module is currently enabled, if we are disabling it.
    if (calipso.modules[module].enabled && configuredModules[module].enabled === false && typeof calipso.modules[module].fn.disable === 'function') {
      calipso.modules[module].fn.disable();
    }
  }

  // Clear the modules object (not sure if this is required, but was getting strange errors initially)
  delete calipso.modules;      // 'Delete' it.
  calipso.modules = {};        // Always reset it

  // Read the modules in from the file system, sync is fine as we do it once on load.
  calipso.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(type){

    if(type != "README" && type != '.DS_Store') {  // Ignore the readme file and .DS_Store file for Macs

      calipso.lib.fs.readdirSync(__dirname + '/../modules/' + type).forEach(function(moduleFolderName){

        if(moduleFolderName != "README" && moduleFolderName != '.DS_Store') { // Ignore the readme file and .DS_Store file for Macs

              // Create the basic module
              var modulePath = 'modules/' + type + '/' + moduleFolderName;
              var module = {
                name: moduleFolderName,
                folder: moduleFolderName,
                library: moduleFolderName,
                type: type,
                path: modulePath,
                enabled: false,
                inited: false
              };

              // Add about info to it
              loadAbout(module, modulePath, 'package.json');

              // Set the module name to what is in the package.json, default to folder name
              module.name = module.about.name ? module.about.name : moduleFoldername;

              // Now set the module
              calipso.modules[module.name] = module;

              // Set if it is enabled or not
              module.enabled = configuredModules[module.name] ? configuredModules[module.name].enabled : false;

              if(module.enabled) {

                // Load the module itself via require
                requireModule(calipso.modules[module.name], modulePath);

                // Load the templates (factored out so it can be recalled by watcher)
                loadModuleTemplates(calipso.modules[module.name], modulePath + '/templates');

              }

         }

       });
    }

  });

  // Now that all are loaded, attach events & depends
  attachModuleEventsAndDependencies();

}

/**
 * Load data from package.json or theme.json
 */
function loadAbout(obj, fromPath, file) {

  var fs = calipso.lib.fs, path = require('path');
  var packageFile = calipso.lib.path.join(fromPath,file);

  if(path.existsSync(packageFile)) {
      var json = fs.readFileSync(packageFile);
      try {
        obj.about = JSON.parse(json.toString());
        if(obj.about && obj.about.name) {
          obj.library = obj.about.name
        } else {
          obj.library = obj.name
        }
      } catch(ex) {
        obj.about = {description:'Invalid ' + file};
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
  var moduleFile = path.join(rootpath, modulePath + '/' + module.name);

  try {

    // Require the module
    module.fn = require(moduleFile);

    // Attach a router - legacy check for default routes
    module.router = new require('./Router').Router(module.name, modulePath);

    // Load the routes if specified as either array or function
    if(typeof module.fn.routes === "function") module.fn.routes = module.fn.routes();
    module.fn.routes = module.fn.routes || [];

  } catch(ex) {

    calipso.error("Module " + module.name + " has been disabled because " + ex.message);
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
    var hasTemplate = calipso.utils.hasProperty('theme.cache.modules.' + module.name + '.templates.' + templateName, calipso);

    if (hasTemplate) {

       // Use the theme version
       templates[templateName] = calipso.theme.cache.modules[module.name].templates[templateName];

    } else {

      // Else load it
      if(template) {
        // calipso.theme.compileTemplate => ./Theme.js
        templates[templateName] = calipso.theme.compileTemplate(template,templatePath,templateExtension);

        // Watch / unwatch files - always unwatch (e.g. around config changes)
        if(calipso.config.get('performance:watchFiles')) {

          fs.unwatchFile(templatePath); // Always unwatch first due to recursive behaviour
          fs.watchFile(templatePath, {persistent: true, interval: 200}, function(curr,prev) {
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
 * Load the available themes into the calipso.themes object
 */

function loadThemes(next) {

  // Load the available themes
  calipso.themes = calipso.themes || {};

  var themeBasePath = calipso.config.get('server:themePath');

  calipso.lib.fs.readdirSync(calipso.lib.path.join(calipso.app.path,themeBasePath)).forEach(function(folder){

    if(folder != "README" && folder != '.DS_Store') {

        var themes = calipso.lib.fs.readdirSync(calipso.lib.path.join(calipso.app.path,themeBasePath,folder));

        // First scan for legacy themes
        var legacyTheme = false;
        themes.forEach(function(theme) {
            if(theme === "theme.json") {
              legacyTheme = true;
              console.log("Themes are now stored in sub-folders under the themes folder, please move: " + folder + " (e.g. to custom/" + folder + ").\r\n");
            }
        });

        // Process
        if(!legacyTheme) {
          themes.forEach(function(theme) {

            if(theme != "README" && theme != '.DS_Store')
              var themePath = calipso.lib.path.join(calipso.app.path,themeBasePath,folder,theme);
            // Create the theme object
              calipso.themes[theme] = {
                name: theme,
                path: themePath
              };
              // Load the about info from package.json
              loadAbout(calipso.themes[theme], themePath, 'theme.json');
          });
        }
      }
   });


  next();


}

/**
 * Configure a theme using the theme library.
 */
function configureTheme(next, overrideTheme) {

  var defaultTheme = calipso.config.get("theme:default");
  var themeName = overrideTheme ? overrideTheme : calipso.config.get('theme:front');
  var theme = calipso.themes[themeName]; // Reference to theme.json
  var Theme = require('./Theme');

  if(theme) {

    Theme.Theme(theme, function(err, loadedTheme) {

      calipso.theme = loadedTheme;

      if(err) {
        calipso.error(err.message);
      }

      if (!calipso.theme) {

        if(theme.name === defaultTheme) {
           calipso.error('There has been a failure loading the default theme, calipso cannot start until this is fixed, terminating.');
           process.exit();
           return;
        } else {
          calipso.error('The `' + themeName + '` theme failed to load, attempting to use the default theme: `' + defaultTheme + '`');
          configureTheme(next, defaultTheme);
          return;
        }

      } else {

        // Search for middleware that already has themeStatic tag
        var foundMiddleware = false,mw;
        calipso.app.stack.forEach(function(middleware,key) {

         if(middleware.handle.tag === 'theme.stylus') {
           foundMiddleware = true;
           mw = calipso.app.mwHelpers.stylusMiddleware(theme.path);
           calipso.app.stack[key].handle = mw;
         }

         if(middleware.handle.tag === 'theme.static') {
           foundMiddleware = true;
           mw = calipso.app.mwHelpers.staticMiddleware(theme.path);
           calipso.app.stack[key].handle = mw;
         }

        });

        next();

      }

    });

  } else {

    if(themeName ===  defaultTheme) {
      calipso.error("Unable to locate the theme: " + themeName + ", terminating.");
      process.exit();
    } else {
      calipso.error('The `' + themeName + '` theme is missing, trying the defaul theme: `' + defaultTheme + '`');
      configureTheme(next, defaultTheme);
    }

  }

} 

/**
 * Check that the mongodb instance specified in the configuration is valid.
 */
function mongoConnect(dbUri, checkInstalling, next) {

  // Test the mongodb configuration
  var isInstalled = calipso.config.get('installed');

  // If first option is callback, ste dbUri to config value
  if(typeof dbUri === "function") {
    next = dbUri;
    dbUri = calipso.config.get('database:uri');
    checkInstalling = false;
  }

  // Check we are installing ...
  if(checkInstalling) {
    var db = mongoose.createConnection(dbUri, function(err) {
      next(err, false);
    });
    return;
  }

  if(isInstalled) {

    // Always disconnect first just in case any left overs from installation
    mongoose.disconnect(function() {

        // TODO - what the hell is going on with mongoose?
        calipso.db = mongoose.createConnection(dbUri, function(err) {
            
            if (err) {
              
              // Add additional detail to know errors
              switch (err.code) {
                case "ECONNREFUSED":
                  calipso.error("Unable to connect to the specified database: ".red + dbUri);
                  break;
                default:
                  calipso.error("Fatal unknown error: ".magenta + err);
              }
              
              mongoose.disconnect(function() {
                next(err);
              });

            }

        });

        calipso.silly("Database connection to " + dbUri + " was successful.");

        // Replace the inmemory session with mongodb backed one
        var foundMiddleware = false, mw;
        calipso.app.stack.forEach(function(middleware,key) {
            if(middleware.handle.tag === 'session') {
              foundMiddleware = true;
              mw = calipso.lib.express.session({ secret: calipso.config.get('session:secret') , store: mongoStore({ url: calipso.config.get('database:uri') }) });
              mw.tag = 'session'
              calipso.app.stack[key].handle = mw;
            }
        });

        if(!foundMiddleware) {
          return next(new Error("Unable to load the MongoDB backed session, please check your session and db configuration"),false);
        }

        return next(null, true);

    });

  } else {

    calipso.silly("Database connection not attempted to " + dbUri + " as in installation mode.")

    // Create a dummy connection to enable models to be defined
    calipso.db = mongoose.createConnection('');

    next(null,false);

  }

}
