/*!
 * Calipso theme library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This library provides all of the template loading, caching and rendering functions used by Calipso.
 *
 * The idea is that modules only ever provide generic, unstyled html (or json), where all layout and styling is completely
 * controlled by the theme.  Themes should be able to be reloaded on configuration change, and the theme engine
 * will watch for changes to templates (based on config) to speed up development.
 *
 * Additionally, configuration of layouts has been extracted out into a theme configuration file, enabling control of
 * the 'wiring' to an extent.
 *
 * Decision was made to not use the default express view renderers as it didn't give enough control over caching templates,
 * Interacting with the view libraries directly,
 *
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 *
 */

/**
 * Includes
 */
var fs = require('fs'),
    path = require('path'),
    calipso = require("lib/calipso"),
    utils = require('connect').utils,
    merge = utils.merge;

/**
 * The theme object itself, instantiated within calipso
 */
module.exports.Theme = function(themeName, next) {

  var themePath = __dirname + "/../themes/" + themeName + "/";

  /**
   * Load a theme
   */
  loadTheme(themeName, themePath, function(err,config) {
    if(err) {
      calipso.error(err.message);
      next();
    }

    cacheTheme(config,themePath,function (themeCache) {

      // Load the theme configuration file.
      var theme = {
        theme: themeName,
        cache: themeCache,
        config: config,
        compileTemplate: function(data,templatePath,templateExtension) {
          // expose private function for module to use
          return compileTemplate(data,templatePath,templateExtension);
        },

        // Render a module
        // Changed in 0.1.1 to be asynch
        renderItem: function(req, res, template, block, options, next) {

          var output = "";
          
          if(template) {
            
            themeOptions = createOptions(req, res, options);

            if(typeof template === 'function') {
              try {
                output = template.call({}, themeOptions);
              } catch(ex) {                
                output = "Block: " + block + " failed to render because " + ex.message + ex.stack;
              }

            } else {
              // Assume template is processed HTML
              output = template;              
            }
            
            if(block) {            
              res.renderedBlocks.set(block,output,next);
            } else {
              // Just return back to the calling function
              next(null,output);
            }

          }

        },
        render: function(req, res, next) {


          var cache = this.cache;
          var theme = this;

          // Scan through each layout
          var layout = res.layout ? res.layout : "default";

          if(!theme.config.layouts[layout]) {
            layout = "default";
            if(!theme.config.layouts[layout]) {
              calipso.error("Default layout is not defined within the current theme, exiting.");
              res.send("");
              return;
            }
          }

          processTheme(req,res,layout,theme,function(err) {

            // If something went wrong ...              
            if(err) {
              next(err,null);
              return;
            }
            
            // See if we are copying the layout template
            layout = theme.config.layouts[layout].layout.copyFrom ? theme.config.layouts[layout].layout.copyFrom : layout;

            // Now, process the layout template itself
            var themeOptions = createOptions(req,res,res.bufferedOutput);
            try {                
              var content = cache[layout].template.call({},themeOptions);
              next(null,content);
            } catch(ex) {
              next(ex,null);    
            }              

          });

        },
        getLayoutsArray: function() {

          var theme = this;
          var layouts = [];
          for(var layout in theme.config.layouts) {
            layouts.push(layout);
          }
          return layouts;

        }

      }

      next(theme);

    });


  });

}

/**
 *Process a theme section
 */
