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
 *     lib : Libraries that can be re-used in each module (avoids repetition).
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
exports = module.exports = {

  //Export module dependencies, reduces need for later modules to require everything.
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
  getDynamicHelpers: function(req, res) {
    var helpers = {};
    for(var helper in this.dynamicHelpers) {
      helpers[helper] = this.dynamicHelpers[helper](req, res, this);
    }
    return helpers;
  },
  mr: {},             // Track running MR (Map Reduce) operations
  theme: {},
  data: {},           // Holds global config data
  modules: {},
  date: require('./calipsoDate').CalipsoDate,
  form: require('./calipsoForm').CalipsoForm,

  /**
   * Core router and initialisation function.
   *
   * Called by express e.g.
   *
   *     app.use(require('./lib/calipso')(app,options));
   *
   * Returns a connect middleware function that manages the routing
   * of requests to modules.
   */
  calipsoRouter: function(app, options, next) {

    // Store our references and options
    var calipso = this;
    calipso.app = app;

    options = options || {};

    // Configure the logging
    console.dir(options);
    configureLogging(calipso, options);

    // Initialise the modules and  theming engine
    configureTheme(calipso, function() {

      calipso.silly("Theme loaded ...");

      // Load all the modules
      loadModules(calipso,options);
      calipso.silly("Modules loaded ...");

      initModules(calipso, function() {
            next();
      });
    });

    // Return the function that manages the routing
    // Ok being non-synchro
    return function(req,res,next) {

      // Clear our menus and blocks for each request
      res.menu = {admin:{primary:[],secondary:[]},primary:[],secondary:[]};

      res.blocks = {};
      res.renderedBlocks = {};

      routeModules(req,res,next,calipso,app);

    };
  }

};

/**
 * Core module router that takes the basic request coming into calipso
 * and passes it on to the modules to route internally.
 *
 * Step is used to allow each of the modules to run in parallel, and it is 'all
 * routed' when it they all complete.
 *
 * There are a couple of special conditions (related to installation and configuration)
 * reloading that are in this function (rather than a module) at the moment.  TODO is to
 * refactor this so that these routines are in the admin module so this function is cleaner.
 *
 */

function routeModules(req, res, next, calipso, app) {

  // Ignore static content
  // TODO : Make this more connect friendly or at least configurable
  if(req.url.match(/^\/images|^\/js|^\/css|^\/favicon.ico/)) {
    next();
    return;
  }

  // Initialise the response re. matches
  res.routeMatched = false;

  // Pass the request onto each of the modules
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
    // Function to deal with the condition where the configuration needs to be reloaded.
    function reloadConfig() {
      if(res.reloadConfig) {
        var self = this;
        app.set('config', calipso.config);
        calipso.config = null;
        res.reloadConfig = null;
        configureLogging(calipso, app.set('config'));
        configureTheme(calipso, function() {
          calipso.silly("Theme loaded ...");
          loadModules(calipso, app.set('config'));
          initModules(calipso, function() {
            calipso.silly("Modules loaded ...");
            self();
          });
        });
      } else {
        this();
      }
    },
    // All routing has now completed.
    function allRouted(err) {

      calipso.silly("All routed ...");

      // If we have encountered an error, lets log it and pass it up the chain
      if(err) {
        calipso.error(err);
        next(err);
        return;
      }

      // If nothing could be matched ...
      if(!res.routeMatched) {
        calipso.silly("No Calipso module routes matched the current URL.");
        res.statusCode = 404;
      }

      // Check if we are in install mode
      if(calipso.app.set('config').install && (req.url != '/admin/install')) {

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

              calipso.theme.render(req, res, function(content) {

                res.setHeader('Content-Type', 'text/html');
                res.end(content, 'utf-8');

              });
            }
            break;
            next();

          default:
            // Do Nothing

        }

      };
    }
  );

}

/**
 * Configure winston to provide the logging services.
 *
 * TODO : This can be factored out into a module.
 *
 */
