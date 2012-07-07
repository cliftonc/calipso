var app, rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso'));

/**
 * Route all of the modules based on the module event model
 * This replaces an earlier version that only executed modules in
 * parallel via step
 */

function eventRouteModules(req, res, next) {

  // Ignore static content
  // TODO : Make this more connect friendly or at least configurable
  if (req.url.match(/^\/images|^\/js|^\/css|^\/favicon.ico|png$|jpg$|gif$|css$|js$/)) {
    return next();
  }

  req.timeStart = new Date();

  // Attach our event listener to this request
  attachRequestEvents(req, res);

  // Initialise the response re. matches
  // Later used to decide to show 404
  res.routeMatched = false;

  // Store our callback here
  req.routeComplete = function(res) {
    if(!res.finished) next();
  };

  // Route 'first' modules that fire before all others
  // These first modules can stop the routing of all others 
  doFirstModules(req, res, function(err) {

    var iterator = function(module, cb) {
       routeModule(req, res, module, false, false, cb);
    }

    calipso.lib.async.map(calipso.lib._.keys(calipso.modules), iterator, function(err, result) {
      // Not important
    })

  });

}

/**
 * Attach module event emitters and request event listener
 * to this request instance.
 * This will only last for the context of a current request
 */

function attachRequestEvents(req, res) {

  // Create a request event listener for this request, pass in functions 
  // to enable testing.
  req.event = new calipso.event.RequestEventListener({
    notifyDependencyFn: notifyDependenciesOfRoute,
    registerDependenciesFn: registerDependencies
  });

  // 
  var maxListeners = calipso.config.get('server:events:maxListeners');

  // Attach all the modules to it
  for (var module in calipso.modules) {
    req.event.registerModule(req, res, module, {maxListeners: maxListeners});
  }

}

/**
 * Helper to register dependent modules that should be checked by a module when
 * routing, the parent module's emitter is passed in.
 */
