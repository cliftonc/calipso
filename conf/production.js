
/**
 * PRODUCTION Environment settings
 */
module.exports = function(app,express) {

  // Database connection
  app.set('db-uri', 'mongodb://localhost:' + app.dbPort + '/' + app.dbBaseName + '-prod');

  // Change to suit - this key works for calip.so
  app.set('google-analytics-key', app.googleAnalyticsKey);

  // Disqus
  app.set('disqus-shortname', app.disqusName);

  // App config
  app.set('server-url', app.serverUrl);

// Language mode
  app.set('language-add', false);

  app.use(express.errorHandler({ dumpExceptions: true, showStack: false }));

};
