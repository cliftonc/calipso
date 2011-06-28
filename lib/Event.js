/*!
 * Calipso Module Event Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides an event emitter for modules that is created on each request,
 * to provide the ability for module dependencies to be managed, as well as enable modules
 * to ensure that they run after all other modules have emitted certain events (e.g. menu rendering).
 *
 */

/**
 * Includes
 */
var sys = require('sys'),
    events = require('events');


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
function CalipsoEventEmitter() {

  var self = this;
  
  // Create an emitter to drive events
  this.emitter = new events.EventEmitter();

  // Holder for events, enable debugging of module events
  this.events = {};  
  
  // Wrapper for event emitter, enable turn on / off
  this.addEvent = function(event, options) {  
    var options = options || {enabled:true};
    this.events[event] = options;
    // Enable tracking of attached listeners for debugging purposes
    this.events[event].preListeners = {};
    this.events[event].postListeners = {};
  }
  
  // Pre and post event prefixes
  var pre_prefix = 'pre_',post_prefix='post_';
  
  // On event, call fn
  this.pre = function(event,listener,fn) {        
     self.emitter.on(pre_prefix + event,fn);
     this.events[event].preListeners[listener] = this.events[event].preListeners[listener] || [];
     this.events[event].preListeners[listener].push(fn.name);
  }
  
  // On event, call fn
  this.post = function(event,listener,fn) {        
     self.emitter.on(post_prefix + event,fn);
     this.events[event].postListeners[listener] = this.events[event].postListeners[listener] || [];
     this.events[event].postListeners[listener].push(fn.name);     
  }
  
  // Emit an event
  this.pre_emit = function(event,options) {
    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(pre_prefix + event,options);
    }
  }
  
  // Emit an event
  this.post_emit = function(event,options) {
    if(this.events[event] && this.events[event].enabled) {
      self.emitter.emit(post_prefix + event,options);
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

  /**
   * Register a module, listen to its events
   */
  var self = this;
  var calipso = require('lib/calipso');

  this.registerModule = function(req, res, moduleName) {

    // Register event emitter
    var moduleEventEmitter = self.modules[moduleName] = new ModuleEventEmitter(moduleName);

    // Configure event listener
    self.modules[moduleName].routed = false;
    self.modules[moduleName].check = {};
    self.req = req;
    self.res = res;

    // Register depends on parent
    if(calipso.modules[moduleName].fn && calipso.modules[moduleName].fn.depends) {
      calipso.modules[moduleName].fn.depends.forEach(function(dependentModule) {
        self.modules[moduleName].check[dependentModule] = false;
      });
    }

    // Link events
    moduleEventEmitter.on(exports.ROUTE_START, function(moduleName, options) {
      // Nothing yet :()
      self.modules[moduleName].start = new Date();
    });

    moduleEventEmitter.on(exports.ROUTE_FINISH, function(moduleName, options) {
      self.modules[moduleName].finish = new Date();
      self.modules[moduleName].duration = self.modules[moduleName].finish - self.modules[moduleName].start;
      self.modules[moduleName].routed = true;
      calipso.notifyDependenciesOfRoute(self.req, self.res, moduleName, self.modules);
    });

  };
  
  this.modules = {};

}

/**
 * Inherits
 */
sys.inherits(ModuleEventEmitter, events.EventEmitter);