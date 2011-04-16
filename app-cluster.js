/**
 * Module dependencies.
 */
var cluster = require('cluster');
var port = 3000;
var path = __dirname;
var app;
  
//Create our express instance	
require('./app').boot(function(app) {

  cluster(app)
      .set('working directory', path)
      .set('socket path',path)
    .in('development')
      .set('workers', 4)      
      .use(cluster.logger(path + '/logs', 'debug'))
      .use(cluster.debug())    
      .use(cluster.pidfiles(path + '/pids'))
    .in('test')
      .set('workers', 2)
      .use(cluster.logger(path + '/logs', 'warning'))     
      .use(cluster.pidfiles(path + '/pids'))
    .in('production')
      .set('workers', 2)
    .use(cluster.logger(path + '/logs'))      
    .use(cluster.pidfiles(path + '/pids'))
    .in('all')
      .listen(port);

});