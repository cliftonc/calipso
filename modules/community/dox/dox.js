/*!
 * Module auto-documentation module based on the Dox library
 * http://visionmedia.github.com/dox/
 */

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
var calipso = require('lib/calipso');

exports = module.exports = {
  init: init,
  route: route,
  about: {
    description: 'Module that provides automated documentation, based on source code, for the modules currently deployed into a Calipso instance.',
    author: 'cliftonc',
    version: '0.1.1',
    home:'http://github.com/cliftonc/calipso'
  }
};

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
    module.router.addRoute('GET /dox', list, {
      template: 'list',
      block: 'content'
    }, this.parallel());

    module.router.addRoute('GET /dox/:module', document, {
      template: 'document',
      block: 'content'
    }, this.parallel());

    module.router.addRoute('GET /dox/library/:library', document, {
      template: 'document',
      block: 'content'
    }, this.parallel());


  }, function done() {

    // Any schema configuration goes here
    next();
  });


};

/**
 *List all modules
 */
function list(req, res, template, block, next) {

  var libraries = [
    {
      name:'calipso',
      about: {
        description:'Core calipso library (connect middleware) that controls the overall function of Calipso',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Date',
      about: {
        description:'Core calipso library that wraps the jQuery UI Datepicker date functions for use across the framework.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Event',
      about: {
        description:'Module event handlers and events, used to drive initiation and routing of dependent modules.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Form',
      about: {
        description:'Core calipso form handling library, forms are created from json objects and rendered consistently. Contributors: dennishall.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Helpers',
      about: {
        description:'Helper functions that can be used from within the view engines (jade or ejs).',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Link',
      about: {
        description:'Link rendering library.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Menu',
      about: {
        description:'Menu management and rendering class.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Router',
      about: {
        description:'Router object that allows modules to route requests internally.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Table',
      about: {
        description:'Table rendering library.',
        author:'cliftonc',
        version:calipso.app.version
      }
    },
    {
      name:'Theme',
      about: {
        description:'Theme management library, responsible for all rendering.',
        author:'cliftonc',
        version:calipso.app.version
      }
    }
  ];

  // Render the item via the template provided above
  calipso.theme.renderItem(req, res, template, block, {modules: calipso.modules, libraries:libraries}, next);

}

/**
 * Simple template page function
 */

function document(req, res, template, block, next) {


  var fs = calipso.lib.fs;

  // Get the module name
  var module = req.moduleParams.module;
  var library = req.moduleParams.library;

  if ((!module || !calipso.modules[module]) && !library) {
    res.statusCode = 404;
    next();
    return;
  }

  // See if we are looking for a sub-file
  var templateFile = req.moduleParams.template;
  var include = req.moduleParams.include;


  // Get the file
  var filePath;
  var fileType = "module"; // Default
  if (!include && !templateFile && !library) {
    // We are getting the module itself
    filePath = calipso.modules[module].path + "/" + module + ".module.js";
  }

  if (include && !library) {

    // By default the include file will be part of the module
    filePath = calipso.modules[module].path + "/" + include + ".js";

  }

  if (templateFile && !library) {

    // Locate it (as we are uncertain of the path)
    fs.readdirSync(calipso.app.path + "/" + calipso.modules[module].path + "/templates/").forEach(function(actualTemplate) {
      if (actualTemplate.split(".")[0] === templateFile) {
        filePath = calipso.modules[module].path + "/templates/" + actualTemplate;
      }
    });
    fileType = "template";

  }


  if (library) {

    // Include a core library
    filePath = "lib/" + library + ".js";
    fileType = "library";

  }

  // Attempt to read the file from disk
  var source;
  source = fs.readFileSync(calipso.app.path + "/" + filePath, 'utf8');

  // Run it through dox
  var output = [];
  var templates = [];
  var requires = [];

  try {

    switch (fileType) {

        case "module":

          var dox = require('./dox');
          output = dox.parseComments(source);

          templates = linkTemplates(module, output);
          requires = linkRequired(module, output);
          break;

        case "library":

          var dox = require('./dox');
          output = dox.parseComments(source);

          requires = linkRequired(module, output, true);

          break;

        default:

          output = [{
                 description: {
                   full: 'Displaying file: ' + filePath
                 },
                 code: escape(source)
               }]

    }


  } catch (ex) {

    calipso.error(ex.message);

  }

  // Render the item via the template provided above
  calipso.theme.renderItem(req, res, template, block, {
    output: output,
    module: calipso.modules[module],
    templates: templates,
    requires: requires,
    type: fileType,
    path: filePath
  }, next);

};




/**
 *  Replace any template('name') occurrences with links to the template.
 *  Return a 'template' array that can be printed at the top to show all templates used
 *  by this module
 **/

function linkTemplates(module, output) {

  var templateRegex = /template:?.'(\w+)'/g;
  var replaceString = "template: <a href=\"/dox/" + module + "?template=$1\">$1</a>"
  var templates = [];

  output.forEach(function(item) {
    if (item.code) {

      // Add to array
      var match = true;
      while (match != null) {
        match = templateRegex.exec(item.code)
        if (match != null) templates.push(match[1]);
      }

      item.code = item.code.replace(templateRegex, replaceString);

    }
  })

  return templates;

}

/**
 *  Replace any require('module') with a link, ad add to requires array
 **/

function linkRequired(module, output, library) {

  // var requireRegex = /require\(\'(\w+.*)\'\)/;
  var requireLocalRegex = /require\(\'\.\/(\w+.*)\'\)/g;
  var requireLibRegex = /require\(\'lib\/(\w+.*)\'\)/g;
  var libString = "require(\'lib/<a href=\"/dox/library/$1\">$1</a>')";
  var localString = "require(\'./<a href=\"/dox/" + module + "?include=$1\">$1</a>')";

  var replaceAllString = library ?  libString : localString;
  var requires = [];

  output.forEach(function(item) {
    if (item.code) {

      // Add to array
      var match = true;
      while (match != null) {
        match = requireLocalRegex.exec(item.code)
        if (match != null) requires.push(match[1]);
      }

      // Replace
      item.code = item.code.replace(requireLocalRegex, replaceAllString);
      item.code = item.code.replace(requireLibRegex, libString);

    }
  })

  return requires;

}

/**
 *Escape
 */

function escape(html) {
  return String(html).replace(/&(?!\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};