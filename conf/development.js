
/**
 * DEVELOPMENT Environment settings
 */
module.exports = function(app,express) {

  // Database connection
  app.set('db-uri', 'mongodb://localhost:' + app.dbPort + '/' + app.dbBaseName + '-dev');

  // Change to suit - this key works for calip.so
  app.set('google-analytics-key', app.googleAnalyticsKey);

  // Disqus
  app.set('disqus-shortname', app.disqusName);

  // App config
  app.set('server-url', 'http://localhost:' + app.port);

  // Language mode
  app.set('language-add', true);
  

  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

};
