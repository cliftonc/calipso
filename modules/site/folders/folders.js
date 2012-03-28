/*!
 * Asset folder module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  url = require('url'),
  fs = require('fs'),
  blocks = require(path.join(rootpath, 'lib/Blocks'));

exports = module.exports = {
  init: init,
  route: route
};

/*
 * Router
 */
function route(req, res, module, app, next) {

  // Menu items
  res.menu.secondary.addMenuItem({name:'Folder Test',path:'folders',url:'/folders',description:'Calipso folders ...',security:[]});

  // Routing and Route Handler
  module.router.route(req, res, next);
}


/*
 * Initialisation
 */
function init(module, app, next) {

  // Folder routes
  calipso.lib.step(

  function defineRoutes() {

    // Folder dashboard
    module.router.addRoute('GET /folders', showFolders, {
      template: 'folders',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

  }, function done() {

    next();

  });

}
function showFolders(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {},next);

}