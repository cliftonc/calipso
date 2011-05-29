/**
 * Calipso script for running in clustered mode. Usage: node app-cluster, or
 * NODE_ENV=production node app-cluster
 */
var cluster = require('cluster'), live=require('cluster-live');
var port = 3000;
var path = __dirname;
var app;

/**
 * Create an instance of calipso via the normal App.
 */
require('./app').boot(function(app) {

  /**
   * TODO: Check to ensure that the logs and pids folders exist before launching
   */

  cluster(app)
      .set('working directory', path)
      .set('socket path', path)
    .in('development')
      .set('workers', 4)
      .use(cluster.logger(path + '/logs', 'debug'))
      .use(cluster.debug())
      .use(cluster.pidfiles(path + '/pids'))
      .use(cluster.stats({ connections: true, lightRequests: true }))
      .use(live(9999))
    .in('test')
      .set('workers', 4)
      .use(cluster.logger(path + '/logs', 'warning'))
      .use(cluster.pidfiles(path + '/pids'))
      .use(cluster.stats({ connections: true, lightRequests: true }))
      .use(live(9999))
    .in('production')
      .set('workers', 4)
      .use(cluster.logger(path + '/logs'))
      .use(cluster.pidfiles(path + '/pids'))
      .use(cluster.stats({ connections: true, lightRequests: true }))
      .use(live(9999,{user:'admin',pass:app.set('config').livePassword}))
    .in('all')
      .listen(port);

    console.log("\x1b[36mCalipso cluster live listening on port \x1b[0m 9999 \x1b[36m, Production 'admin' password: %s \x1b[0m\r\n", app.set('config').livePassword);


});
