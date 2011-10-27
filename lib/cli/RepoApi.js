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
var rootpath = process.cwd() + '/',
  path = require('path')
  calipso = require(path.join(rootpath, 'lib/calipso')),
  sys = require('sys'),
  colors = require('colors');


function Api(url) {
  this.url = url || "http://calip.so/repo/api/";
}

/**
 * Wrapper for Repo List
 * @options
 *  type : module, theme, profile
 *  name : name of module
 */
Api.prototype.list = function(options,next) {

  // Construct the url based on the options
  var url = this.url
    + (options.type ? options.type : "all")
    + "/" + (options.name ? options.name : "*")
    + "/" + (options.version ? options.version : "master");

  console.dir(url);

  // Simple get request
  get(url,next);

}

/**
 * Simple wrapper for get requests
 */
function get(url,cb) {

  // Parse the url to determine request type
  var parts = require('url').parse(url);
  if(parts.protocol === 'https:') {
    client = require('https');
  } else {
    client = require('http');
    if(!parts.port) {
      parts.port = 80;
    }
  }

  // Make request
  client.get({ host: parts.hostname, port: parts.port, path: parts.pathname }, function(res) {

    var data = '';
    res.setEncoding('utf8');

    res.on('data', function(d) {
      data += d;
    });

    res.on('end', function() {
      try {
        console.dir(data);
        var json = JSON.parse(data);
        cb(null,json);
      } catch(ex) {
        cb(new Error("Unable to parse JSON response: " + ex.message));
      }
    });

  }).on('error', function(err) {
    cb(err,null);
  });
}

/**
 * Exports
 */
module.exports = exports = Api;
