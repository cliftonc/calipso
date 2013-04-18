/**
 * Enable rich forms (Aloha Editor)
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso'));

/**
 * Turns form date elements into jQUery UI Datepickers
 * REQUIRES jQuery & jQuery UI to be included in the theme ...
 */
exports = module.exports = {
  init:init,
  route:route,
  disable:disable,
  reload:reload,
  depends:["content", "contentTypes"]
};

/**
 * ROute
 */
function route(req, res, module, app, next) {

  module.router.route(req, res, next);

};

/**
 *Init
 */
function init(module, app, next) {

  calipso.lib.step(
    function defineRoutes() {
      // Add a route to every page, ideally just do it on form pages, but can't tell atm
      module.router.addRoute(/.*/, allPages, {
        end:false,
        template:'aloha.script',
        block:'scripts.aloha'
      }, this.parallel());
      module.router.addRoute(/.*/, allPages, {
        end:false,
        template:'aloha.style',
        block:'styles.aloha'
      }, this.parallel());
    },
    function done() {
      app.use(calipso.lib.express["static"](__dirname + '/static'));
      next();
    });
};

/**
 * Every page block function
 */
function allPages(req, res, template, block, next) {
  calipso.theme.renderItem(req, res, template, block, {}, next);
};

/**
 * Show a blank page to enable the rich form preview
 * This requires that you have a layout called preview, that basically has no header, footer, navigation
 * etc. or you wont get desired results.
 */
function showPreview(req, res, template, block, next) {

  res.layout = "preview";
  next();

};


/*
 * Disable - same as reload
 */
function disable() {
  reload();
}

/**
 * Reload
 */
function reload() {

  // Reset the Form methods to their defaults
  // TODO!
}
