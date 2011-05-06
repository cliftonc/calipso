/**
 * Calipso, a NodeJS CMS
 *  
 * This file is the core application launcher.  See app-cluster for visibility 
 * of how the application should be run in production mode
 *  
 * Usage:  node app, or NODE_ENV=production node app
 *  
 */
var fs = require('fs'),
    express = require('express'),
    mongoose = require('mongoose'),
    sys = require('sys'),
    nodepath = require('path'),
    form = require('connect-form'),
    stylus = require('stylus'),
    calipso = require('./lib/calipso'),
    mongoStore = require('./support/connect-mongodb');

/**
 * Global variables
 */
var path = __dirname;
var theme = 'default';
var port = 3000;
var app;

/**
 * Initial bootstrapping
 */
exports.boot = function(next) {
  
  //Create our express instance
  app = express.createServer();
  app.path = path;
  
  // Import configuration
  require(path + '/conf/configuration.js')(app, express, function(err){
    
    if(err) {
      console.log("There was a fatal error attempting to load the configuration, application will terminate.");
    }
    
    // Load application configuration
    theme = app.set('config').theme;
    
    // Bootstrap application
    bootApplication(app);
    
    next(app);
    
  });
  
};

/**
 *  App settings and middleware
 *  Any of these can be added into the by environment configuration files to
 *  enable modification by env.
 */
function bootApplication(app) {
  
  // launch
  // app.use(express.profiler());s
  // app.use(express.bodyParser());

  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.responseTime());
  app.use(express.session({ secret: 'calipso', store: mongoStore({ url: app.set('db-uri') }) }));
  
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
   
  // connect-form
  app.use(form({
    keepExtensions: true
  }));

  // Media paths
  app.use(express.static(path + '/media'));

  // Theme assets
  app.use(express.static(path + '/themes/' + theme + '/public'));

  // Core calipso router
  app.use(calipso.calipsoRouter(app, app.set('config')));
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
    console.log("\x1b[36mCalipso server listening on port: \x1b[0m %d\r\n", app.address().port)
    
  });
  
}