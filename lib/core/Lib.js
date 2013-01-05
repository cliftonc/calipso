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
var rootpath = process.cwd() + '/';

module.exports = {
  fs:require('fs'),
  path:require('path'),
  express:require('express'),
  step:require('step'),
  util:require('util'),
  mongoose:require('mongoose'),
  url:require('url'),
  ejs:require('ejs'),
  pager:require(rootpath + 'utils/pager'),
  prettyDate:require(rootpath + 'utils/prettyDate.js'),
  prettySize:require(rootpath + 'utils/prettySize.js'),
  crypto:require(rootpath + 'utils/crypto.js'),
  connect:require('connect'),
  _:require('underscore'),
  async:require('async')
};
