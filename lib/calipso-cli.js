/**
 * Calipso command prompt
 * @Params - cmd - server | script | params
 */

/**
 * Dependencies on this script
 */
var fs = require('fs'),
  os = require('os'),
  nodepath = require('path'),
  exec = require('child_process').exec,
  logo = require('../logo'),
  colors = require('colors'),
  calipso = require('./calipso'),
  cluster = null;
try {
  cluster = require('cluster');
}
catch (e) {
}

/**
 * Optimist configuration
 */
var argv = require('optimist')
  .default('src', false)
  .default('port', 3000)
  .alias('p', 'port')
  .alias('s', 'src')
  .boolean('s')
  .argv;

/**
 * Paths
 * path = directory script being run from
 * calipsoPath = calipso library installation path
 **/
var path = fs.realpathSync('.');
var calipsoPath = __dirname + "/../";

//require.paths.unshift(calipsoPath); //make local paths accessible

var step = require('step');

/**
 * Main Command Object
 * Defaults to display the help script
 */
var appLauncher = {
  command:argv._[0] ? argv._[0] : 'help',
  server:{ port:argv.port },
  src:argv.src,
  script:{
    name:'help',
    params:argv._.splice(1)
  }
};

runLauncher(appLauncher);

/**
 * Run the launcher
 * @param appLauncher
 */
function runLauncher(appLauncher) {
  if (cluster && cluster.isMaster) {
    // Always use current directory?
    console.log('Launching calipso from: '.cyan.bold + path.white);
    console.log('Calipso directory: '.cyan.bold + calipsoPath.white);

    // Check if this is a calipso src folder
    if (isLibrary() && !appLauncher.src) {
      console.log('\r\nWARNING:'.yellow.bold + ' You are running this from a Calipso source folder.'.white.bold);
    }

    // Check if this is a calipso site
    if (!isCalipso() && appLauncher.command != 'site' && !isLibrary()) {
      console.log('\x1b[1mThis is not a Calipso site - you must run:\x1b[0m calipso site SiteName\r\n');
      return;
    }
  }
  switch (appLauncher.command) {
    case 'test':
      runTests(appLauncher.script);
      break;
    case 'server':
      runServer(appLauncher.server.port);
      break;
    case 'cluster':
      runCluster(appLauncher.server.port);
      break;
    case 'site':
      createApplication(path, appLauncher.script.params);
      break;
    case 'install':
      runInstall(path);
      break;
    case 'modules':
      process.chdir(path);
      //require.paths.unshift(path); //make local paths accessible
      var app = require(path + '/app');
      app.boot(false, function (app) {
        var modules = require('./cli/Modules');
        modules.moduleRouter(path, appLauncher.script.params, true, function (err) {
          if (err) {
            console.log("\r\n" + err.message.red.bold + "\r\n");
          }
          process.exit();
        });
      });
      break;
    case 'themes':
      process.chdir(path);
      //require.paths.unshift(path); //make local paths accessible
      var app = require(path + '/app');
      app.boot(false, function (app) {
        var themes = require('./cli/Themes');
        themes.themeRouter(path, appLauncher.script.params, true, function (err) {
          if (err) {
            console.log("\r\n" + err.message.red.bold + "\r\n");
          }
          process.exit();
        });
      });
      break;
    default:
      // Default is to display help
      appLauncher.command = 'script';
      runScript(appLauncher.script);
  }

}

/**
 * Check if we are running from the library folder (or something cloned out of github)
 **/
function isLibrary() {
  return (fs.existsSync || nodepath.existsSync)(path + '/bin/calipso');
}

/**
 * Check if .calipso exists
 **/
function isCalipso() {
  return (fs.existsSync || nodepath.existsSync)(path + '/.calipso');
}

/**
 * Run a script
 * @param appLauncher
 * Runs by default from path where calipso runs via __dirname.
 */
function runScript(scriptLauncher) {

  if (!(fs.existsSync || nodepath.existsSync)(path + '/scripts/' + scriptLauncher.name)
  && !(fs.existsSync || nodepath.existsSync)(calipsoPath + '/scripts/' + scriptLauncher.name)) {
    scriptLauncher.name = 'help';
    scriptLauncher.params = [];
  }

  var script;
  try {
    script = require(path + '/scripts/' + scriptLauncher.name);
  }
  catch (e) {
    script = require(calipsoPath + '/scripts/' + scriptLauncher.name);
  }
  logo.print();
  script.execute(scriptLauncher.params, path);


}

