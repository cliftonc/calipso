/*!
 * Core administration module
 */
var calipso = require("lib/calipso");
exports = module.exports = {
  init: init,
  route: route,
   about: {
    description: 'Forms and functions to provide administration of configuration, installation and reloading of Calipso.',
    author: 'cliftonc',
    version: '0.2.0',
    home:'http://github.com/cliftonc/calipso'
  }
};

/*
 * Router
 */
function route(req, res, module, app, next) {


  // Menu items
  res.menu.admin.primary.push({ name: 'Admin',url: '/admin',regexp: /admin/});

  // Routing and Route Handler
  module.router.route(req, res, next);

}

/*
 * Initialisation
 */
function init(module, app, next) {

  calipso.lib.step(

  function defineRoutes() {

    module.router.addRoute('GET /admin', showAdmin, {
      template: 'admin',
      block: 'admin',
      admin: true
    }, this.parallel());

    module.router.addRoute('GET /admin/reload', reloadAdmin, {
      template: 'reload',
      block: 'admin',
      admin: true
    }, this.parallel());

    module.router.addRoute('POST /admin/save', saveAdmin, {
      admin: true
    }, this.parallel());

    module.router.addRoute('GET /admin/install', install, null, this.parallel());


  }, function done() {

    // Load the available themes into the calipso data object
    // Used when rendering the edit form
    calipso.data.themes = [];
    calipso.lib.fs.readdir(app.path + '/themes', function(err, folders) {

      folders.forEach(function(name) {
        calipso.data.themes.push({
          name: name,
          selected: app.set('config').theme === name
        });
      });

      calipso.data.loglevels = calipso.lib.winston.config.npm.levels;
      calipso.data.modules = calipso.modules;

      next();
    });

  });

  // NOTE: Configuration schemas are defined in Configuration.js
}

/**
 * Installation routine, this is triggered by the install flag being set
 * in the configuration, which is detected in the core routing function
 * in calipso.js and redirected here.
 */
function install(req, res, template, block, next) {

  // If not in install mode, do not install
  if (!calipso.app.set('config').install) {
    res.redirect("/");
    next();
    return;
  }

  // Run the module install scripts
  calipso.lib.step(

  function installModules() {
    var group = this.group();
    for (var module in calipso.modules) {
      // Check to see if the module is currently enabled, if so install it
      if (calipso.modules[module].enabled && typeof calipso.modules[module].fn.install === 'function') {
        calipso.modules[module].fn.install(group());
      } else {
        // Just call the group function to enable step to continue
        group()();
      }
    }
  }, function done(err) {

    // If we encounter any issues it must be catastrophic.
    if (err) {
      res.statusCode = 500;
      res.errorMessage = err.message;
      req.flash("error", "Calipso has become stuck in install mode. This is a catastrophic failure, please report it on github.");
      next()
      return;
    }

    // Retrieve the configuration from the database
    var AppConfig = calipso.lib.mongoose.model('AppConfig');
    AppConfig.findOne({}, function(err, c) {

      calipso.app.set('config').install = false;
      c.install = false;
      c.save(function(err) {
        if (err) {
          res.statusCode = 500;
          res.errorMessage = err.message;
          req.flash("error", "Calipso has become stuck in install mode. This is a catastrophic failure, please report it on github.");
        } else {
          // req.flash("info", "New administrative user created. You can now login as this user and begin using calipso.");
          req.flash("info", "Calipso has been installed with default user: admin, password: password.  Please login and change this!");
          if (res.statusCode != 302) {
            res.redirect("/");
          }
        }

        next();
        return;

      });
    });

  })

}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function showAdmin(req, res, template, block, next) {

  // Re-retrieve our object
  res.layout = "admin";

  var AppConfig = calipso.lib.mongoose.model('AppConfig');

  AppConfig.findOne({}, function(err, config) {
    var item = {
      id: config._id,
      type: 'config',
      meta: config.toObject()
    };
    calipso.theme.renderItem(req, res, template, block, {
      item: item
    });
    next();
  });

}

/**
 * Display the reload administration block
 */
function reloadAdmin(req, res, template, block, next) {

  res.reloadConfig = true;

  var item = {
    id: '0',
    type: 'config',
    meta: {
      reload: true
    }
  };

  calipso.theme.renderItem(req, res, template, block, {
    item: item
  });

  next();

}

/**
 * Save the modified configuration details on submission
 */
function saveAdmin(req, res, template, block, next) {

  calipso.form.process(req, function(form) {

    if (form) {

      // Re-retrieve our object
      var AppConfig = calipso.lib.mongoose.model('AppConfig');

      AppConfig.findOne({}, function(err, c) {

        if (!err && c) {

          c.theme = form.config.theme;
          c.cache = form.config.cache;
          c.watchFiles = form.config.watchFiles === 'on';
          c.logs.level = form.config.logslevel;
          c.logs.file.enabled = form.config.logsfileenabled === 'on';
          c.logs.file.filepath = form.config.logsfilefilepath;
          c.logs.console.enabled = form.config.logsconsoleenabled === 'on';

          c.modules = moduleFormatToArray(res, form.config.modules);

          c.save(function(err) {
            if (err) {
              req.flash('error', 'Could not update config: ' + err.message);
              if (res.statusCode != 302) { // Don't redirect if we already are, multiple errors
                res.redirect('/admin');
              }
            } else {
              calipso.log(c);
              calipso.config = c; // TODO : This wont work on multiple edits
              res.redirect('/admin/reload');
            }
            next();
          });

        } else {
          req.flash('error', 'Could not locate configuration!');
          res.redirect('/admin');
          next();

        }
      });

    } else {

      req.flash('error', 'Could not process form data!');
      res.redirect('/admin');
      next();

    }

  });

}

/**
 *Convert the modules into an array to enable rendering to the form
 */
function moduleFormatToArray(res, modules) {

  var arrayModules = [];

  for (var module in calipso.modules) {
    var enabled = modules[module] === 'on';
    arrayModules.push({
      name: module,
      enabled: enabled
    });
  }

  return arrayModules;

}