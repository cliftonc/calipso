/*!
 * Module auto-documentation module
 */

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
var calipso = require("lib/calipso");
exports = module.exports = {init: init, route: route};

/**
 * Routes
 */
function route(req, res, module, app, next) {

  // Routes
  module.router.route(req, res, next);

};

/**
 * Initialisation
 */
function init(module, app, next) {

  // Any pre-route config
  calipso.lib.step(
    function defineRoutes() {

      // Page
      module.router.addRoute('GET /document/:module', document, {template:'document', block:'content'}, this.parallel());
      module.router.addRoute('GET /document/:module/:include', document, {template:'document', block:'content'}, this.parallel());

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
function document(req, res, template, block, next) {

  // Get the module name
  var module = req.moduleParams.module;

  if(!module || !calipso.modules[module]) {
    res.statusCode = 404;
    next();
    return;
  }

  // See if we are looking for a sub-file
  var include = req.moduleParams.include;

  // Get the file
  var filePath;
  if(!include) {
    // We are getting the module itself
    filePath = calipso.app.path + "/" + calipso.modules[module].path + "/" + module + ".module.js";
  } else {
    filePath =  calipso.app.path + "/" + calipso.modules[module].path + "/" + include;
  }

  // Read the file from disk
  var fs = calipso.lib.fs;
  var source = fs.readFileSync(filePath, 'utf8');

  // Run it through dox
  var output = [];
  try {
    var dox = require("support/dox");
    output = dox.parseComments(source);
  } catch(ex) {
    calipso.error(ex.message);
  }

  // TODO Update the links to templates

  // TODO Update the local requires

  // Render the item via the template provided above
  calipso.theme.renderItem(req, res, template, block, {output:output,module:calipso.modules[module]});

  next();

};
