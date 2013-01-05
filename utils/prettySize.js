/*
 * JavaScript Pretty Size
 * Created by Geoffrey Johnson
 *
 * Adapted from Pretty Date
 * Copyright (c) 2008 John Resig (jquery.com)
 * Licensed under the MIT license.
 */

// Takes an integer in bytes and returns a human-readable string.
var rootpath = process.cwd() + '/',
  path = require('path');

exports = module.exports = {
  prettySize:function (bytes) {
    if (!(bytes != null) || isNaN(bytes)) {
      return '-';
    }
    if (bytes < 1024) {
      return '' + bytes + 'B';
    }
    var exp = Math.floor(Math.log(bytes) / Math.log(1024));
    return '' + (Math.round(bytes / Math.pow(1024, exp) * 10) / 10) + 'KMGTPEZY'.charAt(exp - 1) + 'B';
  }
};
