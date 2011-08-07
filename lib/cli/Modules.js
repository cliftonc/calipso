/*!
 * Calipso Module Management Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Core library that controls the installation and management of modules.
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
 * Module router - takes params from CLI and passes to appropriate function
 * Controls return based on CLI mode or web mode
 */
exports.moduleRouter = function(path,options,cli,next) {

  switch(options[0]) {
    case 'list':
      listModules(options,cli,next);
      break;
    case 'check':
      checkAll(options,cli,next);
      break;
    case 'reinstall':
      installModule(options,cli,next);
      break;
    case 'uninstall':
      uninstallModule(options,cli,next);
      break;
    case 'enable':
      toggleModule(true,options,cli,next);
      break;
    case 'disable':
      toggleModule(false,options,cli,next);
      break;
    case 'download': // Default is github
      var toPath = calipso.app.path + "/modules/downloaded/";
      var fromUrl = options[1];
      download('module',fromUrl,toPath,cli,function(err,moduleName,path) {
          if(err) {
            next(err);
          } else {
            installViaNpm(moduleName,path,next);
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
function listModules(options,cli,next) {

  // Command line
  if(cli) {
    var currentType = "";
    for(var moduleName in calipso.modules) {
      var module = calipso.modules[moduleName];
      if(module.type != currentType) {
        console.log("\r\n" + module.type.green.bold);
        currentType = module.type;
      }
      console.log(" - " + module.name.white.bold + " @ " + module.about.version + " [".grey + (module.enabled ? "Enabled".green : "Disabled".grey) + "]".grey);
    }
  }

  // Else return it
  next(null,calipso.modules);

}

/**
 * Enable or disable a module
 */
function toggleModule(enabled,options,cli,next) {

  // Get the module name
  var moduleName = options[1];
  if(!moduleName) {
    next(new Error("You must specify a module name."));
  }

  // Split module / version
  var moduleVersion = moduleName.split('@')[1] || "";
  var moduleName = moduleName.split('@')[0];

  // Locate the module
  var installedModule = calipso.modules[moduleName];
  var installed = installedModule ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if(installed) {

    // Re-retrieve our object
    var AppConfig = calipso.lib.mongoose.model('AppConfig');
    AppConfig.findOne({}, function(err, c) {

        // Updates to mongo
        var modules = [];
        c.modules.forEach(function(value,key) {
            if(value.name === moduleName) {
              value.enabled = enabled;
            }
            modules.push(value);
        });
        c.modules = modules;

        c.save(function(err) {
            if (err) {
              next(new Error("You must specify a module name."));
            } else {
              console.log("Module " + moduleName.green.bold + " is now " + (enabled ? "enabled".green.bold : "disabled".red.bold) + ".");
              next();
            }
        });

    });

  } else {

    console.log("Module " + moduleName.green.bold + " is not installed.".red.bold);
    next();

  }

}

/**
 * Show the list of currently installed modules - highlight those with issues / updates?
 * options:  ['install',<module@version>,<force>]
 */
function installModule(options,cli,next) {

  // Get the module name
  var moduleName = options[1];
  if(!moduleName) {
    next(new Error("You must specify a module name (and optional @version)."));
  }

  // Split module / version
  var moduleVersion = moduleName.split('@')[1] || "";
  var moduleName = moduleName.split('@')[0];

  // Locate the module
  var installedModule = calipso.modules[moduleName];
  var installed = installedModule ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if(installed) {

    // If we have a version, check to see if this is an upgrade or downgrade
    if(moduleVersion) {
      if(semver.lt(moduleVersion,installedModule.about.version)) {
        // TODO
      }
    }

    var path = __dirname + "/../modules/" + installedModule.type + "/" + installedModule.name;
    installViaNpm(moduleName,path,next);

  } else {

    // Find the module

    next();

  }

}

/**
 * Install a module via npm
 */
function installViaNpm(moduleName,path,next) {

  console.log("Installing " + moduleName.green.bold + " via npm, output will show below (may be a small delay):");
  exec('npm install', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {

    var err = ((error ? error.message : '') || stderr);

    if(!err) {
      exec('npm list', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {

         console.log("");
         console.log(stdout + "\r\nModule " + moduleName.green.bold + " installed with all dependencies met.");
         next();

      });
    } else {
      console.log("Module ".green.bold + moduleName + " install had additional detail, please check for any errors:".green.bold);
      next("Module " + moduleName + " install had additional detail, please check for any errors: \r\n" + err.message);
    }
  });

}

/**
 * Uninstall a module
 * TODO This is quite brutal (rm -rf).
 */
function uninstallModule(options,cli,next) {

  // Get the module name
  var moduleName = options[1];
  if(!moduleName) {
    next(new Error("You must specify a module name (@version is ignored)."));
    return;
  }

  // Split module / version
  var moduleVersion = moduleName.split('@')[1] || "";
  var moduleName = moduleName.split('@')[0];

  // Locate the module
  var installedModule = calipso.modules[moduleName];
  var installed = installedModule ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if(installed) {

    if(installedModule.type === "core") {
      next(new Error("You should not delete core modules unless you really know what you are doing!"));
      return;
    }

    // This can't be messed with, as it is populated based on pre-existing path type/name.
    var path = __dirname + "/../modules/" + installedModule.type + "/" + installedModule.name;

    confirm('This will remove the module completely from the site and cannot be undone, continue? '.red.bold, function(ok){
      if (ok) {
        process.stdin.destroy();
        console.log("Removing " + installedModule.name.green.bold + ", please wait ...");
        exec('rm -rf ' + path, { timeout: 5000, cwd:__dirname }, function (error, stdout, stderr) {

          var err = ((error ? error.message : '') || stderr);

          if(!err) {
             console.log(stdout + "Module " + installedModule.name.green.bold + " uninstalled completely.");
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

    console.log("Module " + moduleName.green.bold + " is not installed.");
    next();

  }

}

/**
 * Run through all installed modules (enabled or not), and install dependencies
 */
function checkAll(options,cli,next) {

  calipso.lib.step(
    function validateInstall() {
       this();
    },
    function validateInstalledModules() {
      var group = this.group();
      for(var moduleName in calipso.modules) {
        var options = [];
        options.push('install');
        options.push(moduleName);
        options.push(true);
        installModule(options,cli,group());
      }
    },
    function done(err) {
      console.log("");
      if(err) {
        console.log("All modules processed, but there were errors,please check output above for status.".red.bold);
      } else {
        console.log("All modules processed with no apparent errors, please check output above to confirm.".green.bold);
      }
      next(err);
    }
   )
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
