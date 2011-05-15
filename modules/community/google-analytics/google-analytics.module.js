/**
 * Base module to insert google analytics tracking code
 */

var calipso = require("lib/calipso");

exports = module.exports = {init: init, route: route};


function route(req,res,module,app,next) {

      /**
       * Routes
       */
      module.router.route(req,res,next);

};

function init(module,app,next) {

    // Any pre-route config
  calipso.lib.step(
      function defineRoutes() {

        // These are the routes that pusher is enabled on re. sending / receiving messages.

        // Pusher enabled on every page
        module.router.addRoute(/.*/,ga,{end:false,template:'ga',block:'scripts.ga'},this.parallel());

      },
      function done() {

        // No initialisation?
        next();

      }
  );

};

function ga(req,res,template,block,next) {

  var key = req.app.set('google-analytics-key');
  calipso.theme.renderItem(req,res,template,block,{key:key});
  next();

};