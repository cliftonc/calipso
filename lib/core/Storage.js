/*!
 * Calipso MongoDB Storage Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides a few simple functions that can be used to help manage MongoDB and Mongoose.
 */

var rootpath = process.cwd(),
  path = require('path'),
  events = require('events'),
  mongoStore = require(path.join(rootpath, 'support/connect-mongodb')),
  mongoose = require('mongoose'),
  calipso = require(path.join('..', 'calipso'));

function Storage() {
  // Store running map reduce functions
  this.mr = {};
}

/**
 * Check that the mongodb instance specified in the configuration is valid.
 */
Storage.prototype.mongoConnect = function(dbUri, checkInstalling, next) {

  // Test the mongodb configuration
  var isInstalled = calipso.config.get('installed');

  // If first option is callback, ste dbUri to config value
  if (typeof dbUri === "function") {
    next = dbUri;
    dbUri = calipso.config.get('database:uri');
    checkInstalling = false;
  }

  // Check we are installing ...
  if (checkInstalling) {
    var db = mongoose.createConnection(dbUri, function(err) {
      next(err, false);
    });
    return;
  }

  if (isInstalled) {

    // Always disconnect first just in case any left overs from installation
    mongoose.disconnect(function() {

      // TODO - what the hell is going on with mongoose?
      calipso.db = mongoose.createConnection(dbUri, function(err) {

        if (err) {

          // Add additional detail to know errors
          if (err.code === "ECONNREFUSED") {
            calipso.error("Unable to connect to the specified database: ".red + dbUri);
          } else {
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

      calipso.app.stack.forEach(function(middleware, key) {
        if (middleware.handle.tag === 'session') {
          foundMiddleware = true;
          mw = calipso.lib.express.session({
            secret: calipso.config.get('session:secret'),
            store: mongoStore({
              url: calipso.config.get('database:uri')
            })
          });
          mw.tag = 'session';
          calipso.app.stack[key].handle = mw;
        }
      });

      if (!foundMiddleware) {
        return next(new Error("Unable to load the MongoDB backed session, please check your session and db configuration"), false);
      }

      return next(null, true);

    });

  } else {

    calipso.silly("Database connection not attempted to " + dbUri + " as in installation mode.");

    // Create a dummy connection to enable models to be defined
    calipso.db = mongoose.createConnection('');

    next(null, false);

  }

};

module.exports = new Storage();
