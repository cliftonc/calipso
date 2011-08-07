var mongoose = require('mongoose'),
    express = require('express'),
    Schema = mongoose.Schema;

var defaultTheme = 'cleanslate';

/**
 * Default configuration manager This file controls the loading, and initial
 * configuration of Calipso. Configuration is stored in Mongodb, in the
 * AppConfigs collection, it will always contain a single item (though could
 * contain more for a future multisite type configuration).
 */
module.exports = function(app, next) {

  /**
   * This is the default configuration
   * TODO
   * - This should probably be in an external file so easier to version.
   * - This should probably be on a per-environment basis.
   */
  var defaultConfig = {
    version:1,  // Used to warn - e.g. structural changes require a config reset
    cache: false,
    cacheTtl:600,
    theme: defaultTheme,
    adminTheme: defaultTheme,
    language: 'en',
    install: true,
    cryptoKey: createRandomString(),
    livePassword: createRandomString(),
    watchFiles: true,
    logs: {
      level: 'info',
      console: {
        enabled: true
      },
      file: {
        enabled: false,
        filepath: 'logs/calipso.log'
      }
    },
    modules: [{
      name: 'admin',
      enabled: true
    }, {
      name: 'content',
      enabled: true
    }, {
      name: 'contentTypes',
      enabled: true
    }, {
      name: 'user',
      enabled: true
    }, {
      name: 'taxonomy',
      enabled: true
    }]
  };

  /**
   * Mongoose schema for configuration storage
   */
  var AppConfigSchema = new Schema({
    version: {
      type: Number,
      required: true,
      'default': 0
    },
    theme: {
      type: String,
      required: true,
      'default': defaultTheme
    },
    adminTheme: {
      type: String,
      required: true,
      'default': defaultTheme
    },
    install: {
      type: Boolean,
      'default': false
    },
    language: {
      type: String,
      required: true,
      'default': 'en'
    },
    cryptoKey: {
      type: String,
      required: false,
      'default': 'calipso'
    },
    livePassword: {
      type: String,
      required: false,
      'default': createRandomString()
    },
    watchFiles: {
      type: Boolean,
      'default': true
    },
    cache: {
      type: Boolean,
      'default': false
    },
    cacheTtl: {
      type: Number,
      'default': 600
    },
    logs: {
      level: {
        type: String,
        required: true,
        'default': 'info'
      },
      console: {
        enabled: {
          type: Boolean,
          'default': true
        }
      },
      file: {
        enabled: {
          type: Boolean,
          'default': true
        },
        filepath: {
          type: String,
          required: true,
          'default': 'logs/calipso.log'
        }
      }
    },
    modules: [AppModule]
  });

  /**
   * Embedded mongoose schema to hold module status within the configuration
   */
  var AppModule = new Schema({
    name: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      required: true,
      'default': false
    }
  });

  mongoose.model('AppConfig', AppConfigSchema);

  /**
   * Load the environment configurations
   * Launch with "NODE_ENV=test node app" for test environment
   *  - (description of test env config)
   * Launch with "NODE_ENV=production node app" for production
   *  - reduces debugging and error reporting and increases speed
   */
  var NODE_ENV = global.process.env.NODE_ENV || 'development';
  app.set('environment',NODE_ENV);
  app.configure(NODE_ENV, function() {
    require("./"+NODE_ENV+".js")(app, express);
    loadConfig(app, defaultConfig, function(err, config) {
      app.set('config', config);
      next(err);
    });
  });

};

// prefer a getter since a property can be overwritten
module.exports.getDefaultTheme = function () {
  return defaultTheme;
};

/**
 * Load the configuration from the datbase, creating based on the default
 * and setting Calipso into install mode if it doesn't exist.
 *
 * @param app
 * @param defaultConfig
 * @param next
 */

function loadConfig(app, defaultConfig, next) {

  /**
   * Connect to mongoose and get configuration schema
   */
   mongoose.connect(app.set('db-uri'),function(err) {

     if(err) {
       next(err);
       return;
     }

    var AppConfig = mongoose.model('AppConfig');

    /**
     * Locate the configuration, if it doesn't exist create one based on
     * defaults.
     */
    AppConfig.findOne({}, function(err, config) {
      if (err) {
        next(err);
      } else {
        if (config) {

          var updateConfig = false;

          // Check that our config object is up to date with any changes.
          if(config.version != defaultConfig.version) {
            console.log("WARNING: The current config is not the same version as the default config.");
            console.log("It is strongly recommended to drop the current database for now (sorry - this needs to be improved!)");
            updateConfig = true;
          }

          // Update our config if appropriate
          if(updateConfig) {
            // Attempt to save
            config.save(function(err) {
              next(err, config);
            });
          } else {
            next(null,config);
          }

        } else {
          console.log("Setting default config (install mode) no configuration found in '" + app.set('db-uri') + "' database.");
          console.log("If this is incorrect or unexpected, please terminate now and check your database configuration before viewing any pages!\r\n\r\n");
          var newConfig = new AppConfig(defaultConfig);
          newConfig.save(function(err) {
            next(null, newConfig);
            return;
          });
        }
      }
    });

   });

}



/**
 * Check that the mongodb instance specified in the configuration is valid.
 */
function checkMongo(dbUri,next) {

  console.log(dbUri);
  GLOBAL.DEBUG = true;
  var connect = require('mongodb').connect;
  connect(dbUri, function(err, db) {
     next(err);
  });

}


/**
 *Random string for cryptoKey
 */
function createRandomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 8;
    var randomString = '';
    for (var i=0; i<string_length; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        randomString += chars.substring(rnum,rnum+1);
    }
    return randomString;
}