/**
 * Module that allows creation of text fields
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query;

/**
 * Define the routes that this module will repsond to.
 */
var routes = [
]

/**
 * Exports
 */
exports = module.exports = {
  init:init,
  routes:routes,
  route:route,
  depends:["contentTypes", "field"]
};

/**
 * Router
 */
function route(req, res, module, app, next) {
  /**
   * Routing and Route Handler
   */
  module.router.route(req, res, next);

}

/**
 *Init
 */
function init(module, app, next) {
  calipso.field.Helper.fieldInfo('hidden', calipso.modules.field.fn.fieldSettingsFormJson, calipso.modules.field.fn.fieldJson)
  module.initialised = true;
  next();
}
