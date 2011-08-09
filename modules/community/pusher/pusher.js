/**
 * Module to enable socket.io to push updates to a user
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  io = require('socket.io'),
  sys = require('sys');

exports = module.exports = {
  init: init,
  route: route
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Routes
  module.router.route(req, res, next);

};

/**
 * Init
 */
function init(module, app, next) {

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {

    // These are the routes that pusher is enabled on re. sending / receiving messages.
    // Pusher enabled on every page
    module.router.addRoute(/.*/, pusher, {
      end: false,
      template: 'pusher',
      block: 'scripts.pusher'
    }, this.parallel());

  }, function done() {

    // Add the socket io listener
    calipso.socket = io.listen(app);

    // Add the scoket.io connection handlers
    calipso.socket.on('connection', function(client) {

      // Store the client in the sessionCache
      calipso.sessionCache[client.sessionId] = {
        client: client
      };

      client.on('message', function(message) {
        calipso.debug("message: " + message);
      });

      client.on('disconnect', function() {
        delete calipso.sessionCache[this.sessionId];
      });

    });


    next();
  });

};

/**
 * Render the scripts
 */
function pusher(req, res, template, block, next) {

  var port = req.app.address().port;

  calipso.theme.renderItem(req, res, template, block, {
    port: port
  },next);

};