function processSection(req, res, section, themeName, layoutConfig, theme, next) {

  var themeOptions, themeCache = theme.cache[themeName];

  // Check the theme cache
  if(!themeCache) {
    calipso.error("Unable to find template for " + themeName);
    next()
    return;
  }

  var blockData = "";

  if(!themeCache.template) {
    // Use the default
    themeName = "default." + section;
    themeCache = theme.cache[themeName];
  }

  // should there be more than just these two error codes?
  // if more than just these two, then this would have to happen later on:
  // templates.push({name:"500", templatePath:"templates/500.html"});

  // Override with a 404 (not found) page
  if(section === "body" && res.statusCode === 404) {
    themeCache = theme.cache["404"];
  }

  // Override with a 500 (error) page
  if(section === "body" && res.statusCode === 500) {
    themeCache = theme.cache["500"];
    blockData = res.errorMessage ? res.errorMessage : "";
  }

  var themeCacheFn = themeCache.fn;

  res.bufferedOutput[section] = "";

  // Get the basic theme options
  themeOptions = createOptions(req,res,{blockData:blockData});

  // Add any custom functions
  if(typeof themeCacheFn === "function") {

    themeCacheFn(req,themeOptions,function(err,fnOptions) {

      if(err) {
        err.xMessage = "Issue executing the theme function for section " + section + ", check " + themeName.replace(".","/") + ".js";
        next(err);
        return;
      }          
        
      themeOptions = merge(themeOptions,fnOptions);
      try {
        res.bufferedOutput[section] += themeCache.template.call({}, themeOptions);
        next();
      } catch(ex) {
        // Augment the exception
        ex.xMessage = "Issue processing theme section: " + section + ", theme: " + themeName;
        next(ex);
      }
      
    });

  } else {
    
    try {
      res.bufferedOutput[section] += themeCache.template.call({}, themeOptions);
      next();
    } catch(ex) {
      ex.xMessage = "Issue processing theme section: " + section + ", theme: " + themeName;
      next(ex);
    }    

  }

}

/**
 * Copy the current block data over to options to render
 * @param res
 * @param config
 */
function processTheme(req, res, layout, theme, next) {

  delete res.bufferedOutput;
  res.bufferedOutput = {};

  // Scan through each layout
  try {
    var layoutConfig = theme.config.layouts[layout].layout;
  } catch(ex) {
    next(ex.message);
    return;
  }

  // Check to see if this layout copies default
  if(layoutConfig.copyFrom && layout != "default") {

    var copyConfig = theme.config.layouts[layoutConfig.copyFrom].layout;

    // Copy over any missing sections from default
    for(var copySection in copyConfig.sections) {
      if(!layoutConfig.sections[copySection]) {
          layoutConfig.sections[copySection] = copyConfig.sections[copySection];
          layoutConfig.sections[copySection].layout = "default"; // Flag override as below
      }
    }

  }

  calipso.lib.step(
    function processSections() {
      var group = this.group();
      for(var section in layoutConfig.sections) {

        // Check to see if we are overriding
        var layoutOverride = layoutConfig.sections[section].layout;
        var templateName = layoutOverride ? layoutOverride + "." + section : layout + "." + section;        
        processSection(req, res, section, templateName, layoutConfig, theme,group());        
        
      }
    },
    function done(err) {      
      next(err);
    }
  )

}

/**
 * Load a theme
 */
function loadTheme(theme, themePath, next) {

  var themeFile = themePath + "theme.json";

  path.exists(themeFile, function(exists) {
    if(exists) {
      fs.readFile(themeFile, 'utf8', function(err, data) {
        if(!err) {
          var jsonData;
          try {
            jsonData = JSON.parse(data);
            next(null, jsonData);
          } catch(ex) {
            next(new Error("Error parsing theme configuration: " + ex.message), data);
          }
        } else {
          next(err);
        }
      });
    } else {
      next(new Error("Can't find specified theme configuration " + themeFile));
    }
  });
}

/**
 * Load all of the theme templates into the theme
 * @param theme
 */
