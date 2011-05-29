
/**
 * PRODUCTION Environment settings
 */
module.exports = function(app,express) {

  // Database connection
  app.set('db-uri', 'mongodb://localhost/calipso-prod');

  // Change to suit - this key works for calip.so
  app.set('google-analytics-key', 'UA-17607570-4');

  // Disqus
  app.set('disqus-shortname', 'calipsojs');

  // App config
  app.set('server-url', 'http://calip.so');

// Language mode
  app.set('language-add', false);

  app.use(express.errorHandler({ dumpExceptions: true, showStack: false }));

}
