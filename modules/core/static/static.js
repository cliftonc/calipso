/*!
 * Static content module - Processed last on unmatched GET
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),

  exports = module.exports = {
    init:init,
    route:route,
    last:true
  };
function route(req, res, module, app, next) {
  module.router.route(req, res, next);
}
function init(module, app, next) {
  calipso.lib.step(
    function defineRoutes() {
      module.router.addRoute(/^\/images|^\/js|^\/css|^\/favicon.ico|png$|jpg$|gif$|css$|js$/, handleStatic, {
        admin:false
      }, this.parallel());
    },
    function done() {
      next();
    });
}
function handleStatic(req, res, template, block, next) {
  calipso.debug("Handling static asset");
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Cannot ' + req.method + ' ' + req.originalUrl);
}