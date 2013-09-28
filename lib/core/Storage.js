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
  mongoStore = require('connect-mongodb'),
  mongoose = require('mongoose'),
  calipso = require(path.join('..', 'calipso'));

function Storage() {
  // Store running map reduce functions
  this.mr = {};
}

/**
 * Check that the mongodb instance specified in the configuration is valid.
 */
Storage.prototype.mongoConnect = function (dbUri, checkInstalling, next) {

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
    if (calipso.db) {
      mongoose.disconnect(function () {
        calipso.db = mongoose.createConnection(dbUri, function (err) {
          if (err) {
            calipso.error(err.toString().red);
          }
          next(err, false);
        });
      });
    } else {
      calipso.db = mongoose.createConnection(dbUri, function (err) {
        if (err) {
          calipso.error(err.toString().red);
        }
        next(err, false);
      });
    }
    return;
  }

  if (process.env.MONGO_URI) {
    if (isInstalled)
      proceed();
    else
      next(null, true);
  } else if (isInstalled) {
    // Always disconnect first just in case any left overs from installation
    mongoose.disconnect(function () {
      // TODO - what the hell is going on with mongoose?
      calipso.db = mongoose.createConnection(dbUri, proceed);
    });
  } else {
    calipso.silly("Database connection not attempted to " + dbUri + " as in installation mode.");

    // Create a dummy connection to enable models to be defined
    calipso.db = mongoose.createConnection();

    next(null, false);

  }
  function proceed(err) {
    if (err) {

      calipso.error("Unable to connect to the specified database ".red + dbUri + ", the problem was: ".red + err.message);
      mongoose.disconnect(function () {
        return next(err, false);
      });

    } else {

      calipso.silly("Database connection to " + dbUri + " was successful.");

      // Replace the inmemory session with mongodb backed one
      var foundMiddleware = false, mw;

      calipso.app.stack.forEach(function (middleware, key) {
        if (middleware.handle.tag === 'session') {
          foundMiddleware = true;
          var maxAge = calipso.config.get('session:maxAge');
          if (maxAge) {
            try {
              maxAge = Number(maxAge) * 1000;
            }
            catch (e) {
              calipso.error('MaxAge value ' + maxAge + ' is not a numeric string');
              maxAge = undefined;
            }
          }
          mw = calipso.lib.express.session({
            secret:calipso.config.get('session:secret'),
            store:calipso.app.sessionStore = new mongoStore({
              db:calipso.db.db
            }),
            cookie:{ maxAge:maxAge }
          });
          mw.tag = 'session';
          calipso.app.stack[key].handle = mw;
        }
      });

      if (!foundMiddleware) {
        return next(new Error("Unable to load the MongoDB backed session, please check your session and db configuration"), false);
      }

      return next(null, true);

    }
  }
};

module.exports = new Storage();
