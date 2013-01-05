/**
 * Base taxonomy module to create menus
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, (process.env.CALIPSO_COV ? 'lib-cov' : 'lib'), 'calipso'));


var routes = [
  {path:'GET /secured', fn:routeFn, permit:'test:permission', admin:true, template:'test', block:'content.example'}
];

module.exports = {
  init:init,
  route:route,
  routes:routes,
  about:{
    description:'Sample module used only for testing the core of Calipso',
    author:'cliftonc',
    version:'0.3.1',
    home:'http://github.com/cliftonc/calipso'
  }
};

/**
 * Routes
 */
function route(req, res, module, app, next) {
  module.router.route(req, res, next);
};

/**
 *Init
 */
function init(module, app, next) {
  // Nothing to do
  next();
};

/**
 * Very basic router Fn
 */
function routeFn(req, res, options, next) {
  res.outputStack.push('module_a');
  res.statusCode = 200; // Not clear why I have to manually do this - TODO tp check
  calipso.theme.renderItem(req, res, options.templateFn, options.block, {'hello':'world'}, next);
};