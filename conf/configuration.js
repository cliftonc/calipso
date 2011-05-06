var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * Default configuration manager This file controls the loading, and initial
 * configuration of Calipso. Configuration is stored in Mongodb, in the
 * AppConfigs collection, it will always contain a single item (though could
 * contain more for a future multisite type configuration).
 */
module.exports = function(app, express, next) {
  
  var defaultConfig = {
    cache: false,
    theme: 'calipso',
    install: true,
    logs: {
      level: 'info',
      console: { enabled: true },
      file: { enabled: false, filepath: 'logs/calipso.log' }
    },
    modules: [
      { name: 'admin', enabled: true },
      { name: 'content', enabled: true },
      { name: 'contentTypes', enabled: true },
      { name: 'user', enabled: true },
      { name: 'taxonomy', enabled: true }
    ]
  };
  
  /**
   * Mongoose schema for configuration storage
   */
  var AppConfigSchema = new Schema({    
    theme:{type: String, required: true, default:'default'},
    install:{type: Boolean, default:false},
    logs:{
        level:{type: String, required: true, default:'info'},
        console:{enabled:{type:Boolean, default:true}},
        file:{
             enabled:{type:Boolean, default:true},
             filepath:{type: String, required: true, default:'logs/calipso.log'}
        }
   },
   modules:[AppModule]      
  });

  /**
   * Embedded mongoose schema to hold module status within the configuration
   */
  var AppModule = new Schema({
    name: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: false }
  });
  
  mongoose.model('AppConfig', AppConfigSchema);

  /**
	 * Load the development configuration
	 * This is the default if you just run node app.
	 */
	app.configure('development', function() {
	  require("./development.js")(app,express);
	  loadConfig(app,defaultConfig,function(err,config) {	      
	      app.set('config',config);
	      next(err);
	  });
	});

	/**
   * Load the test configuration
   * Launch with NODE_ENV=test node app
   */  
	app.configure('test', function() {
		require("./test.js")(app,express);
		loadConfig(app,defaultConfig,function(err,config) {       
      app.set('config',config);
      next(err);
		});
	});
	
	/**
   * Load the production configuration
   * Launch with NODE_ENV=production node app
   * This is a 'special' node mode that will also reduce debugging and
   * error reporting and increase speed.
   */  
	app.configure('production', function() {
		require("./production.js")(app,express);
		loadConfig(app,defaultConfig,function(err,config) {       
      app.set('config',config);
      next(err);
    });
  });
  
};

/**
 * Load the configuration from the datbase, creating based on the default
 * and setting Calipso into install mode if it doesn't exist.
 * 
 * @param app
 * @param defaultConfig
 * @param next
 */
function loadConfig(app,defaultConfig,next) {
 
  /**
   * Connect to mongoose and get configuration schema
   */
  mongoose.connect(app.set('db-uri'));   
  var AppConfig = mongoose.model('AppConfig');    
  
  /**
   * Locate the configuration, if it doesn't exist create one based on
   * defaults.
   */
  AppConfig.findOne({}, function(err,config) {                      
    if(err) {                    
      next(err);          
    } else {          
      if(config) {            
        next(null,config);            
      } else {              
        var newConfig = new AppConfig(defaultConfig);              
        newConfig.save(function(err) {                
          next(null,newConfig);
          return;
        });            
      }
    }                                      
  }); 
  
}


