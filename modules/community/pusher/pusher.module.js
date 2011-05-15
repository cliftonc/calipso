/**
 * Module to enable socket.io to push updates to a user
 */

var calipso = require("lib/calipso"), io = require('socket.io'), sys = require("sys");

exports = module.exports = {init: init, route: route};

function route(req,res,module,app,next) {

      /**
       * Routes
       */
      module.router.route(req,res,next);

};

function init(module,app,next) {

  if(!calipso.modules.content.initialised) {
    process.nextTick(function() { init(module,app,next); });
    return;
  }

    // Any pre-route config
  calipso.lib.step(
      function defineRoutes() {

        // These are the routes that pusher is enabled on re. sending / receiving messages.

        // Pusher enabled on every page
        module.router.addRoute(/.*/,pusher,{end:false,template:'pusher',block:'scripts.pusher'},this.parallel());

      },
      function done() {

        // Add the socket io listener
        calipso.socket = io.listen(app,{log:false});

        calipso.socket.on('connection', function(client){

          calipso.sessionCache[client.sessionId] = {client: client};

          client.on('message', function(message){
             calipso.debug("message: " + message);
          });

          client.on('disconnect', function(){

            delete calipso.sessionCache[this.sessionId];

          });

        });

        // Add a post save hook to content
        var Content = calipso.lib.mongoose.model('Content');

        Content.schema.post('save',function() {

          calipso.socket.broadcast("Saved");
          //calipso.debug(sys.inspect(calipso.sessionCache,true,1,true));

        });

        next();
      }
  );

};

function pusher(req,res,template,block,next) {

  var port = req.app.address().port;

  calipso.theme.renderItem(req,res,template,block,{port:port});
  next();

};