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
var sys;
try {
  sys = require('util');
} catch (e) {
  sys = require('sys');
}
var rootpath = process.cwd() + '/',
  path = require('path')
calipso = require(path.join(rootpath, 'lib/calipso')),
  exec = require('child_process').exec,
  colors = require('colors'),
  semver = require('semver'),
  download = require(rootpath + 'lib/cli/Download');

/**
 * Theme router - takes params from CLI and passes to appropriate function
 * Controls return based on CLI mode or web mode
 */
exports.themeRouter = function (path, options, cli, next) {

  switch (options[0]) {
    case 'list':
      listThemes(options, cli, next);
      break;
    case 'uninstall':
      uninstallTheme(options, cli, next);
      break;
    case 'find':
      findTheme(options, cli, next);
      break;

    case 'install': // Default is github
    case 'download': // Default is github
      downloadTheme(options, cli, next);
      break;

    default:
      next(new Error("You need to specify a valid command, please refer to the help available for valid options."));
  }

}


/**
 *Find module
 */

function findTheme(options, cli, next) {

  var search = options[1]; // Second parameter is our query
  var searchRegex = new RegExp(search, "ig");
  search = search.replace(/\*/g, "");

  var repo = new api();
  repo.find('theme', options, function (err, data) {
    console.log("");
    if (data.length > 0) {
      data.forEach(function (module) {
        var versionString = "";
        module.versions.forEach(function (version) {
          versionString += " - [" + version.version + "] : " + version.url + "\r\n"
        });
        var description = module.description.replace(searchRegex, search.yellow.bold);
        var author = " - [Author] ".cyan + module.author.cyan.bold + "\r\n";
        console.log(module.name.white.bold + "\r\n" + description + "\r\n" + author + versionString.cyan);
      });
      console.log("");
      console.log("To install a theme, use: ".white + "\r\n");
      console.log("  calipso themes download".cyan.bold + " ThemeName".green.bold + " [for latest version]".grey);
      console.log("  calipso themes download".cyan.bold + " repo/project@version".green.bold + " [for specific version]".grey);
      console.log("");
    } else {
      console.log("No modules found that matched your search.".white + "\r\n");
    }
    next();
  });

}
exports.findTheme = findTheme;

/**
 * Try to download a module
 */
function downloadTheme(options, cli, next) {
  var toPath = calipso.app.path() + "/themes/downloaded/";
  var fromUrl = options[1];
  download('theme', fromUrl, toPath, cli, function (err, themeName, path) {
    if (err) {
      next(err);
    } else {
      console.log("Theme ".green + themeName + " was installed successfully.".green);
      next();
    }
  });
}

/**
 * Show the list of currently installed modules - highlight those with issues / updates?
 */
function listThemes(options, cli, next) {

  // Command line
  if (cli) {
    console.log("\r\nInstalled Themes:".green.bold);
    for (var themeName in calipso.availableThemes) {
      var theme = calipso.availableThemes[themeName];
      console.log(" - " + theme.name.white.bold + " @ " + theme.about.version + " [".grey + theme.about.type.green + "]".grey);
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
function uninstallTheme(options, cli, next) {

  // Get the module name
  var themeName = options[1];
  if (!themeName) {
    next(new Error("You must specify a module name (@version is ignored)."));
    return;
  }
  if (themeName === calipso.defaultTheme) {
    next(new Error("You cannot delete the default theme."));
    return;
  }

  // Locate the theme
  var installedTheme = calipso.availableThemes[themeName];
  var installed = installedTheme ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if (installed) {

    // This can't be messed with, as it is populated based on pre-existing path type/name.
    var path = installedTheme.path;

    confirm('This will remove the theme completely from the site and cannot be undone, continue? '.red.bold, function (ok) {
      if (ok) {
        process.stdin.destroy();
        console.log("Removing " + installedTheme.name.green.bold + ", please wait ...");
        exec('rm -rf ' + path, { timeout:5000, cwd:__dirname }, function (error, stdout, stderr) {

          var err = ((error ? error.message : '') || stderr);

          if (!err) {
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
  prompt(msg, function (val) {
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
  process.stdin.once('data',function (data) {
    fn(data);
  }).resume();
}
