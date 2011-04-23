/*!
 * Connect - content loader
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 * 
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 * 
 */
var fs = require('fs'),path = require('path'), sys=require('sys'), 
    calipso = require("./calipso"),
    utils = require('connect').utils,    
    merge = utils.merge;

module.exports.Theme = function(themeName,next) {
   
  var themePath = __dirname + "/../themes/" + themeName + "/";  
  
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
        renderItem: function(req, res, template, block, options) {
                    
          if(template && block) {
            
            themeOptions = createOptions(req,res,options);

            if(typeof template === 'function') {
              var output;
              try {
                output = template.call({},themeOptions);
              } catch(ex) {
                res.renderedBlocks[block].push("Block: " + block + " failed to render because " + ex.message );         
                return;
              }                            
              
              res.renderedBlocks[block].push(output);
              
            } else {
              
              // Assume template is processed HTML
              res.renderedBlocks[block].push(template);
              
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
            
            processTheme(req,res,layout,theme,function() {              
               var content = cache[layout].call({},res.output);                              
               next(content);              
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

function processSection(req,res,section,themeName,layoutConfig,theme,next) {
    
  var themeOptions,
      themeCache = theme.cache[themeName];
  
  if(!themeCache) {
    // Use the default
    calipso.silly("Using the default section theme cache for " + section);
    themeName = "default." + section;
    themeCache = theme.cache[themeName];
  }

  var themeCacheFn = theme.cache[themeName + "_fn"];
   
  res.output[section] = "";
  
  if(!layoutConfig.sections[section].menu) {
    
    if(layoutConfig.sections[section].blocks) {
      
      var blockData = "";
      layoutConfig.sections[section].blocks.forEach(function(block) {                       
            if(res.renderedBlocks[block]) {                          
              res.renderedBlocks[block].forEach(function(renderedContent) {
                  blockData += renderedContent;
              });                           
            }                                              
      });
      
      // Get the basic theme options
      themeOptions = createOptions(req,res,{blockData:blockData});
      
      // Add any custom functions                  
      if(themeCacheFn) {
        
        themeCacheFn(req,themeOptions,function(fnOptions) {
            themeOptions = merge(themeOptions,fnOptions);
            res.output[section] += themeCache.call({},themeOptions);
            next();
        });    
        
      } else {
        
        res.output[section] += themeCache.call({},themeOptions);  
        next();
        
      }                  
      
    } else {                  
      
      res.output[section] += themeCache.call({},{});      
      next();
      
    }
    
  } else {
              
      // Pass the menu over - TODO : Deal with menu types            
      if(res.menu[section]) {                    
        themeOptions = createOptions(req,res,{menu:res.menu[section]});  
        var menu =  themeCache.call({},themeOptions);                    
        res.output[section] +=  menu;                    
      }
      next();
      
  }
  
}

/**
 * Copy the current block data over to options to render
 * @param res
 * @param config
 */
function processTheme(req,res,layout,theme,next) {
        
  res.output = {};
  
  // Scan through each layout
  var layoutConfig = theme.config.layouts[layout].layout;    
         
  calipso.lib.step(      
      function processSections() {                    
            var group = this.group();
            
            for(var section in layoutConfig.sections) {
                var themeName = layout + "." + section;
                try {
                  processSection(req,res,section,themeName,layoutConfig,theme,group());  
                } catch(ex) {
                  calipso.error(ex);
                  group()();
                }
                
            }            
      }, 
      function done() {
        next();
      }    
  )
  
}

/**
 * Load a theme
 */
function loadTheme(theme, themePath, next) {    
  
  var themeFile = themePath + "theme.json";
  
  path.exists(themeFile,function(exists) {
    
    if(exists) {
      fs.readFile(themeFile, 'utf8', function(err,data) {
           if(!err) {
             var jsonData;
             try {
               jsonData = JSON.parse(data);
               next(null,jsonData);
             } catch(ex) {
               next(new Error("Error parsing theme configuration: " + ex.message),data);
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
function cacheTheme(theme,themePath,next) {
  
  var templates = [];
  var templateCache = {};
  
  // Scan through each layout
  for(var layout in theme.layouts) {
    
    // Scan through each layout
    var layoutConfig = theme.layouts[layout].layout;
        
    templates.push({name:layout,templatePath:"templates/" + layoutConfig.template});
    
    for(var section in layoutConfig.sections) {
        var template = layoutConfig.sections[section].template;
        templates.push({name:layout + "." + section,templatePath:"templates/" + layout + "/" + template});
    }        
    
  }  
  
  // Now load them all into the cache
  calipso.lib.step(
      function loadTemplates() {
        var group = this.group();
        templates.forEach(function(template) {
            loadTemplate(template,templateCache,themePath, group());
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
  )
  
  
  
}

/**
 * Load a template
 */
function loadTemplate(template, templateCache, themePath, next) {    
  
  // Template paths and functions
  var templatePath = themePath + template.templatePath;
  var templateFnPath = themePath + template.templatePath.replace(".html",".js");
    
  path.exists(templatePath,function(exists) {
    if(exists) {
      fs.readFile(templatePath, 'utf8', function(err,data) {
           if(!err) {
             // Precompile the view into our cache
             templateCache[template.name] = calipso.lib.ejs.compile(data);
             path.exists(templateFnPath,function(exists) {
               if(exists) {                                  
                 templateCache[template.name + "_fn"] = require(templateFnPath);                 
               }
               next();
             });
           } else {             
             next(err);
           }
      });
    } else {  
      // new Error("Can't find specified template configuration " + templatePath)
      next();
    }
  });
  
}


function createOptions(req,res,options) {        
          
    // Merge options with helpers
    var options = merge(options,calipso.getDynamicHelpers(req,res));
    
    // Merge options with application data
    if(calipso.data) {
      options = merge(options,calipso.data);
    }
    
    return options;
    
}