function registerDependencies(moduleEmitter, moduleName) {

  // Register depends on parent
  if (calipso.modules[moduleName].fn && calipso.modules[moduleName].fn.depends) {
    calipso.modules[moduleName].fn.depends.forEach(function(dependentModule) {
      moduleEmitter.modules[moduleName].check[dependentModule] = false;
    });
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
  if (module.enabled && (depends || !module.fn.depends) && (last || !module.fn.last) && !module.fn.first) {

    // Fire event to start
    req.event.modules[moduleName].route_start();

    // Route
    module.fn.route(req, res, module, calipso.app, function(err, moduleName) {

      // Gracefully deal with errors
      if (err) {
        res.statusCode = 500;
        calipso.error(err.message);
        res.errorMessage = "Module " + moduleName + ", error: " + err.message + err.stack;
      }

      // Expose configuration if module has it
      if (module.fn && module.fn.config) {
        var modulePermit = calipso.permission.Helper.hasPermission("admin:module:configuration");
        res.menu.admin.addMenuItem(req, {
          name: moduleName,
          path: 'admin/modules/' + moduleName,
          url: '/admin/modules?module=' + moduleName,
          description: 'Manage ' + moduleName + ' settings ...',
          permit: modulePermit
        });
      }

      // Finish event
      req.event.modules[moduleName].route_finish();

      // Check to see if we have completed routing all modules
      if (!last) {
        checkAllModulesRouted(req, res);
      }

      next();

    });

  } else {

    checkAllModulesRouted(req, res);

    next();

  }

}

/**
 * Check that all enabled modules have been initialised
 * Don't check disabled modules or modules that are setup for postRoute only
 */
function checkAllModulesRouted(req, res) {

  var allRouted = true;

  for (var module in req.event.modules) {
    var moduleRouted = (req.event.modules[module].routed || (calipso.modules[module].enabled && (calipso.modules[module].fn.last || calipso.modules[module].fn.first)) || !calipso.modules[module].enabled);
    allRouted = moduleRouted && allRouted;
  }

  if (allRouted && !req.event.routeComplete) {
    req.event.routeComplete = true;
    doLastModules(req, res, function() {
      req.timeFinish = new Date();
      req.timeDuration = req.timeFinish - req.timeStart;
      calipso.silly("All modules routed in " + req.timeDuration + " ms");
      doResponse(req, res);
    });
  }

}


/**
 * RUn any modules that are defined as first routing modules
 * via first: true, dependencies are ignored for these.
 */
function doFirstModules(req, res, next) {

  // Get all the postRoute modules
  var firstModules = [];
  for (var moduleName in calipso.modules) {
    if (calipso.modules[moduleName].enabled && calipso.modules[moduleName].fn.first) {
      firstModules.push(calipso.modules[moduleName]);
    }
  }


  if(firstModules.length === 0) return next();

  // Execute their routing functions
  calipso.lib.step(

  function doFirstModules() {
    var group = this.group();
    firstModules.forEach(function(module) {
      module.fn.route(req, res, module, calipso.app, group());
    });
  }, function done(err) {

    // Gracefully deal with errors
    if (err) {
      res.statusCode = 500;
      console.log(err.message);
      res.errorMessage = err.message + err.stack;
    }

    next();

  });

}


/**
 * RUn any modules that are defined as last routing modules
 * via last: true, dependencies are ignored for these atm.
 */

function doLastModules(req, res, next) {

  // Get all the postRoute modules
  var lastModules = [];
  for (var moduleName in calipso.modules) {
    if (calipso.modules[moduleName].enabled && calipso.modules[moduleName].fn.last) {
      lastModules.push(calipso.modules[moduleName]);
    }
  }


  if(lastModules.length === 0) return next();

  // Execute their routing functions
  calipso.lib.step(

  function doLastModules() {
    var group = this.group();
    lastModules.forEach(function(module) {
      module.fn.route(req, res, module, calipso.app, group());
    });
  }, function done(err) {

    // Gracefully deal with errors
    if (err) {
      res.statusCode = 500;
      console.log(err.message);
      res.errorMessage = err.message + err.stack;
    }

    next();

  });

}

/**
 * Standard response to all modules completing their routing
 */

function doResponse(req, res, next) {

  // If we are in install mode, and are not in the installation process, then redirect
  if (!calipso.config.get('installed') && !req.url.match(/^\/admin\/install/)) {
    calipso.silly("Redirecting to admin/install ...");
    calipso.app.doingInstall = true;
    res.redirect("/admin/install");
    return;
  }

  // If nothing could be matched ...
  if (!res.routeMatched) {
    calipso.log("No Calipso module routes matched the current URL.");
    res.statusCode = 404;
  }

  // Render statuscodes dealt with by themeing engine
  // TODO - this is not very clean
  if (res.statusCode === 404 || res.statusCode === 500 || res.statusCode === 200) {

    calipso.theme.render(req, res, function(err, content) {

      if (err) {

        // Something went wrong at the layout, cannot use layout to render.
        res.statusCode = 500;
        res.send("<html><h2>A fatal error occurred!</h2>" + "<p>" + (err.xMessage ? err.xMessage : err.message) + "</p>" + "<pre>" + err.stack + "</pre></html>");
        req.routeComplete(res);

      } else {

        res.setHeader('Content-Type', 'text/html');
        // Who am I?
        res.setHeader('X-Powered-By', 'Calipso');

        // render
        res.send(content);

        // Callback
        req.routeComplete(res);

      }

    });

  } else {

    // Otherwise, provided we haven't already issued a redirect, then pass back to Express
    req.routeComplete(res);

  }

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
  for (var module in calipso.modules) {
    if (calipso.modules[module].enabled) {
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
  if (depends || !calipso.modules[module].fn.depends) {

    // Init start event
    calipso.modules[module].event.init_start();

    // Next run any init functions
    calipso.modules[module].fn.init(calipso.modules[module], calipso.app, function(err) {

      // Init finish event
      calipso.modules[module].inited = true;
      calipso.modules[module].event.init_finish();

      // Now, load any routes to go along with it
      if (calipso.modules[module].fn.routes && calipso.modules[module].fn.routes.length > 0) {
        calipso.lib.async.map(calipso.modules[module].fn.routes, function(options, next) {
          calipso.modules[module].router.addRoute(options, next);
        }, function(err, data) {
          if (err) calipso.error(err);
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
  for (var module in calipso.modules) {
    allLoaded = (calipso.modules[module].inited || !calipso.modules[module].enabled) && allLoaded;
  }

  if (allLoaded && !calipso.initComplete) {
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

function loadModules(next) {

  var configuredModules = calipso.config.get('modules') || {};

  // Run any disable hooks
  for (var module in calipso.modules) {
    // Check to see if the module is currently enabled, if we are disabling it.
    if (calipso.modules[module].enabled && configuredModules[module].enabled === false && typeof calipso.modules[module].fn.disable === 'function') {
      calipso.modules[module].fn.disable();
    }
  }

  // Clear the modules object (not sure if this is required, but was getting strange errors initially)
  delete calipso.modules; // 'Delete' it.
  calipso.modules = {}; // Always reset it

  var moduleBasePath = path.join(rootpath, calipso.config.get('server:modulePath'));

  // Read the modules in from the file system, sync is fine as we do it once on load.
  calipso.lib.fs.readdirSync(moduleBasePath).forEach(function(type) {

    if (type != "README" && type != '.DS_Store') { // Ignore the readme file and .DS_Store file for Macs
      calipso.lib.fs.readdirSync(path.join(moduleBasePath, type)).forEach(function(moduleFolderName) {

        if (moduleFolderName != "README" && moduleFolderName != '.DS_Store') { // Ignore the readme file and .DS_Store file for Macs
          
          var modulePath = path.join(moduleBasePath, type, moduleFolderName);
          
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

          if (module.enabled) {

            // Load the module itself via require
            requireModule(calipso.modules[module.name], modulePath);

            // Load the templates (factored out so it can be recalled by watcher)
            loadModuleTemplates(calipso.modules[module.name], path.join(modulePath,'templates'));

          }

        }

      });
    }

  });

  // Now that all are loaded, attach events & depends
  attachModuleEventsAndDependencies();

  // Save configuration changes (if required)
  if (calipso.config.dirty) {
    calipso.config.save(next);
  } else {
    return next();
  }

}

/**
 * Load data from package.json or theme.json
 */

function loadAbout(obj, fromPath, file) {

  var fs = calipso.lib.fs;

  var packageFile = calipso.lib.path.join(fromPath, file);

  if (fs.existsSync(packageFile)) {
    var json = fs.readFileSync(packageFile);
    try {
      obj.about = JSON.parse(json.toString());
      if (obj.about && obj.about.name) {
        obj.library = obj.about.name;
      } else {
        obj.library = obj.name;
      }
    } catch (ex) {
      obj.about = {
        description: 'Invalid ' + file
      };
    }
  }

}

/**
 * Connect up events and dependencies
 * Must come after all modules are loaded
 */

function attachModuleEventsAndDependencies() {

  var options = {maxListeners: calipso.config.get('server:events:maxListeners'), notifyDependencyFn: notifyDependenciesOfInit};

  for (var module in calipso.modules) {

    // Register dependencies
    registerModuleDependencies(calipso.modules[module]);
    
    // Attach event listener
    calipso.event.addModuleEventListener(calipso.modules[module], options);

  }

  // Sweep through the dependency tree and make sure any broken dependencies are disabled
  disableBrokenDependencies();

}

/**
 * Ensure dependencies are mapped and registered against parent and child
 */

function registerModuleDependencies(module) {

  if (module.fn && module.fn.depends && module.enabled) {

    // Create object to hold dependent status
    module.check = {};

    // Register depends on parent
    module.fn.depends.forEach(function(dependentModule) {

      module.check[dependentModule] = false;

      if (calipso.modules[dependentModule] && calipso.modules[dependentModule].enabled) {

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
  for (var moduleName in calipso.modules) {
    var module = calipso.modules[moduleName];
    if (module.enabled && module.fn && module.fn.depends) {
      module.fn.depends.forEach(function(dependentModule) {
        if (!calipso.modules[dependentModule].enabled) {
          calipso.modules[module.name].error = "Module " + module.name + " depends on " + dependentModule + ", but it does not exist or is disabled - this module will not load.";
          calipso.error(calipso.modules[module.name].error);
          calipso.modules[module.name].enabled = false;
          disabled = disabled + 1;
        }
      });
    }
  }

  // Recursive
  if (disabled > 0) disableBrokenDependencies();

}

/**
 * Notify dependencies for initialisation
 */

function notifyDependenciesOfInit(moduleName, options) {

  var module = calipso.modules[moduleName];
  if (module.notify) {
    module.notify.forEach(function(notifyModuleName) {
      notifyDependencyOfInit(moduleName, notifyModuleName, options);
    });
  }

}


/**
 * Notify dependencies for routing
 */

function notifyDependenciesOfRoute(req, res, moduleName, reqModules) {

  var module = calipso.modules[moduleName];
  if (module.notify) {
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

function notifyDependencyOfInit(moduleName, notifyModuleName, options) {

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

function notifyDependencyOfRoute(req, res, moduleName, notifyModuleName) {

  var module = req.event.modules[notifyModuleName];
  module.check[moduleName] = true;
  checkRouted(req, res, moduleName, notifyModuleName);

}

/**
 * Check if all dependencies are met and we should init the module
 */

function checkInit(module, next) {

  var doInit = true;
  for (var check in module.check) {
    doInit = doInit & module.check[check];
  }
  if (doInit) {
    // Initiate the module, no req for callback
    initModule(module.name, true, function() {});
  }

}

/**
 * Check if all dependencies are met and we should route the module
 */

function checkRouted(req, res, moduleName, notifyModuleName) {

  var doRoute = true;

  for (var check in req.event.modules[notifyModuleName].check) {
    doRoute = doRoute && req.event.modules[notifyModuleName].check[check];
  }

  if (doRoute) {
    // Initiate the module, no req for callback
    // initModule(module.name,true,function() {});
    routeModule(req, res, notifyModuleName, true, false, function() {});
  }

}

/**
 * Load the module itself, refactored out to enable watch / reload
 * Note, while it was refactored out, you can't currently reload
 * a module, will patch in node-supervisor to watch the js files and restart
 * the whole server (only option :())
 */

function requireModule(module, modulePath, reload, next) {

  var fs = calipso.lib.fs;
  var moduleFile = path.join(modulePath + '/' + module.name);

  try {

    // Require the module
    module.fn = require(moduleFile);

    // Attach a router - legacy check for default routes
    module.router = new calipso.router(module.name, modulePath);

    // Load the routes if specified as either array or function
    if (typeof module.fn.routes === "function") module.fn.routes = module.fn.routes();
    module.fn.routes = module.fn.routes || [];

    // Ensure the defaultConfig exists (e.g. if it hasn't been required before)
    // This is saved in the wider loadModules loop to ensure only one config save action (if required)
    if (module.fn.config && !calipso.config.getModuleConfig(module.name, '')) {
      calipso.config.setDefaultModuleConfig(module.name, module.fn.config);
    }

  } catch (ex) {

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

  if (!calipso.lib.fs.existsSync(moduleTemplatePath)) {
    return null;
  }

  fs.readdirSync(moduleTemplatePath).forEach(function(name) {

    // Template paths and functions
    var templatePath = moduleTemplatePath + "/" + name;
    var templateExtension = templatePath.match(/([^\.]+)$/)[0];
    var template = fs.readFileSync(templatePath, 'utf8');
    var templateName = name.replace(/\.([^\.]+)$/, '');

    // Load the template - only if not already loaded by theme (e.g. overriden)
    var hasTemplate = calipso.utils.hasProperty('theme.cache.modules.' + module.name + '.templates.' + templateName, calipso);

    if (hasTemplate) {

      // Use the theme version
      templates[templateName] = calipso.theme.cache.modules[module.name].templates[templateName];

    } else {

      // Else load it
      if (template) {
        // calipso.theme.compileTemplate => ./Theme.js
        templates[templateName] = calipso.theme.compileTemplate(template, templatePath, templateExtension);

        // Watch / unwatch files - always unwatch (e.g. around config changes)
        if (calipso.config.get('performance:watchFiles')) {

          fs.unwatchFile(templatePath); // Always unwatch first due to recursive behaviour
          fs.watchFile(templatePath, {
            persistent: true,
            interval: 200
          }, function(curr, prev) {
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
 *  Exports
 */
module.exports = {
  loadModules: loadModules,
  initModules: initModules,
  eventRouteModules: eventRouteModules,
  notifyDependenciesOfInit: notifyDependenciesOfInit,
  notifyDependenciesOfRoute: notifyDependenciesOfRoute,
  registerDependencies: registerDependencies,
  loadAbout: loadAbout
};
