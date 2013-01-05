/**
 *  Master server process
 *  Initialises a number of instances of the app, based on the number of CPU's it detects
 *  is available.
 *
 *  First arg is the port
 *  Second arg is the num worker threads;
 *
 *  e.g. node server 3000 8
 *
 */
// Dependencies
var rootpath = process.cwd() + '/',
  cluster = require('cluster'),
  path = require('path'),
  logo = require(path.join(rootpath, 'logo')),
  colors = require('colors'),
  port = process.env.PORT || 3000 || process.argv.port,
  restarts = 0,
  totalWorkers = 0,
  runningWorkers = 0;

var argv = processArgs();

if (module.parent) {
  module.exports.launchServer = launchServer;
}
else {
  launchServer();
}

/**
 * Launch server instance, initially master, then each worker instance is forked.
 * All instances share same config.
 */
function launchServer(inPort) {
  if (inPort) {
    port = inPort;
  }
  // Check if we are the master process
  if (cluster.isMaster) {

    //require('./app').boot(function (app) {


    // Load configuration
    var Config = require(rootpath + "lib/core/Configuration"),
      config = new Config();

    config.init();

    // Print the logo
    logo.print();

    // Set the number of workers
    totalWorkers = config.get('server:cluster:workers') || argv.c;

    // Fork workers based on num cpus
    console.log("Loading ".green + totalWorkers + " workers, please wait ...".green);
    for (var i = 0; i < totalWorkers; i++) {
      forkWorker();
    }

    // Log worker death
    // TODO : Auto restart with number of retries
    cluster.on('death', function (worker) {

      console.error('worker ' + worker.pid + ' died ...');

      // Manage restarting of workers
      if (config.get('server:cluster:restartWorkers')) {
        if (restarts > config.get('server:cluster:maximumRestarts')) {
          console.error('Maximum number of restarts reached, not restarting this worker.'.red);
        } else {
          restarts++;
          forkWorker();
        }
      }

    });

    //});

  } else {

    // We are a child worker, so bootstrap the app.
    require(rootpath + 'app').boot(true, function (app) {

      //logger.info("Worker [" + argv.m.cyan + "] with pid " + (process.pid + "").grey + " online.");
      app.listen(port);

      process.send({ cmd:'workerStarted', pid:process.pid, port:port });

    });

  }

}

/**
 * Helper function to fork a worker, we need to reset the counter in the master thread
 * hence the messaging back, also deal with messaging around job management from worker threads.
 */
function forkWorker() {

  var worker = cluster.fork();

  worker.on('message', function (msg) {

    if (msg.cmd) {

      if (msg.cmd == 'workerStarted') {

        runningWorkers++;

        if (runningWorkers === parseInt(totalWorkers)) {
          console.log("Calipso configured for: ".green + (global.process.env.NODE_ENV || 'development') + " environment.".green);
          console.log("Calipso server running ".green + runningWorkers + " workers, listening on port: ".green + port);
        }

      }

    }

  });

}

/**
 * Process command line arguments using optimist
 */
function processArgs() {
  return require('optimist')
    .usage('Launch Calipso in Clustered Mode\nUsage: $0')
    .describe('c', 'Number of CPUs')
    .alias('c', 'cpu')
    .default('c', require('os').cpus().length)
    .argv;
}
