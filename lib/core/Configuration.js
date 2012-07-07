/**
 * Configuration library
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  step = require('step'),
  _ = require('underscore'),
  fs = require('fs');

/**
 * Config object, wrapper for nconf
 *  @type
 *  @options
 */

function Configuration(options) {

  // Defaults
  this.type = options && options.type ? options.type : 'file';
  this.env = options && options.env ? options.env : (process.env.NODE_ENV || 'development');
  this.path = options && options.path ? options.path : path.join(rootpath, 'conf');
  this.defaultConfig = options && options.defaultConfig ? options.defaultConfig : path.join(rootpath, 'lib', 'conf', 'default.json');
  this.file = path.join(this.path, this.env + '.json');

  // Track if changes have been made to config
  this.dirty = false;

}

Configuration.prototype.init = function(next) {
  if (typeof next !== 'function') next = function(err) {
    if (err) console.error(err.message)
  };
  this.nconf = new require('nconf');
  this.load(next);
}

/**
 * Check to see if configuration for this environment
 * doesn't exist, if so, it loads the default from default.json.
 */
Configuration.prototype.check = function() {

  if (!fs.existsSync(this.file)) {
    try {
      var defaultFile = fs.readFileSync(this.defaultConfig);
      // Parse it to make sure there are no errors
      defaultFile = JSON.stringify(JSON.parse(defaultFile), true);
      fs.writeFileSync(this.file, defaultFile);
    } catch (ex) {
      return ex.message;
    }
    return;
  } else {
    return;
  }

}

/**
 * Load the configuration
 */
Configuration.prototype.load = function(next) {

  // Check if config exists for this environment or default it
  var checkConfig = this.check();
  if (!checkConfig) {

    // Initialise nconf
    try {
      this.nconf.use(this.type, this);
    } catch (ex) {
      return next(ex);
    }

    this.nconf.load(next);

  } else {

    next(new Error("Unable to load configuration defined in " + this.env + ".json, there may be a problem with the default configuration in " + this.defaultConfig + ", reason: " + checkConfig));

  }

}

/**
 * Get config - wrapper
 */
Configuration.prototype.get = function(key) {
  return this.nconf.get(key);
}

/**
 * Get config for module - wrapper
 */
Configuration.prototype.getModuleConfig = function(moduleName, key) {
  var moduleKey = 'modules:' + moduleName + ':config' + (key ? ':' + key : '');
  return this.nconf.get(moduleKey);
}


/**
 * Set config
 */
Configuration.prototype.set = function(key, value) {
  this.dirty = true;
  this.nconf.set(key, value);
}

/**
 * Set config for module - wrapper
 */
Configuration.prototype.setModuleConfig = function(moduleName, key, value) {
  var moduleKey = 'modules:' + moduleName + ':config' + (key ? ':' + key : '');
  this.dirty = true;
  this.nconf.set(moduleKey, value);
}

/**
 * Set default config for module - wrapper
 */
Configuration.prototype.setDefaultModuleConfig = function(moduleName, config) {

  var moduleKey = 'modules:' + moduleName + ':config';
  this.dirty = true;

  // Extract the defaults from the config  
  var defaultConfig = _.reduce(_.keys(config), function(memo, key) {
    memo[key] = config[key].
  default;
    return memo;
  }, {})

  this.nconf.set(moduleKey, defaultConfig);

}

/**
 * Save config
 */
Configuration.prototype.save = function(next) {
  this.dirty = false;
  this.nconf.save(next);
}

/**
 * Set & save config
 */

Configuration.prototype.setSave = function(key, value, next) {
  this.set(key, value);
  this.dirty = false;
  this.save(next);
}

/**
 * Export the config object
 */
module.exports = Configuration;
