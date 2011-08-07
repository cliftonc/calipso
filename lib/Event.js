/*!
 * Calipso Module Event Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides an event emitter for modules that is created on each request,
 * to provide the ability for module dependencies to be managed, as well as enable modules
 * to ensure that they run after all other modules have emitted certain events (e.g. menu rendering).
 *
 * This library additionally introduces the Calipso Hook.io Wrapper, allowing certain calipso events to be
 * broadcast to a hook.io cloud.
 *
 */

/**
 * Includes
 */
var sys = require('sys'),
    util = require('util'),
    events = require('events'),
    CalipsoHook = require('lib/Hook').CalipsoHook;


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
  var options = options || {};

  // Create a hook.io emitter
  var hookOptions = options.hook || {
    name: 'calipso-hook',
    port: 9001,
    debug: false
  };
  this.hook = new CalipsoHook(hookOptions);
  this.hook.start();

  // Create an emitter to drive events
  this.emitter = new events.EventEmitter();
  this.emitter.setMaxListeners(500);

  // Holder for events, enable debugging of module events
  this.events = {};

  // Wrapper for event emitter, enable turn on / off
  this.addEvent = function(event, options) {
    var options = options || {enabled:true};
    this.events[event] = options;
    // Enable tracking of attached listeners for debugging purposes
    this.events[event].preListeners = {'#':0};
    this.events[event].postListeners = {'#':0};
    this.events[event].customListeners = {'#':0};
  }

  // Pre and post event prefixes
  var pre_prefix = 'PRE_',post_prefix='POST_';

  // Register a pre listener
  this.pre = function(event,listener,fn) {
     self.emitter.on(pre_prefix + event,fn);
     this.events[event].preListeners[listener] = this.events[event].preListeners[listener] || [];
     this.events[event].preListeners[listener].push(fn.name);
     this.events[event].preListeners['#'] += 1;
  }

  // Register a post listener
  this.post = function(event,listener,fn) {
     self.emitter.on(post_prefix + event,fn);
     this.events[event].postListeners[listener] = this.events[event].postListeners[listener] || [];
     this.events[event].postListeners[listener].push(fn.name);
     this.events[event].postListeners['#'] += 1;
  }

  // Register a custom event listener
  this.custom = function(event,key,listener,fn) {
     self.emitter.on(key + "_" + event,fn);
     this.events[event].customListeners[listener] = this.events[event].customListeners[listener] || [];
     this.events[event].customListeners[listener].push(fn.name);
     this.events[event].customListeners['#'] += 1;
  }

  // Emit a pre event
  this.pre_emit = function(event,data,next) {

    // Create a callback to track completion of all events (only if next exists)
    if(typeof next === "function") {
      var cb = createCallback(this.events[event].preListeners['#'],data,next);
    } else {
      var cb = function() {};
    }

    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(pre_prefix + event,pre_prefix + event,data,cb);
    }

  }

  // Emit a post event
  this.post_emit = function(event,data,next) {

    // Create a callback to track completion of all events (only if next exists)
    if(typeof next === "function") {
      var cb = createCallback(this.events[event].postListeners['#'],data,next);
    } else {
      var cb = function() {};
    }

    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(post_prefix + event,post_prefix + event,data,cb);
    }

  }

   // Emit a custom event
  this.custom_emit = function(event,key,data,next) {

    // Create a callback to track completion of all events (only if next exists)
    if(typeof next === "function") {
      var cb = createCallback(this.events[event].customListeners['#'],data,next);
    } else {
      var cb = function() {};
    }

    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(key + "_" + event,key + "_" + event,data,cb);
    }

  }

  // Create a curried callback function for use in the emit code
  function createCallback(total,data,callback) {

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
function ModuleEventEmitter(moduleName) {

  var self = this;
  this.moduleName = moduleName;
  this.setMaxListeners(100);

  this.init_start = function(options) {
    self.emit(exports.INIT_START,self.moduleName,options);
  };

  this.init_finish = function(options) {
    self.emit(exports.INIT_FINISH,self.moduleName,options);
  };

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

  var calipso = require('lib/calipso');
  var moduleEventEmitter = module.event = new ModuleEventEmitter(module.name);

  // Link events
  moduleEventEmitter.on(exports.INIT_START, function(moduleName, options) {
    // Check for dependent modules, init them
  });

  moduleEventEmitter.on(exports.INIT_FINISH, function(moduleName, options) {
    // Check for dependent modules, init them
    calipso.notifyDependenciesOfInit(moduleName, options);
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
  var calipso = require('lib/calipso');

  // Local hash of module event emitters, used to track routing status
  this.modules = {};

  // Register a module
  this.registerModule = function(req, res, moduleName) {

    // Register event emitter
    var moduleEventEmitter = self.modules[moduleName] = new ModuleEventEmitter(moduleName);

    // Configure event listener
    self.modules[moduleName].routed = false; // Is it done
    self.modules[moduleName].check = {};  // Hash of dependent modules to check if initialised
    self.req = req;  // Request
    self.res = res;  // Response

    // Register depends on parent
    if(calipso.modules[moduleName].fn && calipso.modules[moduleName].fn.depends) {
      calipso.modules[moduleName].fn.depends.forEach(function(dependentModule) {
        self.modules[moduleName].check[dependentModule] = false;
      });
    }

    // Start
    moduleEventEmitter.on(exports.ROUTE_START, function(moduleName, options) {
      self.modules[moduleName].start = new Date();
    });

    // Finish
    moduleEventEmitter.on(exports.ROUTE_FINISH, function(moduleName, options) {
      self.modules[moduleName].finish = new Date();
      self.modules[moduleName].duration = self.modules[moduleName].finish - self.modules[moduleName].start;
      self.modules[moduleName].routed = true;

      // Callback to Calipso to notify dependent objects of route
      calipso.notifyDependenciesOfRoute(self.req, self.res, moduleName, self.modules);

    });

  };

}

/**
 * Inherits
 */
sys.inherits(ModuleEventEmitter, events.EventEmitter);

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