/**
 * Run expresso tests
 */
function runTests(appLauncher) {

  // var test = appLauncher.name ? appLauncher.name : 'all';
  exec('make', { timeout:60000, cwd:path }, function (error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
  });

}

function runCluster(port) {

  // Ensure we run in the local folder of the application
  process.chdir(path);
  require(path + '/app-cluster').launchServer(port);
}

/**
 * Launch a server
 */
function runServer(port) {

  logo.print();

  // Ensure we run in the local folder of the application
  process.chdir(path);
  require(path + '/app').boot(false, function (app) {

    if (app) {
      var out = app.listen(port, function () {
        console.log("Calipso version: ".green + app.about.version);
        console.log("Calipso configured for: ".green + (global.process.env.NODE_ENV || 'development') + " environment.".green);
        if (app.address) {
          console.log("Calipso server listening on port: ".green + app.address().port);
        }
        else {
          console.log("Calipso server listening on port: ".green + port);
        }
      });
      process.nextTick(function () {
        if (out && out.address && out.address().port !== port) {
          console.log("Calipso server listening on port: ".red + out.address().port);
        }
      });
    } else {
      console.log("\r\nCalipso terminated ...\r\n".grey);
      process.exit();
    }

  });

}

/**
 * Create application at the given directory `path`.
 *
 * @param {String} path
 */
function createApplicationAt(path) {
  var self = this;

  var items = [
    {dest:path + '/bin', source:calipsoPath + '/bin/*.sh'},
    {dest:path + '/conf', source:calipsoPath + '/conf/*'},
    {dest:path + '/i18n', source:calipsoPath + '/i18n/*'},
    {dest:path + '/lib/conf', source:calipsoPath + '/lib/conf/*'},
    {dest:path + '/lib/calipso.js', source:calipsoPath + '/lib/calipso-proxy.js', file:true},
    {dest:path + '/modules/download'},
    {dest:path + '/modules/private'},
    {dest:path + '/themes/core', source:calipsoPath + '/themes/core/*'},
    {dest:path + '/themes/download'},
    {dest:path + '/themes/private'},
    {dest:path + '/scripts', source:calipsoPath + '/scripts/*'},
    {dest:path + '/logs'},
    {dest:path + '/pids'},
    {dest:path + '/media'},
    {dest:path + '/tmp'},
    {dest:path + '/utils/googleTranslate.js', source:calipsoPath + '/utils/googleTranslate.js', file:true},
    {dest:path + '/app-cluster.js', source:calipsoPath + '/app-cluster-proxy.js', file:true},
    {dest:path + '/app.js', source:calipsoPath + '/app-proxy.js', file:true}
  ];

  function digest(err) {
    if (err) {
      console.log(err);
      return;
    }
    var item = items.splice(0, 1)[0];
    if (!item) {
      json = require(calipsoPath + '/package.json');
      var vers = json['version'].split('.');
      vers[vers.length - 1] = 'x';
      json.dependencies = {calipso: vers.join('.')};
      json['version'] = '1.0.0';
      json['name'] = nodepath.basename(path);
      delete json['homepage'];
      delete json['repository'];
      delete json['subdomain'];
      delete json['domains'];
      fs.writeFile(path + '/package.json', JSON.stringify(json, null, 2), function (err) {
        if (err) {
          console.log(err);
          return;
        }
        write(path + '/.calipso', 'Created @ ' + new Date());
        console.log('');
        console.log('Application created at: '.green + path.white.bold);
        // CC : Disabled to test default NPM installation process
        console.log('Installing any difficult application dependencies via NPM, please wait ... '.green);
        runInstall(path);
      });
      return;
    }
    if (item.source) {
      copy(item.source, item.dest, item.file || false, function (err) {
        if (err) {
          console.log(err);
          return;
        }
        digest();
      });
    } else if (!item.file) {
      mkdir(item.dest, function (err) {
        if (err) {
          console.log(err);
          return;
        }
        digest();
      });
    } else {
      digest();
    }
  }

  digest();
}

