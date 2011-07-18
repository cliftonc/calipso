/**
 * Module to enable socket.io to push updates to a user
 */

var calipso = require("lib/calipso"),
    io = require('socket.io'),
    sys = require("sys");

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

  if (!calipso.modules.content.initialised) {
    process.nextTick(function() {
      init(module, app, next);
    });
    return;
  }

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
    calipso.socket = io.listen(app, {
      log: false
    });

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

    // Add a post save hook to content
    // THIS IS JUST TESTING - need to push out to another module
    // re. content workflow and notifications
    var Content = calipso.lib.mongoose.model('Content');

    Content.schema.post('save', function() {
      // TODO
      // calipso.socket.broadcast("Saved");
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