function configureLogging(calipso, options) {

  //Configure logging
  var logMsg = "\x1b[36mLogging enabled: \x1b[0m";
  var winston = require("winston");

  try {
    winston.remove(winston.transports.File);
  } catch(ex) {
    // Ignore the fault
  }

  if(options.logs && options.logs.file.enabled) {
    winston.add(winston.transports.File, { level: options.logs.level, filename: options.logs.file.filepath });
    logMsg += "File @ " + options.logs.file.filepath + " ";
  }

  try {
    winston.remove(winston.transports.Console);
  } catch(ex) {
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
function initModules(calipso, next) {

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
        calipso.modules[module].fn.init(calipso.modules[module], calipso.app,group());
      });
    },
    function allLoaded(err) {
      calipso.silly("All modules initialised ...");
      next();
    }
  );

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
function loadModules(calipso, options) {

  options = options || {};
  var modules = [];
  var configuredModules = {};

  options.modules.forEach(function(module) {
    configuredModules[module.name] = {enabled:module.enabled};
  });

  // Run any disable hooks
  for(var module in calipso.modules) {

    // Check to see if the module is currently enabled, if we are disabling it.
    if (calipso.modules[module].enabled && configuredModules[module].enabled == false && typeof calipso.modules[module].fn.disable === 'function') {

      calipso.modules[module].fn.disable();

    }

  }

  // Clear the modules object (not sure if this is required, but was getting strange errors initially)
  delete calipso['modules'];      // 'Delete' it.
  calipso.modules = {};           // Always reset it

  // Read the modules in from the file system, sync is fine as we do it once on load.
  calipso.lib.fs.readdirSync(__dirname + '/../modules').forEach(function(type){

    if(type != "README") {  // Ignore the readme file

      calipso.lib.fs.readdirSync(__dirname + '/../modules/' + type).forEach(function(name){

        if(name != "README") { // Ignore the readme file

              var enabled = configuredModules[name] && configuredModules[name].enabled;

              var modulePath = 'modules/' + type + '/' + name;

              // Create the module object
              calipso.modules[name] = {
                name: name,
                type: type,
                path: modulePath,
                enabled: enabled
              };

              if(enabled) {

                // Load the module itself via require
                requireModule(calipso, calipso.modules[name], modulePath);

                // Load the templates (factored out so it can be recalled by watcher)
                loadModuleTemplates(calipso, calipso.modules[name], modulePath + '/templates');

              }

         }

       });
    }

  });

  return calipso.modules;

}

/**
 * Load the module itself, refactored out to enable watch / reload
 * Note, while it was refactored out, you can't currently reload
 * a module, will patch in node-supervisor to watch the js files and restart
 * the whole server (only option :())
 */
function requireModule(calipso, module, modulePath, reload) {

  var fs = calipso.lib.fs;
  var moduleFile = modulePath + '/' + module.name + '.module';

  // Require the module
  module.fn = require(moduleFile);

  // Attach a router
  module.router = require('./calipsoRouter').Router(module.name);

  // Link the about text
  module.about = module.fn.about;

}

/**
 * Pre load all the templates in a module, synch, but only happens on app start up and config reload
 * This is attached to the templates attribute so used later.
 *
 * @param calipso
 * @param moduleTemplatePath
 * @returns template object
 */
function loadModuleTemplates(calipso, module, moduleTemplatePath) {

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
              loadModuleTemplates(calipso, module, moduleTemplatePath);

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
function configureTheme(calipso, next) {

  var themeName = calipso.app.set('config').theme;

  require('./calipsoTheme').Theme(themeName,function(theme) {

    calipso.theme = theme;

    // Search for middleware that already has themeStatic tag
    calipso.app.stack.forEach(function(middleware,key) {
     if(middleware.handle.tag === 'themeStatic') {
        // Replace it
        var themeStatic = calipso.lib.express.static(calipso.app.path + '/themes/' + themeName + '/public');
        themeStatic.tag = 'themeStatic';
        calipso.app.stack[key].handle = themeStatic;
     }
    });

    next();

  });

}
