/*!
 * Calipso Module Event Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides an event emitter for modules that is created on each request,
 * to provide the ability for module dependencies to be managed, as well as enable modules
 * to ensure that they run after all other modules have emitted certain events (e.g. menu rendering).
 *
 *
 */

/**
 * Includes
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  util = require('util'),
  events = require('events'),
  calipso = require(path.join('..', 'calipso'));

exports = module.exports = {
  CalipsoEventEmitter:CalipsoEventEmitter,
  RequestEventListener:RequestEventListener,
  addModuleEventListener:addModuleEventListener,
  // Module & Routing Event constants
  ROUTE_START:'route_s',
  ROUTE_FINISH:'route_f',
  INIT_START:'init_s',
  INIT_FINISH:'init_f'
};


/**
 * Calipso event emitter, object that enables calipso to emit events.
 * Events are always triggered at server scope, and cannot be used to
 * Execute functions in request scope
 */

function CalipsoEventEmitter(options) {

  var self = this;

  // Initialise options
  this.options = options || {};

  // Create an emitter to drive events
  this.emitter = new events.EventEmitter();
  this.emitter.setMaxListeners(Number(this.options.maxListeners) || 100);

  // Holder for events, enable debugging of module events
  this.events = {};

  // Clear all existing listeners
  this.init = function () {

    // Clear down the event emitters
    for (var event in self.events) {

      self.emitter.removeAllListeners("PRE_" + event);
      self.emitter.removeAllListeners("POST_" + event);

      if (self.events[event].custom) {
        for (var key in self.events[event].custom) {
          self.emitter.removeAllListeners(event + "_" + key);
        }
      }

    }

    // Add core events not created by modules
    this.addEvent('FORM');

  };

  // Wrapper for event emitter, enable turn on / off
  this.addEvent = function (event, options) {

    options = calipso.lib._.extend({
      enabled:true
    }, options);

    this.events[event] = options;
    // Enable tracking of attached listeners for debugging purposes
    this.events[event].preListeners = {
      '#':0
    };
    this.events[event].postListeners = {
      '#':0
    };
    this.events[event].custom = {};
  };

  // Pre and post event prefixes
  var pre_prefix = 'PRE_',
    post_prefix = 'POST_';

  // Register a pre listener
  this.pre = function (event, listener, fn) {

    self.emitter.on(pre_prefix + event, fn);
    this.events[event].preListeners[listener] = this.events[event].preListeners[listener] || [];
    this.events[event].preListeners[listener].push({
      name:fn.name
    });
    this.events[event].preListeners['#'] += 1;
  };

  // Register a post listener
  this.post = function (event, listener, fn) {
    self.emitter.on(post_prefix + event, fn);
    this.events[event].postListeners[listener] = this.events[event].postListeners[listener] || [];
    this.events[event].postListeners[listener].push({
      name:fn.name
    });
    this.events[event].postListeners['#'] += 1;
  };

  // Register a custom event listener
  this.custom = function (event, key, listener, fn) {

    self.emitter.on(event + '_' + key, fn);

    // Register under key
    this.events[event].custom[key] = this.events[event].custom[key] || {
      customListeners:{
        '#':0
      }
    };

    // Register
    this.events[event].custom[key].customListeners[listener] = this.events[event].custom[key].customListeners[listener] || [];
    this.events[event].custom[key].customListeners[listener].push({
      name:fn.name
    });
    this.events[event].custom[key].customListeners['#'] += 1;

  };

  // Emit a pre event
  this.pre_emit = function (event, data, next) {

    var cb;

    // Create a callback to track completion of all events (only if next exists)
    if (typeof next === "function") {
      cb = createCallback(this.events[event].preListeners['#'], data, next);
    } else {
      cb = function () {
      };
    }

    if (this.events[event] && this.events[event].enabled) {
      self.emitter.emit(pre_prefix + event, pre_prefix + event, data, cb);
    }

  };

  // Emit a post event
  this.post_emit = function (event, data, next) {

    var cb;

    // Create a callback to track completion of all events (only if next exists)
    if (typeof next === "function") {
      cb = createCallback(this.events[event].postListeners['#'], data, next);
    } else {
      cb = function () {
      };
    }

    if (this.events[event] && this.events[event].enabled) {
      self.emitter.emit(post_prefix + event, post_prefix + event, data, cb);
    }

  };

  // Emit a custom event
  this.custom_emit = function (event, key, data, next) {

    var cb;

    if (this.events[event] && this.events[event].custom[key] && this.events[event].enabled) {

      // Create a callback to track completion of all events (only if next exists)
      if (typeof next === "function") {
        cb = createCallback(this.events[event].custom[key].customListeners['#'], data, next);
      } else {
        cb = function () {
        };
      }

      self.emitter.emit(event + '_' + key, event + '_' + key, data, cb);

    } else {
      next(data);
    }

  };

  // Create a curried callback function for use in the emit code

  function createCallback(total, data, callback) {

    var count = 0,
      total = total,
      outputStack = [];

    if (data) {
      outputStack.push(data);
    }

    // No listeners, so callback immediately
    if (total === 0) {
      callback(data);
      return;
    }

    return function (data) {

      count += 1;

      if (data) {
        outputStack.push(data);
      }

      // Merge the outputs from the stack
      if (count === total) {
        callback(mergeArray(outputStack));
      }

    };

  }

}

