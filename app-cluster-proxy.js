
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

 module.exports = require('calipso/app-cluster');