// TODO - THIS NEEDS TO BE REPLACED WITH THE NEW Node 0.5+ multi process, see cliftonc/ted

/**
 * Calipso script for running in clustered mode. Usage: node app-cluster, or
 * NODE_ENV=production node app-cluster
 */
var cluster = require('cluster');
var port = process.env.PORT || 3000;
var path = __dirname;
var app;

if (typeof cluster !== 'function') {
  if (cluster.isMaster) {
    var cpus = require('os').cpus().length;
    while (cpus-- > 0)
      cluster.fork();
    cluster.on('death', function(worker) {
      console.log('worker ' + worker.pid + ' died');
//      cluster.fork();
    });
  } else {
    console.log("worker " + process.pid);
    setTimeout(function () {
      require('./app').boot(function (app) {
        app.listen(port);
      });      
    }, 0)
  }
  return;
}
/**
 * Create an instance of calipso via the normal App,
 */
require('./app').boot(function (app) {

  /**
   * TODO: Check to ensure that the logs and pids folders exist before launching
   */
  cluster(app)
    .set('working directory', path)
    .set('socket path', path)
    .in('development')
    .set('workers', 3)
    .use(cluster.logger(path + '/logs', 'debug'))
    .use(cluster.debug())
    .use(cluster.pidfiles(path + '/pids'))
    .use(cluster.stats({ connections: true, lightRequests: true }))
    .in('test')
    .set('workers', 3)
    .use(cluster.logger(path + '/logs', 'warning'))
    .use(cluster.pidfiles(path + '/pids'))
    .in('production')
    .set('workers', 3)
    .use(cluster.logger(path + '/logs'))
    .use(cluster.pidfiles(path + '/pids'))
    .in('all')
    .listen(port);

},true);
