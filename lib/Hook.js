/*!
 * Calipso Hook.IO Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library additionally introduces the Calipso Hook.io Wrapper, allowing any calipso event to be
 * broadcast to a hook.io cloud.
 *
 */

/**
 * Includes
 */
var sys;
try {
 sys = require('util');
} catch (e) {
 sys = require('sys');
}
var disableHook = false;
try {
  var cluster = require('cluster');
  disableHook = cluster.isWorker;
}
catch (e) {
  
}
var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Hook = require('hook.io').Hook;

exports = module.exports = {
      CalipsoHook: CalipsoHook
};

/**
 * Calipso hook.io emitter
 */
function CalipsoHook(options) {

  var self = this;
  if (disableHook) {
    EventEmitter.call(self, options);
    this.start = function() { }
  } else
    Hook.call(self, options);
  self.on('hook::ready', function(){
    // ?
  });

}

if (disableHook) {
  util.inherits(CalipsoHook, EventEmitter);
  CalipsoHook.start = function() { };
} else
  util.inherits(CalipsoHook, Hook);

