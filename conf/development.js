
/**
 * DEVELOPMENT Environment settings
 */
module.exports = function(app,express) {

  // Database connection
  app.set('db-uri', 'mongodb://localhost/calipso-dev');

  // Change to suit - this key works for calip.so
  app.set('google-analytics-key', 'UA-17607570-4');

  // Disqus
  app.set('disqus-shortname', 'calipsojs');

  // App config
  app.set('server-url', 'http://localhost:3000');

  // Language mode
  app.set('language-add', true);
  

  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

}
