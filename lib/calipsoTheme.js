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
            
            // Scan through each layout
            var layout = res.layout ? res.layout : "default";            
            if(!theme.config.layouts[layout]) {
              calipso.silly("Layout " + layout + " is not defined within the current theme, using default.");
              layout = "default";                  
              if(!theme.config.layouts[layout]) {
                calipso.error("Default layout is not defined within the current theme, exiting.");
                res.send("");
                return;
              }
            }    
            
            var options = createOptions(req,res,processTheme(req,res,layout,this));                        
            res.send(cache[layout].call({},options));
            
        }
      } 
      
      next(theme);
        
    });
    
    
  });
  
}

/**
 * Copy the current block data over to options to render
 * @param res
 * @param config
 */
function processTheme(req,res,layout,theme) {
        
  var options = {};
  
  // Scan through each layout
  var layoutConfig = theme.config.layouts[layout].layout;    
        
 
    for(var section in layoutConfig.sections) {
      
      
        var themeName = layout + "." + section;        
        var themeCache = theme.cache[themeName];       
        
        if(!themeCache) {
          // Use the default
          calipso.silly("Using the default section theme cache for " + section);
          themeCache = theme.cache["default." + section];
        }
        
        options[section] = "";
        
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
            
            themeOptions = createOptions(req,res,{blockData:blockData});
            options[section] += themeCache.call({},themeOptions);
            
          } else {
              
            options[section] += themeCache.call({},{});
            
          }
          
        } else {
            
          
            calipso.silly("Checking menu for section " + section);
          
          
            // Pass the menu over - TODO : Deal with menu types            
            if(res.menu[section]) {
              
              calipso.silly("Generating menu for section " + section);
              themeOptions = createOptions(req,res,{menu:res.menu[section]});  
              var menu =  themeCache.call({},themeOptions);
              calipso.silly(menu);
              options[section] +=  menu;
              
            }            
          
        }
        
  }           
  
  return options;
  
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
            calipso.silly("Caching template " + template.name + " from " + template.templatePath);
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
  
  var templatePath = themePath + template.templatePath;
    
  path.exists(templatePath,function(exists) {
    if(exists) {
      fs.readFile(templatePath, 'utf8', function(err,data) {
           if(!err) {
             // Precompile the view into our cache
             templateCache[template.name] = calipso.lib.ejs.compile(data);                  
             next();
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
     
  
    function request(req){        
      return req;        
    }
    
    function user(req){        
        var user;      
        if(req.session && req.session.user) {
          user = req.session.user;            
        } else {
          user = {username:'',anonymous:true};
        }
        return user;        
    }
    
    function hasMessages(req) {
       return Object.keys(req.session.flash || {}).length;
    }

    function messages(req){
       return function() {
         var msgs = req.flash();
         return Object.keys(msgs).reduce(function(arr, type){
           return arr.concat(msgs[type]);
         }, []);        
       }
     }

    // apply 
    var options = merge(options, 
          {request:request(req),
            user:user(req),
           hasMessages:hasMessages(req),
           messages:messages(req)
           });
    
    // Check to see if we have any data
    if(calipso.data) {
      options = merge(options,calipso.data);
    }
    
    return options;
    
}

