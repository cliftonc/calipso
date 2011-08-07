/*!
 * Calipso Core Library
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
    semver = require('semver');

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
      downloadModule(options,cli,next);
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
 * Download a module from a url
 * This is called by install
 */
function downloadModule(options,cli,next) {

  // Create a common file process function
  var localNext = function(err,path) {
    if(err) {
      next(err);
    } else {
      processDownload(path,next);
    }
  }

  // Split module / version
  var path = options[1];

  if(path.match(/^http.*/)) {
    downloadUrlModule(options,cli,localNext);
    return;
  }

  if(path.match(/^(.*)\/(.*)$/)) {
    downloadGithubModule(options,cli,localNext);
    return;
  }

  // Otherwise assume repo
  // NOT YET IMPLEMENTED
  next(new Error("Download via repository not yet implemented, use github project (cliftonc/calipso-elastic) or a full URL."));

}

/**
 * Download a module from github
 * This is called by install
 */
function downloadGithubModule(options,cli,next) {

  // Split module / version
  var githubName = options[1];

  if(githubName) {

    var tag = githubName.split('@')[1] || "";
    var githubName = githubName.split('@')[0];
    var moduleName = githubName.replace("/","-");

    if(githubName.split("/").length !== 2) {
       next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
       return;
    }

    var url = constructGithubUrl(githubName,tag);

    if(url) {
      downloadfile(url,moduleName,next);
    } else {
      next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
    }

  } else {
    next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
  }

}

/**
 * Download a module from a url
 * This is called by install
 */
function downloadUrlModule(options,cli,next) {

  // Split module / version
  var url = options[1], path = require('path');

  if(url) {

     var u = require('url'), fs = require('fs');
     var parts = u.parse(url);
     var tmpName = path.basename(parts.pathname);

     if(tmpName && tmpName.match(/.zip$/)) {
        downloadfile(url,tmpName,next);
     } else {
       next(new Error('You need to provide a valid url to your module zip file, e.g. http://cliftoncunningham.co.uk/module.zip'));
     }
  } else {
    next(new Error('You need to provide a valid url to your module zip file, e.g. http://cliftoncunningham.co.uk/module.zip'));
  }

}


function downloadfile(url,fileName,next) {

  var u = require('url'), fs = require('fs'), path = require('path');
  var parts = u.parse(url);

  // Ensure we have our download folder
  var tmpFolder = __dirname + '/../modules/downloaded/';
  if(!path.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, 0755);
  }

  if(parts.protocol === 'https:') {
    client = require('https');
  } else {
    client = require('http');
    if(!parts.port) {
      parts.port = 80;
    }
  }

  console.log("Downloading file:".cyan);
  client.get({ host: parts.hostname, port: parts.port, path: parts.pathname }, function(res) {

      if(res.statusCode === 302) {
        console.log("Redirecting to ".grey + res.headers.location.grey + " ...".grey);
        downloadfile(res.headers.location,fileName,next);
        return;
      }

      if(res.statusCode === 200) {

        var tmpFile = tmpFolder + fileName + '.zip';
        var fd = fs.openSync(tmpFile, 'w');
        var size = 0;
        var totalSize = parseInt(res.headers['content-length']);
        var progress = 0;

        res.on('data', function (chunk) {
          size += chunk.length;
          progress = showProgress(size,totalSize,progress);
          fs.writeSync(fd, chunk, 0, chunk.length, null);
        });

        res.on('end',function(){
            process.stdout.write("\n\n");
            fs.closeSync(fd);
            next(null,tmpFile);
        });

      } else {

        next(new Error("Unable to download file, status was " + res.statusCode));

      }

  });
}

