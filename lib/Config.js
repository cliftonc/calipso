/**
 * Configuration library
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  step = require('step'),
  fs = require('fs');

/**
 * Config object, wrapper for nconf
 *  @type
 *  @options
 */
function Config(options) {

  // Defaults
  this.type = options && options.type ? options.type : 'file';
  this.env = options && options.env ? options.env : (global.process.env.NODE_ENV || 'development');
  this.path = options && options.path ? options.path : path.join(rootpath,'conf');
  this.file = path.join(this.path, this.env + '.json');

  // Default to file based on environment
  this.options = options && options.options ? options.options : { file: this.file };

  // Initialise
  this.nconf = require('nconf');
  this.load();

}

/**
 * Check to see if configuration for this environment
 * doesn't exist, if so, it loads the default from default.json.
 */
Config.prototype.check = function () {

  if(!path.existsSync(this.file)) {
    try {
      var defaultFile = fs.readFileSync(path.join(this.path,'default.json'));
      fs.writeFileSync(this.file,defaultFile);
    } catch(ex) {
      console.log("Error: Unable to load default configuration, please ensure that conf/default.json exists or specify an environment that has a configuration file.");
      return false;
    }
  } else {
    return true;
  }

}


/**
 * Load the configuration
 */
Config.prototype.load = function() {

  // Check if config exists for this environment or default it
  if(this.check()) {
    // Initialise nconf
    this.nconf.use(this.type, this.options);
    return true;
  } else {
    return false;
  }

}

/**
 * Get config - wrapper
 */
Config.prototype.get = function(key) {
  return this.nconf.get(key);
}

/**
 * Set config
 */
Config.prototype.set = function(key,value) {
  this.nconf.set(key,value);
}

/**
 * Save config
 */
Config.prototype.save = function(next) {
  this.nconf.save(next);
}

/**
 * Set & save config
 */

Config.prototype.setSave = function(key,value,next) {
  this.set(key,value);
  this.save(next);
}

/**
 * Export the config object
 */
exports.Config = Config;
