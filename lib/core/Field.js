/*!
 * Calipso Fields Class
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library adds a field class to calipso, and provides an api for field modules.
 *
 */

var path = require('path'),
  calipso = require('../calipso');

/**
 * A set of helper functions to handle generation of field json.
 */
var FieldHelpers = {

  // Holder of defined fields and callbacks for getting settings and rendering json.
  fieldTypes:[],
  settingsForm:{},
  json:{},

  // Define Field Info
  fieldInfo:function (fieldType, settingsCb, jsonCb) {

    var self = this;

    self.fieldTypes.push(fieldType);
    self.settingsForm[fieldType] = settingsCb;
    self.json[fieldType] = jsonCb;
  },

};

/**
 * Export an instance of our object
 */
exports.Helper = FieldHelpers;
