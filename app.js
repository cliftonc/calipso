/**
 * Module dependencies.
 */
var fs = require('fs'),express = require('express'),
	 mongoose = require('mongoose'), sys = require('sys'), nodepath = require('path'),
	 ncms = require('./lib/ncms'), profiler = require('v8-profiler');

/** 
 * Global variables
 */
var path = __dirname;
var theme = 'default';
var app;

/**
 * Initial bootstrapping
 */
exports.boot = function(next) {
	
  //Create our express instance
  app = express.createServer();	
  app.path = path;
  
   // Import configuration
  require(path + '/conf/configuration.js')(app,express,function(){    
    
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
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'helloworld' }));
  app.use(express.static(path + '/themes/' + theme + '/public'));  // Before router to enable dynamic routing
  app.use(ncms.ncmsRouter(app,app.set('config')));

  // Setup ejs views as default, with .html as the extension      
  app.set('views', path + '/themes/' + theme);
  app.register('.html', require('ejs'));
  app.set('view engine', 'html');

  // Some dynamic view helpers
  app.dynamicHelpers({
  
	request: function(req){
	   return req;
	},	 
  user: function(req){
     return req.session.user;
  },
	showDebug: function(req,res){
	  return "Raw: \r\n\r\n" + sys.inspect(res.blocks,false,10,false) + "\r\n\r\nRendered:\r\n\r\n" + sys.inspect(res.renderedBlocks,false,10,false);
	},
	hasMessages: function(req){
      return Object.keys(req.session.flash || {}).length;
    },

    messages: function(req){
      return function(){
        var msgs = req.flash();
        return Object.keys(msgs).reduce(function(arr, type){
          return arr.concat(msgs[type]);
        }, []);        
      }
    }
  });
}

//Bootstrap models 
function bootModules(app) {
	
  fs.readdir(path + '/modules', function(err, files){
    if (err) throw err;
    files.forEach(function(file){
    	bootModule(app, file);
    });
  });
    
}

// simplistic model support
function bootModule(app, file) {

    var name = file.replace('.js', ''),
    	  schema = require(path + '/modules/'+ name);				// Include the mongoose file        
    
}

// allow normal node loading if appropriate
if (!module.parent) {
  exports.boot(function(app) {
    app.listen(3000);
    console.log("Express server %s listening on port %d", express.version, app.address().port)
  });  
}

