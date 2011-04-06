
/**
 * DEVELOPMENT Environment settings
 */
module.exports = function(app,express) {
		
	  app.set('db-uri', 'mongodb://localhost/mvc-development');	       	  
    // app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    
}
