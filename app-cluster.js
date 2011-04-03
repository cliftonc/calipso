/**
 * Module dependencies.
 */
var cluster = require('cluster');
var app;

/**
 * Initial bootstrapping
 */
exports.boot = function(port,path){
  
  //Create our express instance	
  app = require('./app').boot();
  
  // TODO : ENABLE Reload
  /**
   * var watchFolders = [path + '/models', 
                      path + '/controllers',
                      path + '/views',
                      path + '/utils']
  
     .use(cluster.reload(watchFolders,{ signal: 'SIGQUIT', interval: 60000 }))
   
   */    
  
  cluster(app)
  	  .set('working directory', path)
  	  .set('socket path',path)
	  .in('development')
	    .set('workers', 1)	    
	    .use(cluster.logger(path + '/logs', 'debug'))
	    .use(cluster.debug())	   
	    .use(cluster.pidfiles(path + '/pids'))
	  .in('test')
	    .set('workers', 1)
	    .use(cluster.logger(path + '/logs', 'warning'))	    
	    .use(cluster.pidfiles(path + '/pids'))
	  .in('production')
	    .set('workers', 2)
		.use(cluster.logger(path + '/logs'))	    
		.use(cluster.pidfiles(path + '/pids'))
	  .in('all')
	    .listen(port);
	  
};

