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
var isWorker = false;
try {
  var cluster = require('cluster');
  isWorker = cluster.isWorker;
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
  if (isWorker && false) {
    options = options || {};
    options.ignoreSTDIN = true;
  }
  Hook.call(self, options);
  self.on('hook::ready', function(){
    // ?
  });

}

util.inherits(CalipsoHook, Hook);

