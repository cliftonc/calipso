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

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  fs = require('fs'),
  utils = require('connect').utils,
  merge = utils.merge;

/**
 * The theme object itself, instantiated within calipso
 */
module.exports.Theme = function(theme, next) {

  // Defaults
  var themeName = theme.name;
  var themePath = theme.path;

  /**
   * Load a theme
   */
  loadTheme(themeName, themePath, function(err,themeConfig) {

    if(err) {
      calipso.error("Error loading theme: " + err.message + " stack, :" + err.stack);
      next();
      return;
    }

    cacheTheme(themeConfig,themePath,function (err,themeCache) {

      if(err) {
        calipso.error("Error caching theme: " + err.message);
        next();
        return;
      }

      // Load the theme configuration file.
      var theme = {
        theme: themeName,
        cache: themeCache,
        config: themeConfig,
        compileTemplate: function(data,templatePath,templateExtension) {
          // expose private function for module to use
          return compileTemplate(data,templatePath,templateExtension);
        },

        // Render a module
        // Changed in 0.1.1 to be asynch
        renderItem: function(req, res, template, block, options, next) {

          var output = "";

          if(template) {

            var themeOptions = createOptions(req, res, options);

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
              // Store the block and layout
              res.renderedBlocks.set(block,output,res.layout,next);
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
          
          calipso.silly("Using layout " + layout);
 
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
            
            // Now, process the layout template itself
            var themeOptions = createOptions(req,res,res.bufferedOutput);

            try {
              var content = theme.cache[layout].template.call({},themeOptions);
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

};

/**
 *Process a theme section
 */
function processSection(req, res, section, sectionPath, layoutConfig, theme, next) {

  var themeOptions, sectionCache = theme.cache[sectionPath];

  // Check the theme cache
  if(!sectionCache) {
    calipso.error("Unable to find template for " + sectionPath);
    next();
    return;
  }

  var blockData = "";

  if(!sectionCache.template) {
    // Use the default
    sectionPath = "default." + section;
    sectionCache = theme.cache[sectionPath];
  }

  // should there be more than just these two error codes?
  // if more than just these two, then this would have to happen later on:
  // templates.push({name:"500", templatePath:"templates/500.html"});

  // Override with a 404 (not found) page
  if(section === "body" && res.statusCode === 404) {
    if(!theme.cache.hasOwnProperty("404")) {
      localNext(new Error("You must define a 404 template in the error folder e.g. error/404.html"));
      return;
    }
    sectionCache = theme.cache["404"];
  }

  // Override with a 500 (error) page
  if(section === "body" && res.statusCode === 500) {
    if(!theme.cache.hasOwnProperty("500")) {
      localNext(new Error("You must define a 500 template in the error folder e.g. error/500.html"));
      return;
    }
    sectionCache = theme.cache["500"];
    blockData = res.errorMessage ? res.errorMessage : "";
  }

  // Retrieve any backing function
  var sectionCacheFn = sectionCache.fn;

  // Clear any buffered output for this section
  res.bufferedOutput[section] = "";

  // Get the basic theme options
  themeOptions = createOptions(req,res,{blockData:blockData});

  calipso.silly("Processing section " + sectionPath + " ...");

  // Add any custom functions
  if(typeof sectionCacheFn === "function") {

    sectionCacheFn(req,themeOptions,function(err,fnOptions) {
      
      if(err) {
        err.xMessage = "Issue executing the theme function for section " + section + ", check " + sectionPath.replace(".","/") + ".js";
        localNext(err);
        return;
      }

      themeOptions = merge(themeOptions,fnOptions);
      try {
        res.bufferedOutput[section] += sectionCache.template.call({}, themeOptions);
        localNext();
      } catch(ex) {
        // Augment the exception
        ex.xMessage = "Issue processing theme section " + section + ", path: " + sectionPath;
        localNext(ex);
      }

    });

  } else {
    try {
      res.bufferedOutput[section] += sectionCache.template.call({}, themeOptions);
      localNext();
    } catch(ex) {
      ex.xMessage = "Issue processing theme section: " + section + ", theme: " + sectionPath;
      localNext(ex);
    }

  }

  // Local next function to enable proxying of callback
  function localNext(err) {
    calipso.silly("Done processing section " + sectionPath + " ...");
    next(err);
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
    layoutConfig.sections = layoutConfig.sections || {};
    
    // Copy over any missing sections from default
    for(var copySection in copyConfig.sections) {
      
      var sectionExists = layoutConfig.sections && layoutConfig.sections[copySection];
      var disable = layoutConfig.sections && layoutConfig.sections[copySection] && layoutConfig.sections[copySection].disable;        
      if(!sectionExists && !disable) {
        layoutConfig.sections[copySection] = copyConfig.sections[copySection];
        layoutConfig.sections[copySection].layout = "default"; // Flag override as below
      }
     
    }

  }
  
  // Create a section array
  var sections = [];
  for(section in layoutConfig.sections) {
    disable = layoutConfig.sections[section].disable;   
    if(!disable) {
      sections.push(section);
    }
  }
  var totalCount = sections.length;
  var totalDone = 0;

  // Now, process all the sections
  // This is done via a localNext to give us full control
  //   and better ability to debug
  function localNext(err) {
    totalDone += 1;
        
    if(totalDone == totalCount) {
       next();
    }
    
  }

  for(section in layoutConfig.sections) {

    // Check to see if we are overriding
    var currentSection = section;
    var layoutOverride = layoutConfig.sections[section].layout;
    var sectionPath = layoutOverride ? layoutOverride + "." + section : layout + "." + section;
    var cache = layoutConfig.sections[section].cache;
    var params = layoutConfig.sections[section].varyParams;
    var cacheEnabled = calipso.config.get('performance:cache:enabled');    
    var isAdmin = req.session.user && req.session.user.isAdmin;
    
    disable = layoutConfig.sections[section].disable;        

    calipso.silly("Processing " + section + " ...");
    
    // Sections are cacheable
    if(!disable) {
      if(cache && cacheEnabled && !isAdmin) {
        var cacheKey = calipso.cache.getCacheKey('section',currentSection,params);
        sectionCache(req, res, cacheKey, section, sectionPath, layoutConfig, theme, localNext);
      } else {
        processSection(req, res, section, sectionPath, layoutConfig, theme, localNext);
      }
    }

  };


}

/**
 * Interact with sections via the cache
 */
function sectionCache(req, res, cacheKey, section, templateName, layoutConfig, theme, next) {


  calipso.cache.check(cacheKey,function(err,isCached) {
    if(isCached) {
        calipso.cache.get(cacheKey,function(err,cache) {
          if(!err) {
            res.bufferedOutput[section] = cache.content;
          }
          next(err);
        });
    } else {
      processSection(req, res, section, templateName, layoutConfig, theme, function(err) {
         if(!err) {
           var content = res.bufferedOutput[section];
           calipso.cache.set(cacheKey,{content:content},null,next);
         } else {
           next(err);
         }
      });
    }
  });
}


/**
 * Load a theme
 */
function loadTheme(theme, themePath, next) {

  var themeFile = calipso.lib.path.join(themePath,"theme.json");

  path.exists(themeFile, function(exists) {
    if(exists) {
      fs.readFile(themeFile, 'utf8', function(err, data) {
        if(!err) {
          var jsonData;
          try {
            jsonData = JSON.parse(data);
            next(null, jsonData);
          } catch(ex) {
            next(new Error("Error parsing theme configuration: " + ex.message + " stack, " + ex.stack));
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
function cacheTheme(themeConfig, themePath, next) {

  var templates = [];
  var templateCache = {};

  // Scan through each layout
  if (themeConfig) {

    for(var layout in themeConfig.layouts) {

      // Scan through each layout
      var layoutConfig = themeConfig.layouts[layout].layout;

      // Add the layout template
      templates.push({
        name: layout,
        templatePath: calipso.lib.path.join("templates",layoutConfig.template)
      });


      // Add the templates
      for(var section in layoutConfig.sections) {        
        var template = layoutConfig.sections[section].template;
        if(template) {
          templates.push({
            name: layout + "." + section,
            templatePath: calipso.lib.path.join("templates",layout,template)
          });
        }
      }

      // Check to see if the theme overrides any module templates
      if(layoutConfig.modules) {
        for(var module in layoutConfig.modules) {
          for(var template in layoutConfig.modules[module]) {
            loadModuleOverrideTemplate(templateCache, module, template, path.join(themePath,layoutConfig.modules[module][template]));
          }
        }
      }
    }

    // Push error message templates
    var templateFiles = calipso.lib.fs.readdirSync(calipso.lib.path.join(themePath,'templates','error'));
    var errorCodeTemplates = calipso.lib._.select(templateFiles, function(filename){
      // Select files that start with 3 digits, indicating an error code
      return filename.match(/^\d{3}./);
    });

    calipso.lib._.each(errorCodeTemplates, function(filename){
      templates.push({name: filename.match(/^\d{3}/), templatePath: calipso.lib.path.join("templates","error",filename)});
    });

    // Now load them all into the cache
    calipso.lib.step(
      function loadTemplates() {
        var group = this.group();
        templates.forEach(function(template) {
           loadTemplate(templateCache, template, themePath, group());
        });
      },
      function done(err) {
        if(err) {
          // May not be a problem as missing templates default to default
          calipso.error("Error loading templates, msg: " + err.message + ", stack: " + err.stack);
          next(err);
        } else {
          next(null,templateCache);
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
function loadTemplate(templateCache, template, themePath, next) {

  // Reset / default
  if(!templateCache[template.name]) templateCache[template.name] = {};

  // Template paths and functions
  var templatePath = calipso.lib.path.join(themePath,template.templatePath);
  var templateExtension = template.templatePath.match(/([^\.]+)$/)[0];
  var templateFnPath = calipso.lib.path.join(themePath,template.templatePath.replace("." + templateExtension, ".js"));

  path.exists(templatePath,function(exists) {

    if(exists) {
      
      fs.readFile(templatePath, 'utf8', function(err,data) {

        if(!err) {

          if(calipso.config.get('performance:watchFiles')) {

            fs.unwatchFile(templatePath);
            fs.watchFile(templatePath, { persistent: true, interval: 200}, function(curr,prev) {

              loadTemplate(templateCache, template, themePath, function() {
                  calipso.silly("Template " + templatePath + " reloaded ...");
              });

            });

          }

          // Precompile the view into our cache
          templateCache[template.name].template = compileTemplate(data,templatePath,templateExtension);
          path.exists(templateFnPath, function(exists) {
            if(exists) {
              try {
                templateCache[template.name].fn = require(templateFnPath);
              } catch(ex) {                
                next(ex);
                return;
              }
            }
            next(null,templateCache);
          });
        } else {          
          next(err);
        }
      });

    } else {
      next(new Error('Path does not exist: ' + templatePath));
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
  try {
    compiledTemplate = templateEngine.compile(data,options);
  } catch(ex) {
    calipso.error("Error compiling template : " + templatePath + ", message: " + ex.message);
  }
  return compiledTemplate;

}

/**
 * Merge options together
 */
function createOptions(req, res, options) {

  // Merge options with helpers
  options = merge(options, req.helpers);

  // Merge options with application data
  if(calipso.data) {
    options = merge(options, calipso.data);
  }

  return options;

}