/**
 * Run the install shell script
 */
function runInstall(path) {
  function done(error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
  }

  if (os.type().match(/Windows.*/)) {
    exec('npm install --mongodb:native', { maxBuffer:200 * 1024 }, done);
  } else {
    exec('./bin/siteInstall.sh', { timeout:60000, cwd:path }, done);
  }
}

/**
 * Create a site
 */
function createApplication(path, siteName) {

  var site;
  if (siteName.toString().match(/^\//)) {
    // site is a full path
    site = siteName.toString();
  } else {
    site = path + "/" + siteName;
  }

  mkdir(site, function () {
    emptyDirectory(site, function (empty) {
      if (empty) {
        createApplicationAt(site);
      } else {
        confirm('This will over-write the existing site, continue? '.red.bold, function (ok) {
          if (ok) {
            process.stdin.destroy();
            createApplicationAt(site);
          } else {
            abort('aborting');
          }
        });
      }
    });
  });
};

/**
 * Check if the given directory `path` is empty.
 *
 * @param {String} path
 * @param {Function} fn
 */
function emptyDirectory(path, fn) {
  fs.readdir(path, function (err, files) {
    if (err && 'ENOENT' != err.code) {
      throw err;
    }
    fn(!files || !files.length);
  });
}

/**
 * echo str > path.
 *
 * @param {String} path
 * @param {String} str
 */

function write(path, str) {
  fs.writeFile(path, str);
  console.log('   create : '.blue + path.white);
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

/**
 * Mkdir -p.
 *
 * TODO - these are unix only ...
 *
 * @param {String} path
 * @param {Function} fn
 */

function mkdir(path, fn) {
  if (os.type().match(/Windows.*/)) {
    if ((fs.existsSync || nodepath.existsSync)(path)) {
      fn && fn();
    }
    else {
      exec('mkdir "' + path + '"', { maxBuffer:200 * 1024 }, function (err) {
        if (err) {
          throw err;
        }
        console.log('   create: '.blue + path.white);
        fn && fn();
      });
    }
  } else {
    exec('mkdir -p ' + path, function (err) {
      if (err) {
        throw err;
      }
      console.log('   create: '.blue + path.white);
      fn && fn();
    });
  }
}


/**
 * cp -r
 *
 * @param {String} path
 * @param {Function} fn
 */

function copy(from, to, isFile, fn) {
  if (os.type().match(/Windows.*/)) {
    from = from.replace(/\//g, '\\').replace(/\\\\/g, '\\');
    to = to.replace(/\//g, '\\').replace(/\\\\/g, '\\');
    if (isFile) {
      var dir = nodepath.dirname(to);
      console.log('Creating as dir: ' + dir);
      if (!(fs.existsSync || nodepath.existsSync)(dir)) {
        mkdir(dir, copyMeWin);
      } else {
        copyMeWin();
      }
    } else {
      mkdir(to, copyMeWin);
    }
    function copyMeWin(err) {
      if (err) {
        throw err;
      }
      exec((isFile ? 'copy "' : 'xcopy /E /I /Q /Y "') + from + '" "' + to + '"', { maxBuffer:200 * 1024 }, function (err) {
        if (err) {
          throw err;
        }
        console.log('   Copied: '.blue + to.white);
        fn && fn();
      });
    }
  } else {
    if (isFile) {
      var dir = nodepath.dirname(to);
      console.log('Creating as dir: ' + dir);
      if (!(fs.existsSync || nodepath.existsSync)(dir)) {
        console.log('mkdir ' + dir);
        mkdir(dir, copyMe);
      } else {
        copyMe();
      }
    } else {
      mkdir(to, copyMe);
    }
    function copyMe() {
      console.log('cp ' + (isFile ? '' : '-R ') + from + ' ' + to);
      exec('cp ' + (isFile ? '' : '-R ') + from + ' ' + to, function (err) {
        if (err) {
          throw err;
        }
        console.log('   Copied: '.blue + to.white);
        fn && fn();
      });
    }
  }
}

/**
 * Exit with the given `str`.
 *
 * @param {String} str
 */

function abort(str) {
  console.error(str);
  process.exit(1);
}
