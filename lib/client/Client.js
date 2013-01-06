/**
 * This library provides a wrapper to enable modules to load javascript and styles into an
 * array, that can then be rendered into a theme in the appropriate location.
 *
 * Styles and JS are all indexed by key, so you could write functions that over-wrote them in the theme as the
 * last update will always stick.
 *
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso')),
  fs = require('fs');

/**
 * Client Object - handle CSS and JS loading for modules out to themes
 */
var Client = module.exports = function Client(options) {

  this.options = options || {
    'minified-script':'media/calipso-main'
  };

  this.scripts = [];
  this.styles = [];

  // Shortcuts to core, must be included somewhere (module or theme) to be rendered
  this.coreScripts = {
    'jquery':{key:'jquery', url:'jquery-1.8.3.min.js', weight:-100},
    'calipso':{key:'calipso', url:'calipso.js', weight:-50}
  }

};

Client.prototype.addScript = function (options) {

  var self = this;

  // Convert our options over with flexible defaults
  if (typeof options === "string") {
    if (this.coreScripts[options]) {
      options = this.coreScripts[options];
    } else {
      options = {
        name:options,
        url:options,
        weight:0
      };
    }
  }
  if (!options.name) {
    options.name = options.url;
  }

  // Add the script
  self._add('scripts', options.name, options);

};

/**
 * Create simple list of all client JS
 */
Client.prototype.listScripts = function (next) {

  // TODO - this should be updated to use LABjs by default (?)
  var self = this;
  var output = "<!-- Calipso Module Scripts -->";
  self.scripts.forEach(function (value) {
    output += '\r\n<script title="' + value.name + '" src="' + value.url + '"></script>';
  });
  output += "<!-- End of Calipso Module Scripts -->";
  next(null, output);

};

Client.prototype.addStyle = function (options) {

  var self = this;

  // Convert our options over with flexible defaults
  if (typeof options === "string") {
    options = {
      name:options,
      url:options,
      weight:0
    };
  }
  if (!options.name) {
    options.name = options.url;
  }

  // Add the script
  self._add('styles', options.name, options);

};

/**
 * Compile together all of the client side scripts
 */
Client.prototype.listStyles = function (next) {

  // TODO - this should be updated to use LABjs by default (?)
  var self = this;
  var output = "<!-- Calipso Module Styles -->";

  self.styles.forEach(function (value) {
    output += '\r\n<link rel="stylesheet" title="' + value.name + '" href="' + value.url + '"/>';
  });
  output += "<!-- End of Calipso Module Styles -->";
  next(null, output);

};


/**
 * Helper to add unique elements to an array
 */
Client.prototype._add = function (arrName, name, options) {

  var self = this;
  self[arrName] = self[arrName] || [];

  // Find first match
  var found = calipso.lib._.find(self[arrName], function (value) {
    return (value.name && value.name === name) ? true : false;
  });

  if (found) {
    // Replace - this means we never get duplicates (e.g. of JQuery, JQueryUI)
    self[arrName].splice(found, 1, options);
  } else {
    // Push
    self[arrName].push(options);
  }

  // Sort - TODO, this can probably be more efficient by placing the new item smarter
  self[arrName].sort(function (a, b) {
    return a.weight > b.weight;
  });

};


/**
 * Compile together all of the client side scripts
 * TODO - this is currently not used, needs to be worked on and thought through.
 *
 Client.prototype.compile = function(next) {

  var self = this;

  try {

    var scriptFile = path.join(rootpath,self.options.script),
        scriptStream = fs.createWriteStream(scriptFile, {'flags': 'a'});

  } catch(ex) {

    console.dir(ex);

  }

  var grabFile = function(item, callback) {

    // TODO - allow referential
    var filePath = path.join(rootpath, item.url);

    // Check to see if the file has changed
    var stat = fs.lstatSync(filePath);

    fs.readFile(filePath, 'utf8', function(err, contents) {

      if(err) {

        return callback(new Error("Unable to locate file for ClientJS creation: " + filePath));

      } else {

        var drain;
        drain = scriptStream.write(contents);
        callback(null, stat.mtime);

      }
    });

  }

  // Callback wrapper to close the streams
  var done = function(err, data) {
    scriptStream.end();
    next(err, data);
  }

  // var contents = fs.readFileSync(config.out, 'utf8');
  calipso.lib.async.mapSeries(self.scripts, grabFile, function(err, scripts) {

      if(err) return done(err);

      var reduce = function(context, memo, value, index, list) {
        return (value > memo) ? value : memo;
      };

      var maxmtime = calipso.lib._.reduce(scripts, reduce);

      console.dir(maxmtime);

      var script = '<!-- ' + maxmtime + ' -->'

      done(null, script);

  })

}
 **/
