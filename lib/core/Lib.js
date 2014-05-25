/*!
 * Calipso Imports
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This library is used to allow a single place to add new 3rd party libraries or utilities that 
 * are then automatically accessible via calipso.lib.library in any module.
 *  
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso'));
if (calipso.wrapRequire) { require = calipso.wrapRequire(require); }

var pager = require('./utils/pager'),
  prettyDate = require('./utils/prettyDate'),
  prettySize = require('./utils/prettySize'),
  crypto = require('./utils/crypto');

module.exports = {
  fs:require('fs'),
  path:require('path'),
  express:require('express'),
  step:require('step'),
  util:require('util'),
  mongoose:require('mongoose'),
  url:require('url'),
  ejs:require('ejs'),
  pager:pager,
  prettyDate:prettyDate,
  prettySize:prettySize,
  crypto:crypto,
  connect:require('connect'),
  _:require('underscore'),
  async:require('async')
};
