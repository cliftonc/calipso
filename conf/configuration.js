var mongoose = require('mongoose'), Schema = mongoose.Schema;
/**
 * Default configuration manager
 * Inject app and express reference
 */

// Placeholder!
module.exports = function(app,express,next) {
		
  var defaultConfig = {
    cache:false,
    theme:'default',
    modules:[{name:'admin',enabled:true},{name:'content',enabled:true},{name:'user',enabled:true}]
  };  
  
  // All environments
  var AppConfigSchema = new Schema({
    cache:{type: Boolean, required: true, default:false},
    theme:{type: String, required: true, default:'default'},
    modules:[AppModule]      
  });

  var AppModule = new Schema({
    name:{type: String, required: true},
    enabled:{type: Boolean, required: true, default:false}         
  });
  
  mongoose.model('AppConfig', AppConfigSchema);    
  
	// DEVELOPMENT
	app.configure('development', function() {
	  require("./development.js")(app,express);
	  loadConfig(app,defaultConfig,function(config) {	      
	      app.set('config',config);
	      next();
	  });
	});

	// TEST
	app.configure('test', function() {
		require("./test.js")(app,express);
		loadConfig(app,defaultConfig,function(config) {       
      app.set('config',config);
      next();
		});
	});
	
	// PRODUCTION
	app.configure('production', function() {
		require("./production.js")(app,express);
		loadConfig(app,defaultConfig,function(config) {       
      app.set('config',config);
      next();
		});
	});		
		 
}

function loadConfig(app,defaultConfig,next) {
 
  // Connect to mongoose
  mongoose.connect(app.set('db-uri'));  
  
  // Load the configuration from the database
  var AppConfig = mongoose.model('AppConfig');    
  
  AppConfig.findOne({}, function(err,config) {    
                  
        if(err) {          
          
          console.log(err);
          next();
          
        } else {
          
          if(config) {
            
            next(config);
            
          } else {
              
            var app = new AppConfig(defaultConfig);  
            
            app.save(function(err) {
                next(app);
                return;
            });                           
          }
        }                
        
              
  }); 
  
}


