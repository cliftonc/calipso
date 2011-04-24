
/**
 * DEVELOPMENT Environment settings
 */
module.exports = function(app,express) {
		
    // Database connection
	  app.set('db-uri', 'mongodb://localhost/calipso-dev');

    // Change to suit - this key works for calip.so
    app.set('google-analytics-key', 'UA-17607570-4');
    
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    
}