function showProgress(size,totalSize,progress) {

  var newProgress = Math.floor((size / totalSize)*20);
  if(newProgress > progress) {
    for(var i=progress + 1; i <= newProgress; i++) {
      switch(i) {
        case 1:
          process.stdout.write("[".red + "0%".green);
          break;
        case 5:
          process.stdout.write("25%".green);
          break;
        case 10:
          process.stdout.write("50%".green);
          break;
        case 15:
          process.stdout.write("75%".green);
          break;
        case 20:
          process.stdout.write("100%".green + "]".red);
          break;
        default:
          process.stdout.write(".".blue);
      }
    }
    progress = newProgress;
  }
  return progress;

}

/**
 * Create a github url
 */
function constructGithubUrl(userProject,tag) {

  var url = "";
  if(tag) {
    url = "https://github.com/" + userProject + "/zipball/" + tag;
  } else {
    url = "https://github.com/" + userProject + "/zipball/master";
  }
  return url;

}

/**
 * Process a downloaded module, place into modules folder
 */

function processDownload(path,next) {

  // First of all, check that the file looks ok
  validateDownload(path,function(err,moduleName,tmpFolder) {
      if(err) {
        next(err);
      } else {
        // Now, we have our module, and its in the download folder
        installViaNpm(moduleName,tmpFolder,next);
      }
  });

}

/**
 * Process a downloaded module, place into modules folder
 */

function validateDownload(path,next) {

  // Checks
  var isValid;

  // #1 - Is it a zip?
  isValid = path.match(/.zip$/);

  // #2 - unzip it, check contents
  if(isValid) {
    unzipDownload(path,next);
  } else {
    next(new Error("The file downloaded must be a valid zip archive."));
  }

}

/**
 * Process a downloaded module, place into modules folder
 */

function unzipDownload(file,next) {

  var zip = require('zipfile'),
    fs = require('fs'),
    rimraf = require('rimraf'),
    path = require('path');

  var zf = new zip.ZipFile(file),
      baseFolder,
      tmpFolder,
      moduleName;

  zf.names.forEach(function(name) {

      // First result is the basefolder
      if(!baseFolder) {
        baseFolder = name; // Store
      }

      // Now, lets find the package.json
      if(name === (baseFolder + "package.json")) {
          var buffer = zf.readFileSync(name);
          var packageJson = JSON.parse(buffer);
          moduleName = packageJson.name;
          tmpFolder = path.join(path.dirname(file),moduleName + "/"); // Extraction will go here
      }

  });

  // Check that we have both a module name
  if(moduleName) {

    // Make sure we delete any existing tmp folder
    if(path.existsSync(tmpFolder)) {
      rimraf.sync(tmpFolder);
    }

    // Now unzip
    zf.names.forEach(function(name) {

      var uncompressed = name.replace(baseFolder,tmpFolder);
      var dirname = path.dirname(uncompressed);

      // Try to create the folder
      try {
        fs.mkdirSync(dirname, 0755)
      } catch(ex) {
        if(ex.code === 'EEXIST') {
          // Ignore
        } else {
          next(new Error("Couldn't create folder " + dirname + " because " + ex.message));
          return;
        }
      }

      // Expand any files
      if (path.extname(uncompressed)) {
        try {
          var buffer = zf.readFileSync(name);
          fd = fs.openSync(uncompressed, 'w');
          fs.writeSync(fd, buffer, 0, buffer.length, null);
          fs.closeSync(fd);
        } catch(ex) {
          next(new Error("Couldn't write file " + uncompressed + " because " + ex.message));
          return;
        }
      }

    });

    // Delete the zip file
    fs.unlinkSync(file);

    // Return;
    next(null,moduleName,tmpFolder);

  } else {

    next(new Error("The file does not appear to have a valid package.json that specifies the module name."));

  }

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
  }

  // Split module / version
  var moduleVersion = moduleName.split('@')[1] || "";
  var moduleName = moduleName.split('@')[0];

  // Locate the module
  var installedModule = calipso.modules[moduleName];
  var installed = installedModule ? true : false;

  // Assume that we want to re-install the dependencies via NPM
  if(installed) {

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
