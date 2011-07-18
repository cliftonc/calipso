/**
 * Repository module
 */
var calipso = require('lib/calipso'), sys = require('sys'), GitHubApi = require("github").GitHubApi;

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,
  install: install
};

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  // Menu items  
  res.menu.primary.addMenuItem({name:'Repository',path:'repo',url:'/repo',description:'Module and theme repository ...',security:[]});

  // Router
  module.router.route(req, res, next);

};


/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {
 
  calipso.lib.step(

  function defineRoutes() {

    // Page
    module.router.addRoute('GET /repo', repoHome, {
      template: 'home',
      block: 'content.repo'
    }, this.parallel());

  }, function done() {

    // Any schema configuration goes here
    next();

  });

};

/**
 * Simple home page function
 */
function repoHome(req, res, template, block, next) {
     
    var github = new GitHubApi(true);
    github.getRepoApi().show('cliftonc', 'calipso',function(err, repo) {
        calipso.theme.renderItem(req, res, sys.inspect(repo,true,10,false), block, {},next);        
    });
  
    // Render the item via the template provided above
    
  
};

/**
 * installation hook
 */
function install() {
  calipso.log("Template module installed");
}
