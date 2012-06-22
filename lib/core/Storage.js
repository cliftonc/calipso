/*!
 * Calipso DB Storage Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides a few simple functions that can be used to help manage JugglingDB.
 */

var rootpath = process.cwd(),
  path = require('path'),
  events = require('events'),
  jugglingdb = require('jugglingdb'),
  calipso = require(path.join('..', 'calipso'));

function Storage() {
  // Store running map reduce functions
  this.mr = {};
}

/**
 * Check that the database instance specified in the configuration is valid.
 */
Storage.prototype.connect = function(dbType, config, checkInstalling, next) {

  // Test the db configuration
  var isInstalled = calipso.config.get('installed');

  // If first option is callback, set dbType to config value
  if (typeof dbType === "function") {
    next = dbType;
    dbType = 'memory';
    checkInstalling = false;
  }

  // Check we are installing ...
  if (checkInstalling) {
    try {
      var db = new jugglingdb.Schema(dbType, config);
      db.on('connected', function () {
        next(null, true);
      })
    }
    catch(err) {
      next(err, false);
    }
    return;
  }

  if (isInstalled) {

      try {
        calipso.db = new jugglingdb.Schema(dbType, config);
        // To maintain compatibility
        calipso.db.model = function (model) {
          return calipso.db.models[model];
        }
      }
      catch(err) {
        calipso.error("Unable to connect to the specified database ".red + dbType + ", the problem was: ".red + err.message);
        next(err, false);
        return;
      }
      calipso.db.on('connected',function () {

        calipso.silly("Database connection to " + dbType + " was successful.");

        // Replace the inmemory session with database backed one
        var foundMiddleware = false, mw;

        calipso.app.stack.forEach(function(middleware, key) {
          if (middleware.handle.tag === 'session') {
            foundMiddleware = true;
            mw = calipso.lib.express.session({
              secret: calipso.config.get('session:secret'),
              //store: calipso.db
            });
            mw.tag = 'session';
            calipso.app.stack[key].handle = mw;
          }
        });

        if (!foundMiddleware) {
          return next(new Error("Unable to load the Database backed session, please check your session and db configuration"), false);
        }

        return next(null, true);

      });


  } else {

    calipso.silly("Database connection not attempted to " + dbType + " as in installation mode.");

    // Create a dummy connection to enable models to be defined
    calipso.db = new jugglingdb.Schema('memory');

    next(null, false);

  }

};

module.exports = new Storage();
