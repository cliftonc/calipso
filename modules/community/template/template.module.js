/**
 * Template module
 */
var calipso = require("lib/calipso");

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {init: init, route: route, install: install, reload: reload, disable: disable, jobs: {templateJob:templateJob}};

/**
 * Template module
 */
function route(req, res, module, app, next) {

   // Menu items
  res.menu.primary.push({name:'Template', url:'/template', regexp:/template/});

  // Router
  module.router.route(req, res, next);

};

function init(module, app, next) {


  // If dependent on another module (e.g. content):
  // if(!calipso.modules.content.initialised) {
  //   process.nextTick(function() { init(module,app,next); });
  //   return;
  // }

  // Any pre-route config
  calipso.lib.step(
    function defineRoutes() {

      // Add a route to every page, notice the 'end:false' to ensure block further routing
      module.router.addRoute(/.*/, allPages, {end:false, template:'templateAll', block:'right'}, this.parallel());

      // Page
      module.router.addRoute('GET /template', templatePage, {template:'templateShow', block:'content'}, this.parallel());

    },
    function done() {

      // Any schema configuration goes here
      next();
    }
  );


};

/**
 * Simple template page function
 */
function templatePage(req, res, template, block, next) {

  // Set any variables
  var myVariable = "Hello World";

  // Create a content item
  var item = {id:"NA", type:'content', meta:{variable:myVariable}};

  // Render the item via the template provided above
  calipso.theme.renderItem(req, res, template, block, {item:item});

  next();

};

/**
 * Every page block function
 */
function allPages(req, res, template, block, next) {

  var myVariable = "Hello World on every page!";
  var item = {id:"NA", type:'content', meta:{variable:myVariable}};
  calipso.theme.renderItem(req, res, template, block, {item:item});
  next();

};

/**
 * Template installation hook
 * @returns
 */
function install() {
  calipso.log("Template module installed");
}

/**
 * hook for disabling
 */
function disable() {
  calipso.log("Template module disabled");
}

/**
 * Admin hook for reloading
 */
function reload() {
  calipso.log("Template module reloaded");
}

/**
 * Template Job
 */
function templateJob(args,next) {
  calipso.log("Template job function called with args: " + args);
  next();
}