/**
 * Module event emitter, object that enables modules to emit events.
 * This contains both server and request scope event emitters, though clearly
 * an instance of an object only emits one or the other depending on
 * where it is instantiated.
 */

function ModuleInitEventEmitter(moduleName, options) {

  events.EventEmitter.call(this);

  var self = this;

  self.options = options || {};
  this.moduleName = moduleName;

  // Set the max listeners
  var maxListeners = Number(self.options.maxListeners) || 100;
  this.setMaxListeners(maxListeners);

  this.init_start = function (options) {
    self.emit(exports.INIT_START, self.moduleName, options);
  };

  this.init_finish = function (options) {
    self.emit(exports.INIT_FINISH, self.moduleName, options);
  };

}


/**
 * Event listener linked to the module itself
 * This is for server events (e.g. init, reload)
 * No events here can sit within the request context as
 * they will apply to all requests
 */

function addModuleEventListener(module, options) {

  options = options || {};

  var moduleEventEmitter = module.event = new ModuleInitEventEmitter(module.name, options),
    notifyDependencyFn = options.notifyDependencyFn || function () {
    };

  // Link events
  moduleEventEmitter.once(exports.INIT_START, function (moduleName, options) {
    // Do nothing
  });

  moduleEventEmitter.once(exports.INIT_FINISH, function (moduleName, options) {
    // Check for dependent modules, init them
    notifyDependencyFn(moduleName, options);
  });

}

/**
 * Module event emitter, object that enables modules to emit events.
 * This contains both server and request scope event emitters, though clearly
 * an instance of an object only emits one or the other depending on
 * where it is instantiated.
 */
function ModuleRequestEventEmitter(moduleName, options) {

  events.EventEmitter.call(this);

  // Refresh the require
  var self = this;
  self.options = options || {};
  self.moduleName = moduleName;

  // Set the max listeners
  var maxListeners = Number(self.options.maxListeners) || 100;
  this.setMaxListeners(maxListeners);

  this.route_start = function (options) {
    self.emit(exports.ROUTE_START, self.moduleName, options);
  };

  this.route_finish = function (options) {
    self.emit(exports.ROUTE_FINISH, self.moduleName, options);
  };

}

/**
 * Event listener linked to the request object
 * This is the object that will listen to each module event emitter
 * and call other modules or perform other defined functions
 */

function RequestEventListener(options) {

  options = options || {};

  // Register a module, listen to its events
  var self = this,
    notifyDependencyFn = options.notifyDependencyFn || function () {
    },
    registerDependenciesFn = options.registerDependenciesFn || function () {
    };

  // Local hash of module event emitters, used to track routing status
  this.modules = {};

  // Register a module
  this.registerModule = function (req, res, moduleName, options) {

    // Register event emitter
    var moduleEventEmitter = self.modules[moduleName] = new ModuleRequestEventEmitter(moduleName, options);

    // Configure event listener
    self.modules[moduleName].routed = false; // Is it done
    self.modules[moduleName].check = {}; // Hash of dependent modules to check if initialised

    // Curried function to notify dependent modules that we have finished
    var notifyDependencies = function (moduleName) {
      notifyDependencyFn(req, res, moduleName, self.modules);
    };

    registerDependenciesFn(self, moduleName);

    // Start
    moduleEventEmitter.once(exports.ROUTE_START, function (moduleName, options) {
      self.modules[moduleName].start = new Date();
    });

    // Finish
    moduleEventEmitter.once(exports.ROUTE_FINISH, function (moduleName, options) {

      self.modules[moduleName].finish = new Date();
      self.modules[moduleName].duration = self.modules[moduleName].finish - self.modules[moduleName].start;
      self.modules[moduleName].routed = true;

      // Callback to Calipso to notify dependent objects of route
      // calipso.notifyDependenciesOfRoute(req, res, moduleName, self.modules);
      notifyDependencies(moduleName);

    });

  };

}

/**
 * Inherits
 */
util.inherits(ModuleInitEventEmitter, events.EventEmitter);
util.inherits(ModuleRequestEventEmitter, events.EventEmitter);


/**
 *  Helper functions TODO CONSOLIDATE!
 */

function mergeArray(arr, first) {
  var output = {};
  arr.forEach(function (value, key) {
    if (first) {
      output = merge(value, output);
    } else {
      output = merge(output, value);
    }
  });
  return output;
}

function merge(a, b) {
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
}
