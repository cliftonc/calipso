/**
 * Developer Tools
 * This will create a block that displays:
 * - Timing for modules, as well as full page timing.
 * - Block structure for processed blocks on a page (useful for theming).
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso'));

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,
  last: true // Needs to run last
};

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  // Add dev tools view 
  res.menu.admin.addMenuItem({name:'Development',path:'admin/dev',url:'#',description:'Dev tools ...',security:[]});
  res.menu.admin.addMenuItem({name:'Calipso Events',path:'admin/dev/events',url:'/admin/dev/events',description:'View events and event listeners ...',security:[]});
  
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
      block: 'footer.dev.tools'
    }, this.parallel());

    // Event Viewer
    module.router.addRoute('GET /admin/dev/events', devEvents, {
      end: false,
      template: 'events',
      block: 'content.dev.events'
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

/**
 * View events and event listeners
 */
function devEvents(req, res, template, block, next) {

  var sys = require('sys');
  calipso.theme.renderItem(req, res, template, block, {sys:sys,events:calipso.e.events},next);

};
