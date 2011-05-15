/**
 * Disqus commenting
 */

var calipso = require("lib/calipso");

exports = module.exports = {
  init: init,
  route: route,
  about: {
    description: 'Adds disqus as the default commenting engine, applies by default to any content page (html suffix), but can be ammended to apply to other pages.',
    author: 'cliftonc',
    version: '0.2.0',
    home:'http://github.com/cliftonc/calipso'
  }
};

function route(req, res, module, app, next) {

  // Routes
  module.router.route(req, res, next);

};

function init(module, app, next) {

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {

    // Disqus on content pages
    module.router.addRoute(/^((?!content).*)html$/, disqus, {
      end: false,
      template: 'disqus',
      block: 'scripts.disqus'
    }, this.parallel());
    module.router.addRoute(/^(\/dox.*)/, disqus, {
      end: false,
      template: 'disqus',
      block: 'scripts.disqus'
    }, this.parallel());

  }, function done() {

    // No initialisation?
    next();

  });

};

/**
 * Render the disqus javascript file using the settings stored within the environment configuration.
 */

function disqus(req, res, template, block, next) {

  var disqusShortName = req.app.set('disqus-shortname');
  var disqusURL = req.app.set('server-url') + req.url;
  var disqusID = ''; // TODO
  calipso.theme.renderItem(req, res, template, block, {
    disqusShortName: disqusShortName,
    disqusURL: disqusURL,
    disqusID: disqusID
  });

  next();

};