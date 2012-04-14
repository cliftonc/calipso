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
      CalipsoEventEmitter: CalipsoEventEmitter,
      RequestEventListener: RequestEventListener,
      addModuleEventListener: addModuleEventListener,
      // Module & Routing Event constants
      ROUTE_START: 'route_s',
      ROUTE_FINISH: 'route_f',
      INIT_START: 'init_s',
      INIT_FINISH: 'init_f'
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
  this.emitter.setMaxListeners(calipso.config.get('server:events:maxListeners'));

  // Holder for events, enable debugging of module events
  this.events = {};

  // Clear all existing listeners
  this.init = function() {

    // Clear down the event emitters
    for(var event in self.events) {

      self.emitter.removeAllListeners("PRE_" + event);
      self.emitter.removeAllListeners("POST_" + event);

      if(self.events[event].custom) {
        for(var key in self.events[event].custom) {
          self.emitter.removeAllListeners(key + "_" + event);
        };
      }

    }

    // Add core events not created by modules
    this.addEvent('FORM');

  }

  // Wrapper for event emitter, enable turn on / off
  this.addEvent = function(event, options) {
    var options = calipso.lib._.extend({enabled:true},options);
    this.events[event] = options;
    // Enable tracking of attached listeners for debugging purposes
    this.events[event].preListeners = {'#':0};
    this.events[event].postListeners = {'#':0};
    this.events[event].custom = {};
  }

  // Pre and post event prefixes
  var pre_prefix = 'PRE_',post_prefix='POST_';

  // Register a pre listener
  this.pre = function(event,listener,fn) {
   
     self.emitter.on(pre_prefix + event, fn);
     this.events[event].preListeners[listener] = this.events[event].preListeners[listener] || [];
     this.events[event].preListeners[listener].push({name:fn.name});
     this.events[event].preListeners['#'] += 1;
  }

  // Register a post listener
  this.post = function(event,listener,fn) {
     self.emitter.on(post_prefix + event, fn);
     this.events[event].postListeners[listener] = this.events[event].postListeners[listener] || [];
     this.events[event].postListeners[listener].push({name:fn.name});
     this.events[event].postListeners['#'] += 1;
  }

  // Register a custom event listener
  this.custom = function(event,key,listener,fn) {

     self.emitter.on(event, fn);

     // Register under key
     this.events[event].custom[key] = this.events[event].custom[key] || {customListeners: {'#':0}};

     // Register
     this.events[event].custom[key].customListeners[listener] = this.events[event].custom[key].customListeners[listener] || [];
     this.events[event].custom[key].customListeners[listener].push({name:fn.name});
     this.events[event].custom[key].customListeners['#'] += 1;

  }

  // Emit a pre event
  this.pre_emit = function(event, data, next) {

    // Create a callback to track completion of all events (only if next exists)
    if(typeof next === "function") {
      var cb = createCallback(this.events[event].preListeners['#'], data, next);
    } else {
      var cb = function() {};
    }

    if(this.events[event] && this.events[event].enabled) {
     self.emitter.emit(pre_prefix + event, pre_prefix + event, data, cb);
    }

  }

  // Emit a post event
  this.post_emit = function(event,data,next) {

    // Create a callback to track completion of all events (only if next exists)
    if(typeof next === "function") {
      var cb = createCallback(this.events[event].postListeners['#'], data, next);
    } else {
      var cb = function() {};
    }

    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(post_prefix + event, post_prefix + event, data, cb);
    }

  }

   // Emit a custom event
  this.custom_emit = function(event, key, data, next) {

    if(this.events[event] && this.events[event].custom[key] && this.events[event].enabled) {

      // Create a callback to track completion of all events (only if next exists)
      if(typeof next === "function") {
        var cb = createCallback(this.events[event].custom[key].customListeners['#'],data,next);
      } else {
        var cb = function() {};
      }

     
      self.emitter.emit(event, key, data, cb);
     
   } else {
     next(data);
   }

}

  // Create a curried callback function for use in the emit code
  function createCallback(total, data, callback) {

    this.count = 0;
    this.total = total;
    this.outputStack = [];

    if(data)
      this.outputStack.push(data);

    // No listeners, so callback immediately
    if(total === 0) {
      callback(data);
      return;
    }

   return function(data) {

      this.count += 1;

      if(data)
        this.outputStack.push(data);

      // Merge the outputs from the stack
      if(this.count === this.total) {
        callback(mergeArray(this.outputStack));
      }

    }

  }

}

