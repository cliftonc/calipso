/**
 * Base module to insert google analytics tracking code
 */

var calipso = require('lib/calipso');

exports = module.exports = {
  init: init,
  route: route
};


/**
 *Router
 */
function route(req, res, module, app, next) {

  // Router
  module.router.route(req, res, next);

};

/**
 *Init
 */
function init(module, app, next) {

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {

    // Tracking code is added to every page
    module.router.addRoute(/.*/, ga, {
      end: false,
      template: 'ga',
      block: 'scripts.ga'
    }, this.parallel());

  }, function done() {

    // No initialisation?
    next();

  });

};

/**
 * Render the ga code, extracting the key from app config
 */
function ga(req, res, template, block, next) {

  var key = req.app.set('google-analytics-key');
  calipso.theme.renderItem(req, res, template, block, {
    key: key
  },next);
  

};