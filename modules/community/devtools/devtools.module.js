/**
 * Developer Tools
 * This will create a block that displays:
 * - Timing for modules, as well as full page timing.
 * - Block structure for processed blocks on a page (useful for theming).
 */
var calipso = require('lib/calipso');

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,
  about: {
    description: 'Start of developer tools module.',
    author: 'cliftonc',
    version: '0.1.1',
    home: 'http://github.com/cliftonc/calipso'
  },
  last: true // Needs to run last
};

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  // Router
  module.router.route(req, res, next);

};


/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {

  calipso.lib.step(

  function defineRoutes() {

    // Add a route to every page, notice the 'end:false' to ensure block further routing
    module.router.addRoute(/.*/, devTools, {
      end: false,
      template: 'devtools',
      block: 'dev.tools'
    }, this.parallel());


  }, function done() {

    // Any schema configuration goes here
    next();

  });


};

/**
 * Every page block function
 */
function devTools(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {blocks:res.renderedBlocks},next);

};
