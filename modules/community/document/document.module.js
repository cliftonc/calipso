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


  var fs = calipso.lib.fs;

  // Get the module name
  var module = req.moduleParams.module;

  if(!module || !calipso.modules[module]) {
    res.statusCode = 404;
    next();
    return;
  }

  // See if we are looking for a sub-file
  var templateFile = req.moduleParams.template;
  var include = req.moduleParams.include;


  // Get the file
  var filePath;
  var fileType = "js"; // Default

  if(!include && !templateFile) {
    // We are getting the module itself
    filePath = calipso.modules[module].path + "/" + module + ".module.js";

  }

  if(include) {

    // By default the include file will be part of the module
    filePath =  calipso.modules[module].path + "/" + include + ".js";

  }

  if(templateFile) {

    // Locate it (as we are uncertain of the path)
    fs.readdirSync(calipso.app.path + "/" + calipso.modules[module].path + "/templates/").forEach(function(actualTemplate){
        if(actualTemplate.split(".")[0] === templateFile) {
          filePath = calipso.modules[module].path + "/templates/" + actualTemplate;
        }
    });
    fileType = "html";

  }

  // Attempt to read the file from disk
  var source;
  source = fs.readFileSync(calipso.app.path + "/" + filePath, 'utf8');

  // Run it through dox
  var output = [];
  var templates = [];
  var requires = [];

  try {

    if(fileType === "js") {
      var dox = require("support/dox");
      output = dox.parseComments(source);

      templates = linkTemplates(module, output);
      requires = linkRequired(module, output);


    } else {

      output = [{description:{full:'Template file: ' + filePath},code:escape(source)}]

    }

  } catch(ex) {

    calipso.error(ex.message);

  }

  // Render the item via the template provided above
  calipso.theme.renderItem(req, res, template, block, {output:output, module:calipso.modules[module],templates:templates, requires:requires, type: fileType});

  next();

};




/**
 *  Replace any template('name') occurrences with links to the template.
 *  Return a 'template' array that can be printed at the top to show all templates used
 *  by this module
 **/
function linkTemplates(module, output) {

  var templateRegex = /template:?.'(\w+)'/g;
  var replaceString = "template: <a href=\"/document/" + module + "?template=$1\">$1</a>"
  var templates = [];

  output.forEach(function(item) {
    if(item.code) {

      // Add to array
      var match = true;
      while (match != null) {
          match = templateRegex.exec(item.code)
          if(match != null) templates.push(match[1]);
      }

      item.code = item.code.replace(templateRegex, replaceString);

    }
  })

  return templates;

}

/**
 *  Replace any require('module') with a link, ad add to requires array
 **/
function linkRequired(module, output) {

  // var requireRegex = /require\(\'(\w+.*)\'\)/;
  var requireLocalRegex = /require\(\'\.\/(\w+.*)\'\)/g;
  var replaceString = "require(\'./<a href=\"/document/" + module + "?include=$1\">$1</a>')";
  var requires = [];

  output.forEach(function(item) {
    if(item.code) {

      // Add to array
      var match = true;
      while (match != null) {
          match = requireLocalRegex.exec(item.code)
          if(match != null) requires.push(match[1]);
      }

      // Replace
      item.code = item.code.replace(requireLocalRegex, replaceString);

    }
  })

  return requires;

}

/**
 *Escape
 */
function escape(html) {
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
