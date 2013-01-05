/*!
 * Calipso Common CLI Download (Modules / Themes)
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Provides functions to enable download from repo.calip.so, github, full URL.
 *
 */

/**
 * Module exports
 *
 */
var sys;
try {
  sys = require('util');
} catch (e) {
  sys = require('sys');
}
var rootpath = process.cwd() + '/',
  path = require('path')
calipso = require(path.join(rootpath, 'lib/calipso')),
  colors = require('colors');


function Api(url) {

  this.url = url || calipso.config.get('calipso:repo:url');
  this.url = this.url + (calipso.lib._.last(this.url) !== "/" ? "/" : "");

}

/**
 * Retrieve a specific item from the repo
 * @options
 *  type : module, theme, profile
 *  name : name of module
 */
Api.prototype.get = function (options, next) {

  // Construct the url based on the options
  var url = this.url + path.join('get',
    (options.type ? options.type : "all"),
    (options.name ? options.name : "*"),
    (options.version ? options.version : "master"));

  console.log("");
  console.log("Asking repository for " + options.type.green.bold + "/" + options.name.green.bold + "@".white + options.version.green.bold + " ...");

  // Simple get request
  get(url, next);

}


/**
 * Wrapper for Repo List
 * @options
 *  type : module, theme, profile
 *  name : name of module
 */
Api.prototype.find = function (type, options, next) {

  // Construct the url based on the options
  var searchString = options[1];
  var url = this.url + path.join('find', type, searchString);

  console.log("");
  console.log("Searching repository for " + type + " " + searchString.green.bold + " ...");

  // Simple get request
  get(url, next);

}

/**
 * Simple wrapper for get requests
 */
function get(url, cb) {

  // Parse the url to determine request type
  var parts = require('url').parse(url);
  if (parts.protocol === 'https:') {
    client = require('https');
  } else {
    client = require('http');
    if (!parts.port) {
      parts.port = 80;
    }
  }

  // Make request
  client.get({ host:parts.hostname, port:parts.port, path:parts.pathname },function (res) {

    var data = '';
    res.setEncoding('utf8');

    res.on('data', function (d) {
      data += d;
    });

    res.on('end', function () {
      try {
        var json = JSON.parse(data);
        cb(null, json);
      } catch (ex) {
        cb(new Error("Unable to parse JSON response: " + ex.message));
      }
    });

  }).on('error', function (err) {
      cb(err, null);
    });
}

/**
 * Exports
 */
module.exports = exports = Api;
