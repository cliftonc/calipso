/**
 * Configuration library
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  step = require('step'),
  _ = require('underscore'),
  fs = require('fs'),
  calipso = require(path.join('..', 'calipso'));

/**
 * Config object, wrapper for nconf
 *  @type
 *  @options
 */

function Configuration(options) {
  calipso.config = this;
  
  // Defaults
  this.env = options && options.env ? options.env : (process.env.NODE_ENV || 'development');
  this.defaultConfig = options && options.defaultConfig ? options.defaultConfig : path.join(rootpath, 'lib', 'conf', 'default.json');
  if (process.env.MONGO_URI) {
    this.type = 'memory';
    this.dbUri = process.env.MONGO_URI;
  } else {
    this.type = options && options.type ? options.type : 'file';
    this.path = options && options.path ? options.path : path.join(rootpath, 'conf');
    this.file = path.join(this.path, this.env + '.json');
  }
  // Track if changes have been made to config
  this.dirty = false;

}

Configuration.prototype.init = function (next) {
  if (typeof next !== 'function') {
    next = function (err) {
      if (err) {
        console.error(err.message)
      }
    };
  }
  var Provider = require('nconf').Provider;
  this.nconf = new Provider();
  this.load(next);
}

/**
 * Check to see if configuration for this environment
 * doesn't exist, if so, it loads the default from default.json.
 */
Configuration.prototype.check = function () {
  if (this.type === 'memory')
    return null;
  if (!(fs.existsSync || path.existsSync)(this.file)) {
    try {
      var defaultFile = fs.readFileSync(this.defaultConfig);
      // Parse it to make sure there are no errors
      defaultFile = JSON.stringify(JSON.parse(defaultFile), true);
      fs.writeFileSync(this.file, defaultFile);
    } catch (ex) {
      return ex.message;
    }
    return null;
  } else {
    return null;
  }

}

Configuration.prototype.getModel = function () {
  var model = null;
  try {
    model = calipso.db.model('Conf');
  }
  catch (e) {
  }
  var schema = new calipso.lib.mongoose.Schema({
    environment: {type:String, required: true, unique: true},
    configuration: calipso.lib.mongoose.Schema.Types.Mixed
  });
  return calipso.db.model('Conf', schema);
}

function fixSlash(data) {
  for (d in data) {
    var v = data[d];
    if (Array.isArray(v) || typeof v === 'object') {
      data[d] = fixSlash(v);
      continue;
    }
    if (typeof v === 'string') {
      if (/&#x2F;/.test(v)) {
        data[d] = v.replace(/&#x2F;/g, "/");
      }
    }
  }
  return data;
}

/**
 * Load the configuration
 */
Configuration.prototype.load = function (next) {

  // Check if config exists for this environment or default it
  var checkConfig = this.check();
  if (!checkConfig) {
    if (this.type === 'memory') {
      var self = this;
      calipso.storage.mongoConnect(process.env.MONGO_URI || calipso.config.get('database:uri'), true, function (err, connected) {
        var Conf = self.getModel();
        Conf.findOne({environment:self.env}, function (err, conf) {
          if (!conf || !conf.configuration) {
            var defaultFile = fs.readFileSync(self.defaultConfig);
            // Parse it to make sure there are no errors
            try {
              defaultFile = JSON.parse(defaultFile);
              conf = new Conf({environment:self.env,configuration:defaultFile});
            }
            catch (er) {
              return next && next(er);
            }
          }
          self.store = fixSlash(conf.configuration);
          try {
            self.nconf.use(self.type, this);
            self.nconf.stores.memory.store = self.store;
            self.nconf.clear('database:uri');
          } catch (ex) {
            return next && next(ex);
          }
          self.nconf.save = function (callback) {
            Conf.findOne({environment:self.env}, function (err, conf) {
              if (err) return callback && callback(err);
              if (!conf) conf = new Conf();
              self.nconf.clear('database:uri');
              conf.configuration = self.nconf.stores.memory.store;
              conf.environment = self.env;
              conf.save(function (err) {
                if (err) console.log(err);
                if (callback) callback(err);
              });
            });
          }
          if (next) next(null);
        });
      });
      return;
    }
    
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
Configuration.prototype.get = function (key) {
  return this.nconf.get(key);
}

/**
 * Get config for module - wrapper
 */
Configuration.prototype.getModuleConfig = function (moduleName, key) {
  var moduleKey = 'modules:' + moduleName + ':config' + (key ? ':' + key : '');
  return this.nconf.get(moduleKey);
}


/**
 * Set config
 */
Configuration.prototype.set = function (key, value) {
  this.dirty = true;
  this.nconf.set(key, value);
}

/**
 * Set config for module - wrapper
 */
Configuration.prototype.setModuleConfig = function (moduleName, key, value) {
  var moduleKey = 'modules:' + moduleName + ':config' + (key ? ':' + key : '');
  this.dirty = true;
  this.nconf.set(moduleKey, value);
}

/**
 * Set default config for module - wrapper
 */
Configuration.prototype.setDefaultModuleConfig = function (moduleName, config) {

  var moduleKey = 'modules:' + moduleName + ':config';
  this.dirty = true;

  // Extract the defaults from the config  
  var defaultConfig = _.reduce(_.keys(config), function (memo, key) {
    memo[key] = config[key].
      default;
    return memo;
  }, {})

  this.nconf.set(moduleKey, defaultConfig);

}

/**
 * Save config
 */
Configuration.prototype.save = function (next) {
  this.dirty = false;
  this.nconf.save(next);
}

/**
 * Set & save config
 */

Configuration.prototype.setSave = function (key, value, next) {
  this.set(key, value);
  this.dirty = false;
  this.save(next);
}

/**
 * Export the config object
 */
module.exports = Configuration;
