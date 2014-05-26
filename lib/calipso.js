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
var os = require('os'),
  win = os.type().match(/Windows.*/);
  rootpath = process.cwd() + (win ? '\\' : '/'),
  path = require('path'),
  fs = require('fs'),
  events = require('events'),
  wrapRoot = path.normalize(process.cwd()),
  wrapCalipso = path.normalize(path.resolve(path.join(__dirname, '..')));

function debug() {
  //console.log.apply(console, arguments);
}
debug('WrapRoot', wrapRoot);
debug('WrapCalipso', wrapCalipso);

// Core object
var calipso = module.exports = {

  // Router and initialisation
  routingFn:routingFn,
  init:init,

  // Configuration exposed
  reloadConfig:reloadConfig,

  // Core objects - themes, data, modules
  theme:{},
  data:{},
  modules:{},

  // Wrap require so that requiring will require from this module when needed.
  // This can pull in modules relative to calipso library or modules
  // installed in node_modules inside of the calipso module itself.
  //
  wrapRequire: function (module) {
    modDir = path.normalize(path.dirname(module.filename));
    return function (mod) {
      isRoot = mod.substr(0, wrapRoot.length) == wrapRoot || mod.substr(0, wrapCalipso.length) == wrapCalipso;
      if (mod[0] == '.' || isRoot) {
        if (isRoot) {
          full = path.normalize(mod);
        } else {
          full = path.normalize(path.join(modDir, mod));
        }
        if (full.substr(0, wrapRoot.length) == wrapRoot) {
          debug('relative to site', modDir);
          try {
            res = module.require(full);
            debug('found relative to site', full);
            return res;
          }
          catch (e) {
            remote = path.normalize(path.join(wrapCalipso, path.relative(wrapRoot, full)));
            res = module.require(remote);
            debug('found relative to root', remote);
            return res;
          }
        } else {
          local = path.normalize(path.join(wrapRoot, path.relative(wrapCalipso, full)));
          try {
            res = module.require(local);
            debug('found relative to site', local);
            return res;
          }
          catch (e) {
            res = module.require(full);
            debug('found in root', full);
            return res;
          }
        }
      }
      try {
        res = module.require(mod);
        debug("wrapped", mod);
        return res;
      }
      catch (e) {
        res = require(mod);
        debug("absolute", mod);
        return res;
      }
    }
  }
};

// Load libraries in the core folder
loadCore(calipso);

function loadCore(calipso) {

  fs.readdirSync(__dirname + '/core').forEach(function (library) {
    var isLibrary = library.split(".").length > 0 && library.split(".")[1] === 'js',
      libName = library.split(".")[0].toLowerCase();
    if (isLibrary) {
      calipso[libName] = require(__dirname + '/core/' + library);
    }
  });

}
module.exports.loaded = true;

/**
 * Calipso initialisation
 */

function init(app, initCallback) {

  calipso.app = app;

  // Load the calipso package.json into app.about
  calipso.module.loadAbout(app, rootpath, 'package.json');

  // config is the actual instance of loaded config, configuration is the library.
  calipso.config = app.config;

  // Store the callback function for later
  calipso.initCallback = function () {
    initCallback();
  };

  // Configure the cache
  calipso.cacheService = calipso.cache.Cache({
    ttl:calipso.config.get('performance:cache:ttl')
  });

  // Create our calipso event emitter
  calipso.e = new calipso.event.CalipsoEventEmitter({maxListeners:Number(calipso.config.get('server:events:maxListeners'))});

  // Load configuration
  initialiseCalipso();

}

/**
 * Core router function.
 *
 * Returns a connect middleware function that manages the roucting
 * of requests to modules.
 *
 * Expects Calipso to be initialised.
 */

var Client;

function routingFn() {

  // Return the function that manages the routing
  // Ok being non-synchro
  return function (req, res, next) {

    // Default menus and blocks for each request
    // More of these can be added in modules, these are jsut the defaults
    res.menu = {
      admin:new calipso.menu('admin', 'weight', 'root', {
        cls:'admin'
      }),
      adminToolbar:new calipso.menu('adminToolbar', 'weight', 'root', {
        cls:'admin-toolbar toolbar'
      }),
      // TODO - Configurable!
      userToolbar:new calipso.menu('userToolbar', 'weight', 'root', {
        cls:'user-toolbar toolbar'
      }),
      primary:new calipso.menu('primary', 'name', 'root', {
        cls:'primary'
      }),
      secondary:new calipso.menu('secondary', 'name', 'root', {
        cls:'secondary'
      })
    };

    // Initialise our clientJS library linked to this request
    if (!Client) {
      Client = require('./client/Client');
    }
    res.client = new Client();

    // Initialise helpers - first pass
    calipso.helpers.getDynamicHelpers(req, res, calipso);

    // Route the modules
    calipso.module.eventRouteModules(req, res, next);

  };

}

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
  if (reloadConfig) {
    return calipso.config.load(finish);
  } else {
    return finish();
  }

  function finish() {
    // Clear Event listeners
    calipso.e.init();

    // Configure the logging
    calipso.logging.configureLogging();

    // Check / Connect Mongo
    calipso.storage.mongoConnect(process.env.MONGO_URI || calipso.config.get('database:uri'), false, function (err, connected) {

      if (err) {
        console.log("There was an error connecting to the database: " + err.message);
        process.exit();
      }

      // Load all the themes
      loadThemes(function () {

        // Initialise the modules and  theming engine
        configureTheme(function () {

          // Load all the modules
          calipso.module.loadModules(function () {

            // Initialise, callback via calipso.initCallback
            calipso.module.initModules();

          });

        });

      });

    });
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
    if (typeof next === "function") {
      next(err);
    }
  };
  return initialiseCalipso(true);

}