function cacheTheme(theme, themePath, next) {

  var templates = [];
  var templateCache = {};

  // Scan through each layout
  if (theme) {
    
    for(var layout in theme.layouts) {

      // Scan through each layout
      var layoutConfig = theme.layouts[layout].layout;

      templates.push({
        name: layout,
        templatePath: "templates/" + layoutConfig.template
      });

      for(var section in layoutConfig.sections) {
        var template = layoutConfig.sections[section].template;
        templates.push({
          name: layout + "." + section,
          templatePath: "templates/" + layout + "/" + template
        });
      }

      // Check to see if the theme overrides any module templates
      if(layoutConfig.modules) {
        for(var module in layoutConfig.modules) {
          for(var template in layoutConfig.modules[module]) {
              loadModuleOverrideTemplate(templateCache, module,template,themePath + layoutConfig.modules[module][template],themePath);
          }
        }
      }
    }

    // Add the error templates
    templates.push({name:"404", templatePath:"templates/404.html"});
    templates.push({name:"500", templatePath:"templates/500.html"});

    // Now load them all into the cache
    calipso.lib.step(
      function loadTemplates() {
        var group = this.group();
        templates.forEach(function(template) {
            loadTemplate(template, templateCache, themePath, group());
        });
      },
      function done(err) {
        if(err) {
          // May not be a problem as missing templates default to default
          calipso.debug(err.message);
          next();
        } else {
          next(templateCache);
        }
      }
    );
  }

}

/**
 * Load a template that overrides a module template
 * fired from cacheTheme(), 
 */
function loadModuleOverrideTemplate(templateCache, module, template, path) {


  var templatePath = path;
  var templateExtension = templatePath.match(/([^\.]+)$/)[0];
  var templateFn = fs.readFileSync(templatePath, 'utf8');

  var templateFnCompiled = compileTemplate(templateFn,templatePath,templateExtension);

  // Initialise the objects
  templateCache.modules = templateCache.modules || {};
  templateCache.modules[module] = templateCache.modules[module] || {};
  templateCache.modules[module].templates = templateCache.modules[module].templates || {};

  // allow hook for listening for module events?

  // Load the function
  templateCache.modules[module].templates[template] = templateFnCompiled;

  // TODO - Can't currently watch these for changes

}

/**
 * Load a template
 */
function loadTemplate(template, templateCache, themePath, next) {

  // Reset / default
  if(!templateCache[template.name]) templateCache[template.name] = {};

  // Template paths and functions
  var templatePath = themePath + template.templatePath;
  var templateExtension = template.templatePath.match(/([^\.]+)$/)[0];
  var templateFnPath = themePath + template.templatePath.replace("." + templateExtension, ".js");

  path.exists(templatePath,function(exists) {
    if(exists) {
      fs.readFile(templatePath, 'utf8', function(err,data) {
        if(!err) {

          if(calipso.app.set('config').watchFiles) {

            calipso.silly("Adding watcher for " + template.name);
            fs.unwatchFile(templatePath);
            fs.watchFile(templatePath, { persistent: true, interval: 200}, function(curr,prev) {

              loadTemplate(template, templateCache, themePath, function() {
                  calipso.silly("Template " + templatePath + " reloaded ...");
              });

            });

          }

          // Precompile the view into our cache
          templateCache[template.name].template = compileTemplate(data,templatePath,templateExtension);

          path.exists(templateFnPath, function(exists) {
            if(exists) {
              templateCache[template.name].fn = require(templateFnPath);
            }
            next();
          });
        } else {
          next(err);
        }
      });
    } else {
      next();
    }
  });

}

/**
 * Pre-compile a template based on its extension.
 * If the required view engine does not exist, exit gracefully and let
 * them know that this is the case.
 */
function compileTemplate(data,templatePath,templateExtension) {

  var compiledTemplate;
  var options = {filename:templatePath};

  // If we get html, replace with ejs
  if(templateExtension === "html") templateExtension = "ejs";

  // Load a template engine based on the extension
  try {
    var templateEngine = require(templateExtension);
  } catch(ex) {
    calipso.warn("No view rendering engine exists that matches: " + templateExtension + ", so using EJS!");
    var templateEngine = require("ejs");
  }

  // Return our compiled template
  compiledTemplate = templateEngine.compile(data,options);
  return compiledTemplate;

}

/**
 * Merge options together
 */
function createOptions(req, res, options) {

  // Merge options with helpers
  options = merge(options, calipso.getDynamicHelpers(req, res));

  // Merge options with application data
  if(calipso.data) {
    options = merge(options, calipso.data);
  }

  return options;

}