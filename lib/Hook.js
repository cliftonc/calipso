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
var sys = require('sys'),
    util = require('util'),
    Hook = require('hook.io').Hook;

exports = module.exports = {
      CalipsoHook: CalipsoHook,
};

/**
 * Calipso hook.io emitter
 */
function CalipsoHook(options) {

  var self = this;

  Hook.call(self, options);

  self.on('hook::ready', function(){
      // TO-DO
  });

}

util.inherits(CalipsoHook, Hook);

