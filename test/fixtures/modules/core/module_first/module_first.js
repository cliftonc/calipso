/**
 * Base taxonomy module to create menus
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, (process.env.CALIPSO_COV ? 'lib-cov' : 'lib'), 'calipso'));

exports = module.exports = {
  init:init,
  route:route,
  about:{
    description:'Sample module used only for testing the core of Calipso',
    author:'cliftonc',
    version:'0.3.1',
    home:'http://github.com/cliftonc/calipso'
  },
  first:true
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
  module.router.addRoute(/.*/, routeFn, {}, next);
};

/**
 * Very basic router Fn
 */
function routeFn(req, res, options, next) {
  res.outputStack.push('module_first');
  next();
};
