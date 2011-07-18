/**
 * Calipso, a NodeJS CMS
 *
 * This file is the core application launcher.  See app-cluster for visibility
 * of how the application should be run in production mode
 *
 * Usage:  node app, or NODE_ENV=production node app
 *
 */

require.paths.unshift(__dirname); //make local paths accessible

var fs = require('fs'),
    express = require('express'),
    mongoose = require('mongoose'),
    sys = require('sys'),
    nodepath = require('path'),
    form = require('connect-form'),
    stylus = require('stylus'),
    translate = require('i18n/translate'),
    calipso = require('lib/calipso'),
    mongoStore = require('support/connect-mongodb');

// Local App Variables
var path = __dirname;
var theme = 'default';
var port = 3000; // usually only for non-production envs
var dbPort = 27017; // if you are running multiple mongodb instances
var dbBaseName = 'calipso';
var googleAnalyticsKey = 'UA-17607570-#';
var serverUrl = 'http://calip.so';
var disqusName = 'calipsojs';
var app;
var version = "0.1.2";


/**
 * Test the db connection.  db.open is async, so we get the CALIPSO ascii art
 * before we get the error message, but I left it this way to reduce overhead.
 */
(function(){

  var mongodb = require('mongodb'),
    Db = mongodb.Db,
    Connection = mongodb.Connection,
    Server = mongodb.Server;

  var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
  var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

  //sys.puts(">> Connecting to " + host + ":" + port);
  var db = new Db('node-mongo-examples', new Server(host, port, {}), {native_parser:true});
  db.open(function(err, db) {
    if(err){
      console.log("Error connecting to mongodb - maybe it's not running?");
    } else {
      //console.log("Connected to mongodb.");
      db.close();
    }
  });

})();

/**
 * Catch All exception handler
 */
process.on('uncaughtException', function (err) {
 console.log('Uncaught exception: ' + err + err.stack);
});


/**
 * Initial bootstrapping
 */
exports.boot = function(next) {

  //Create our express instance
  app = express.createServer();
  app.path = path;
  app.version = version;
  app.port = port;
  app.dbBaseName = dbBaseName;
  app.dbPort = dbPort;
  app.googleAnalyticsKey = googleAnalyticsKey;
  app.serverUrl = serverUrl;
  app.disqusName = disqusName;
  
  // Import configuration
  require(path + '/conf/configuration.js')(app, express, function(err){

    if(err) {
      console.log("There was a fatal error attempting to load the configuration, application will terminate.");
    }

    // Load application configuration
    theme = app.set('config').theme;

    // Bootstrap application
    bootApplication(app, function() {
      next(app);
    });

  });

};

/**
 *  App settings and middleware
 *  Any of these can be added into the by environment configuration files to
 *  enable modification by env.
 */
function bootApplication(app, next) {

  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.responseTime());
  app.use(express.session({ secret: 'calipso', store: mongoStore({ url: app.set('db-uri') }) }));

  var publicDir = __dirname + '/themes/' + theme + '/public';
  
  // Stylus
  var stylusMiddleware = stylus.middleware({
    src: __dirname + '/themes/' + theme + '/stylus', // .styl files are located in `views/stylesheets`
    dest: __dirname + '/themes/' + theme + '/public', // .styl resources are compiled `/stylesheets/*.css`
    debug: false,
    compile: function(str, path) { // optional, but recommended
      return stylus(str)
        .set('filename', path)
        .set('warn', true)
        .set('compress', true);
    }
  });

  app.use(stylusMiddleware);
  
  var oneDay = 86400000;
  
  // Static - tag it so we can replace later
  var themeStatic = express.static(path + '/themes/' + theme + '/public',{maxAge:oneDay});  
  themeStatic.tag = 'themeStatic';
  app.use(themeStatic);
  
  // Media paths  
  app.use(express.static(path + '/media',{maxAge:oneDay}));      
  
  // connect-form
  app.use(form({
    keepExtensions: true
  }));
  
  // Translation - after static, set to add mode if appropriate
  app.use(translate.translate(app.set('config').language, app.set('language-add')));

  // Core calipso router
  app.use(calipso.calipsoRouter(app, app.set('config'), function() {
    next();
  }));
  
}

// allow normal node loading if appropriate
if (!module.parent) {

  console.log("");
  console.log("\x1b[36m            _ _                    \x1b[0m");
  console.log("\x1b[36m  ___  __ _| (_)_ __  ___  ___     \x1b[0m");
  console.log("\x1b[36m / __|/ _` | | | '_ \\/ __|/ _ \\  \x1b[0m");
  console.log("\x1b[36m| (__| (_| | | | |_) \\__ \\ (_) | \x1b[0m");
  console.log("\x1b[36m \\___|\\__,_|_|_| .__/|___/\\___/ \x1b[0m");
  console.log("\x1b[36m               |_|                 \x1b[0m");
  console.log("");

  exports.boot(function(app) {

    app.listen(port);
    console.log("\x1b[36mCalipso version: \x1b[0m %s", app.version);
    console.log("\x1b[36mCalipso server listening on port: \x1b[0m %d", app.address().port);
    console.log("\x1b[36mCalipso configured for\x1b[0m %s \x1b[36menvironment\x1b[0m\r\n", global.process.env.NODE_ENV || 'development');

  });

}