/**
 * Module event emitter, object that enables modules to emit events.
 * This contains both server and request scope event emitters, though clearly
 * an instance of an object only emits one or the other depending on
 * where it is instantiated.
 */
function ModuleInitEventEmitter(moduleName) {

  events.EventEmitter.call(this);

  var self = this;
  this.moduleName = moduleName;

  // Set the max listeners
  var maxListeners = calipso.config.get('server:events:maxListeners') || 100;
  this.setMaxListeners(maxListeners);

  this.init_start = function(options) {
    self.emit(exports.INIT_START,self.moduleName,options);
  };

  this.init_finish = function(options) {
    self.emit(exports.INIT_FINISH,self.moduleName,options);
  };

}

/**
 * Module event emitter, object that enables modules to emit events.
 * This contains both server and request scope event emitters, though clearly
 * an instance of an object only emits one or the other depending on
 * where it is instantiated.
 */
function ModuleRequestEventEmitter(moduleName) {

  events.EventEmitter.call(this);

  // Refresh the require
  var self = this;
  this.moduleName = moduleName;

  // Set the max listeners
  var maxListeners = calipso.config.get('server:events:maxListeners') || 100;
  this.setMaxListeners(maxListeners);

  this.route_start = function(options) {
    self.emit(exports.ROUTE_START,self.moduleName,options);
  };

  this.route_finish = function(options) {
    self.emit(exports.ROUTE_FINISH,self.moduleName,options);
  };

}


/**
 * Event listener linked to the module itself
 * This is for server events (e.g. init, reload)
 * No events here can sit within the request context as
 * they will apply to all requests
 */
function addModuleEventListener(module) {

  var moduleEventEmitter = module.event = new ModuleInitEventEmitter(module.name);

  // Link events
  moduleEventEmitter.once(exports.INIT_START, function(moduleName, options) {
    // Do nothing
  });

  moduleEventEmitter.once(exports.INIT_FINISH, function(moduleName, options) {
    // Check for dependent modules, init them
    calipso.module.notifyDependenciesOfInit(moduleName, options);
  });

}

/**
 * Event listener linked to the request object
 * This is the object that will listen to each module event emitter
 * and call other modules or perform other defined functions
 */
function RequestEventListener() {

  // Register a module, listen to its events
  var self = this;

  // Local hash of module event emitters, used to track routing status
  this.modules = {};

  // Register a module
  this.registerModule = function(req, res, moduleName) {

    // Register event emitter
    var moduleEventEmitter = self.modules[moduleName] = new ModuleRequestEventEmitter(moduleName);

    // Configure event listener
    self.modules[moduleName].routed = false; // Is it done
    self.modules[moduleName].check = {};  // Hash of dependent modules to check if initialised
    // self.req = req;  // Request
    // self.res = res;  // Response

    var notifyDependencies = function(moduleName) {
       calipso.module.notifyDependenciesOfRoute(req, res, moduleName, self.modules);
    }

    // Register depends on parent
    if(calipso.modules[moduleName].fn && calipso.modules[moduleName].fn.depends) {
      calipso.modules[moduleName].fn.depends.forEach(function(dependentModule) {
        self.modules[moduleName].check[dependentModule] = false;
      });
    }

    // Start
    moduleEventEmitter.once(exports.ROUTE_START, function(moduleName, options) {
      self.modules[moduleName].start = new Date();
    });

    // Finish
    moduleEventEmitter.once(exports.ROUTE_FINISH, function(moduleName, options) {

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
function mergeArray(arr,first) {
  var output = {};
  arr.forEach(function(value,key) {
      if(first) {
        output = merge(value,output);
      } else {
        output = merge(output,value);
      }
  });
  return output;
}

function merge(a, b){
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
};
