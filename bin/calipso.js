#!/usr/bin/env node

/**
 * Calipso command prompt
 * @Params - cmd - server | script | params
 */

/**
* Dependencies on this script
*/
var fs = require('fs'), 
    nodepath = require('path'), 
    exec = require('child_process').exec,
    colors = require('colors');
    
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
require.paths.unshift(path); //make local paths accessible

var step = require('support/step')
    modules = require('lib/Modules');

/**
 * Main Command Object
 * Defaults to display the help script
 */
var appLauncher = {
      command:argv._[0] ? argv._[0] : 'help',
      server: { port:argv.port },
      src:argv.src,
      script: {
        name:'help',
        params: argv._.splice(1)
      }
    };
    
runLauncher(appLauncher);

/**
 * Run the launcher
 * @param appLauncher
 */
function runLauncher(appLauncher) {
  
  // Always use current directory?
  console.log('Launching calipso from: '.cyan.bold + path.white);
  console.log('Calipso directory: '.cyan.bold + calipsoPath.white);  
  
  // Check if this is a calipso src folder
  if(isLibrary() && !appLauncher.src) {
    console.log('\x1b[1mTo run this from the src folder, you need to add an "-s true" parameter, or please run from an empty directory or an installed calipso site\x1b[0m\r\n');
    return;
  }

  // Check if this is a calipso site
  if(!isCalipso() && appLauncher.command != 'create-site' && !appLauncher.src) {
    console.log('\x1b[1mThis is not a Calipso site - you must run:\x1b[0m calipso create-site SiteName\r\n');
    return;
  }

  switch(appLauncher.command) {
    case 'test':
      runTests(appLauncher.script);
      break;
    case 'server':
      runServer(appLauncher.server.port);
      break;
    case 'site':
      createApplication(path,appLauncher.script.params);
      break;
    case 'install':
      runInstall(path);
      break;
    case 'modules':      
      require(path + '/app').boot(function(app) {
          modules.moduleRouter(path,appLauncher.script.params,true,function(err) {              
              console.log("");
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
  return nodepath.existsSync(path + '/bin/calipso');
}

/**
 * Check if .calipso exists
 **/
function isCalipso() {
  return nodepath.existsSync(path + '/.calipso');
}

/**
 * Run a script
 * @param appLauncher
 * Runs by default from path where calipso runs via __dirname.
 */
function runScript(scriptLauncher) {
  var script = require(path + '/scripts/'+ scriptLauncher.name);
  printAscii();
  script.execute(scriptLauncher.params,path);
}

/**
 * Run expresso tests
 */
function runTests(appLauncher) {

  // var test = appLauncher.name ? appLauncher.name : 'all';
  exec('expresso -I lib -s tests/* ', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
  });

}

/** 
 * Show ascii art
 */
 
 function printAscii() {
   
  console.log("");
  console.log("            _ _                    ".blue.bold);
  console.log("  ___  __ _| (_)_ __  ___  ___     ".blue.bold);
  console.log(" / __|/ _` | | | '_ \\/ __|/ _ \\  ".blue.bold);
  console.log("| (__| (_| | | | |_) \\__ \\ (_) | ".green.bold);
  console.log(" \\___|\\__,_|_|_| .__/|___/\\___/ ".green.bold);
  console.log("               |_|                 ".green.bold);
  console.log("");

 }

/**
 * Launch a server
 */
function runServer(port) {

  printAscii();
  
  // Ensure we run in the local folder of the application
  process.chdir(path);
  require(path + '/app').boot(function(app) {
    app.listen(port);
    console.log("Calipso server listening on port: ".green + app.address().port.toString().white.bold);
    console.log("Calipso configured for ".green + (global.process.env.NODE_ENV || 'development').white.bold + " environment\r\n".green);
  });

}

/**
 * Create application at the given directory `path`.
 *
 * @param {String} path
 */
function createApplicationAt(path) {

  step(
    function create() {
      var self = this;            
      
      mkdir(path + '/bin',function() {
        copy(calipsoPath + '/bin/install.sh',path + '/bin',self.parallel());
      });
      mkdir(path + '/conf',function() {
        copy(calipsoPath + '/conf/*',path + '/conf',self.parallel());
      });
      mkdir(path + '/i18n',function() {
        copy(calipsoPath + '/i18n/*',path + '/i18n',self.parallel());
      });
      mkdir(path + '/lib',function() {
        copy(calipsoPath + '/lib/*',path + '/lib',self.parallel());
      });      
      mkdir(path + '/modules',function() {
        copy(calipsoPath + '/modules/*',path + '/modules',self.parallel());
      });
      mkdir(path + '/support',function() {
        copy(calipsoPath + '/support/*',path + '/support',self.parallel());
      });
      mkdir(path + '/test',function() {
        copy(calipsoPath + '/test/*',path + '/test',self.parallel());
      });
      mkdir(path + '/themes',function() {
        copy(calipsoPath + '/themes/*',path + '/themes',self.parallel());
      });
      mkdir(path + '/utils',function() {
        copy(calipsoPath + '/utils/*',path + '/utils',self.parallel());
      });
      mkdir(path + '/logs',self.parallel());
      mkdir(path + '/pids',self.parallel());
      mkdir(path + '/media',self.parallel());
      copy(calipsoPath + '/app-cluster.js',path + '/',self.parallel());
      copy(calipsoPath + '/app.js',path + '/',self.parallel());
      copy(calipsoPath + '/package.json',path + '/',self.parallel());
      copy(calipsoPath + '/Makefile',path + '/',self.parallel());      
    },
    function done() {
      write(path + '/.calipso','Created @ ' + new Date());      
      console.log('');
      console.log('Application created at: '.green + path.white.bold);
      console.log('Running install script, please wait ... '.green);
      runInstall(path)
    }
  )
  
}

/**
 * Run the install shell script 
 */
function runInstall(path) {
  
  exec('./bin/install.sh', { timeout: 60000, cwd:path }, function (error, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
  });

}

/**
 * Create a site
 */
function createApplication(path,siteName) {  
  var site = path + "/" + siteName;
  mkdir(site,function() {
    emptyDirectory(site, function(empty){
      if (empty) {
        createApplicationAt(site);
      } else {
        confirm('This will over-write the existing site, continue? '.red.bold, function(ok){
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
  fs.readdir(path, function(err, files){
    if (err && 'ENOENT' != err.code) throw err;
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

/**
 * Mkdir -p.
 *
 * @param {String} path
 * @param {Function} fn
 */

function mkdir(path, fn) {
  exec('mkdir -p ' + path, function(err){
    if (err) throw err;
    console.log('   create: '.blue + path.white);
    fn && fn();
  });
}


/**
 * cp -r
 *
 * @param {String} path
 * @param {Function} fn
 */

function copy(from, to, fn) {
  exec('cp -R ' + from + ' ' + to, function(err){
    if (err) throw err;
    console.log('   Copied: '.blue + to.white);
    fn && fn();
  });
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
