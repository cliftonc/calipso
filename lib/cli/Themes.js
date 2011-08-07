/*!
 * Calipso Theme Management Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Core library that controls the installation and management of themes.
 * No dependencies back on Calipso, this allows it to be run by the CLI as well
 * as from the web gui.
 *
 * Further detail is contained in comments for each function and object.
 *
 */

/**
 * Module exports
 *
 */
var calipso = require("lib/calipso"),
    exec = require('child_process').exec,
    sys = require('sys'),
    colors = require('colors'),
    semver = require('semver'),
    download = require('lib/cli/Download');

/**
 * Theme router - takes params from CLI and passes to appropriate function
 * Controls return based on CLI mode or web mode
 */
exports.themeRouter = function(path,options,cli,next) {

  switch(options[0]) {
    case 'list':
      listThemes(options,cli,next);
      break;
    case 'uninstall':
      uninstallTheme(options,cli,next);
      break;
    case 'download': // Default is github
      var toPath = calipso.app.path + "/themes/downloaded/";
      var fromUrl = options[1];
      download('theme',fromUrl,toPath,cli,function(err,themeName,path) {
          if(err) {
            next(err);
          } else {
            console.log("Theme ".green + themeName + " was installed successfully.".green);
            next();
          }
      });
      break;

    default:
      next(new Error("You need to specify a valid command, please refer to the help available for valid options."));
  }

}

/**
 * Show the list of currently installed modules - highlight those with issues / updates?
 */
function listThemes(options,cli,next) {

  // Command line
  if(cli) {
    console.log("\r\nInstalled Themes:".green.bold);
    for(var themeName in calipso.themes) {
      var theme = calipso.themes[themeName];
      console.log(" - " + theme.name.white.bold + " @ " + theme.about.version + " [".grey +  theme.about.type.green + "]".grey);
    }
    console.log("");
  }

  // Else return it
  next(null);

}

/**
 * Uninstall a theme
 * TODO This is quite brutal (rm -rf).
 */
function uninstallTheme(options,cli,next) {

  // Get the module name
  var themeName = options[1];
  if(!themeName) {
    next(new Error("You must specify a module name (@version is ignored)."));
    return;
  }
  if(themeName === calipso.defaultTheme) {
    next(new Error("You cannot delete the default theme."));
    return;
  }

  // Locate the theme
  var installedTheme = calipso.themes[themeName];
  var installed = installedTheme ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if(installed) {

    // This can't be messed with, as it is populated based on pre-existing path type/name.
    var path = installedTheme.path;

    confirm('This will remove the theme completely from the site and cannot be undone, continue? '.red.bold, function(ok){
      if (ok) {
        process.stdin.destroy();
        console.log("Removing " + installedTheme.name.green.bold + ", please wait ...");
        exec('rm -rf ' + path, { timeout: 5000, cwd:__dirname }, function (error, stdout, stderr) {

          var err = ((error ? error.message : '') || stderr);

          if(!err) {
             console.log(stdout + "Theme " + installedTheme.name.green.bold + " uninstalled completely.");
             next();
          } else {
            next(new Error(err));
          }
        });

      } else {
        next();
      }
    });

  } else {

    console.log("Theme " + themeName.green.bold + " is not installed.");
    next();

  }

}


/**
 * Prompt confirmation with the given `msg`.
 *
 * @param {String} msg
 * @param {Function} fn
 */

function confirm(msg, fn) {
  prompt(msg, function(val){
    fn(/^ *y(es)?/i.test(val));
  });
}

/**
 * Prompt input with the given `msg` and callback `fn`.
 *
 * @param {String} msg
 * @param {Function} fn
 */

function prompt(msg, fn) {
  // prompt
  if (' ' == msg[msg.length - 1]) {
    process.stdout.write(msg);
  } else {
    console.log(msg);
  }

  // stdin
  process.stdin.setEncoding('ascii');
  process.stdin.once('data', function(data){
    fn(data);
  }).resume();
}