/**
 * Load the available themes into the calipso.themes object
 */

function loadThemes(next) {

  var themeBasePath = calipso.config.get('server:themePath'),
    themePath, legacyTheme, themes;

  // Load the available themes
  calipso.availableThemes = calipso.availableThemes || {};

  loadThemesDir(calipso.lib.path.join(rootpath, themeBasePath));
  loadThemesDir(calipso.lib.path.join(__dirname, '../themes'));

  function loadThemesDir(themesDir) {
    calipso.lib.fs.readdirSync(themesDir).forEach(function (folder) {

      if (folder != "README" && folder[0] != '.') {

        themes = calipso.lib.fs.readdirSync(calipso.lib.path.join(themesDir, folder));

        // First scan for legacy themes
        legacyTheme = false;
        themes.forEach(function (theme) {
          if (theme === "theme.json") {
            legacyTheme = true;
            console.log("Themes are now stored in sub-folders under the themes folder, please move: " + folder + " (e.g. to custom/" + folder + ").\r\n");
          }
        });

        // Process
        if (!legacyTheme) {
          themes.forEach(function (theme) {

            if (theme != "README" && theme[0] != '.') {
              themePath = calipso.lib.path.join(themesDir, folder, theme);
              // Create the theme object
              if (calipso.availableThemes[theme])
                return;
              calipso.availableThemes[theme] = {
                name:theme,
                path:themePath
              };
              // Load the about info from package.json
              calipso.module.loadAbout(calipso.availableThemes[theme], themePath, 'theme.json');
            }
          });
        }
      }
    });
  }
  next();

}

/**
 * Configure a theme using the theme library.
 */

function configureTheme(next, overrideTheme) {

  var defaultTheme = calipso.config.get("theme:default");
  var themeName = overrideTheme ? overrideTheme : calipso.config.get('theme:front');
  var themeConfig = calipso.availableThemes[themeName]; // Reference to theme.json
  if (themeConfig) {

    // Themes is the library
    calipso.themes.Theme(themeConfig, function (err, loadedTheme) {

      // Current theme is always in calipso.theme
      calipso.theme = loadedTheme;

      if (err) {
        calipso.error(err.message);
      }

      if (!calipso.theme) {

        if (loadedTheme.name === defaultTheme) {
          calipso.error('There has been a failure loading the default theme, calipso cannot start until this is fixed, terminating.');
          process.exit();
          return;
        } else {
          calipso.error('The `' + themeName + '` theme failed to load, attempting to use the default theme: `' + defaultTheme + '`');
          configureTheme(next, defaultTheme);
          return;
        }

      } else {

        calipso.debug('beginning to deal with \'stack\'');
        // Search for middleware that already has themeStatic tag
        var foundMiddleware = false,
          mw;
        calipso.app.stack.forEach(function (middleware, key) {
          if (middleware.handle.tag === 'theme.stylus') {
            calipso.debug('calipso.app.stack found theme.stylus');
            foundMiddleware = true;
            if ((fs.existsSync || path.existsSync)(themeConfig.path + '/stylus')) {
              mw = calipso.app.mwHelpers.stylusMiddleware(themeConfig.path);
            } else {
              mw = {tag:'theme.stylus'};
            }
            calipso.app.stack[key].handle = mw;
          }

          if (middleware.handle.tag === 'theme.static') {
            calipso.debug('calipso.app.stack found theme.static');
            foundMiddleware = true;
            mw = calipso.app.mwHelpers.staticMiddleware(themeConfig.path);
            mw.tag = 'theme.static';
            calipso.app.stack[key].handle = mw;
          }

        });

        calipso.debug('calipso.app.stack WITH THEME = ' + require('util').inspect(calipso.app.stack));

        next();

      }

    });

  } else {

    if (themeName === defaultTheme) {
      console.error("Unable to locate the theme: " + themeName + ", terminating.");
      process.exit();
    } else {
      calipso.error('The `' + themeName + '` theme is missing, trying the default theme: `' + defaultTheme + '`');
      configureTheme(next, defaultTheme);
    }

  }

}
