var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * Default configuration manager This file controls the loading, and initial
 * configuration of Calipso. Configuration is stored in Mongodb, in the
 * AppConfigs collection, it will always contain a single item (though could
 * contain more for a future multisite type configuration).
 */
module.exports = function(app, express, next) {

  /**
   * This is the default configuration
   * TODO
   * - This should probably be in an external file so easier to version.
   * - This should probably be on a per-environment basis.
   */
  var defaultConfig = {
    cache: false,
    theme: 'cleanslate',
    language: 'en',
    install: true,
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
    theme: {
      type: String,
      required: true,
      'default': 'default'
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
    watchFiles: {
      type: Boolean,
      'default': true
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
  app.configure(NODE_ENV, function() {
    require("./"+NODE_ENV+".js")(app, express);
    loadConfig(app, defaultConfig, function(err, config) {
      app.set('config', config);
      next(err);
    });
  });


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
  mongoose.connect(app.set('db-uri'));
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
        next(null, config);
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

}