/*!
 * Core administration module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),

exports = module.exports = {
  init: init,
  route: route
};

/*
 * Router
 */
function route(req, res, module, app, next) {

  // Menu items
  res.menu.admin.addMenuItem({name:'Administration',path:'admin',url:'/admin',description:'Calipso administration ...',security:[]});
  res.menu.admin.addMenuItem({name:'Calipso Core',path:'admin/core',url:'/admin',description:'Manage core settings for Calipso ...',security:[]});
  res.menu.admin.addMenuItem({name:'Configuration Options',path:'admin/core/config',url:'/admin/core/config',description:'Core configuration ...',security:[]});
  res.menu.admin.addMenuItem({name:'View Languages',path:'admin/core/languages',url:'/admin/core/languages',description:'Languages ...',security:[]});
  res.menu.admin.addMenuItem({name:'View Cache',path:'admin/core/cache',url:'/admin/core/cache',description:'Cache ...',security:[]});
  res.menu.admin.addMenuItem({name:'Clear Cache',path:'admin/core/cache/clear',url:'/admin/core/cache/clear',description:'Clear Cache ...',security:[]});

  // Routing and Route Handler
  module.router.route(req, res, next);

}


/*
 * Initialisation
 */
function init(module, app, next) {

  // Initialise administration events - enabled for hook.io  
  calipso.e.addEvent('CONFIG_UPDATE',{enabled:true,hookio:true}); 

  // Add listener to config_update
  calipso.e.post('CONFIG_UPDATE',module.name,calipso.reloadConfig);

  // Admin routes
  calipso.lib.step(

  function defineRoutes() {

    // Core Administration dashboard
    module.router.addRoute('GET /admin', showAdmin, {
      template: 'admin',
      block: 'admin.show',
      admin: true
    }, this.parallel());

    // Core configuration
    module.router.addRoute('GET /admin/core/config', coreConfig, {
      block: 'admin.show',
      admin: true
    }, this.parallel());

    module.router.addRoute('POST /admin/core/config/save', saveAdmin, {
      admin: true
    }, this.parallel());

    module.router.addRoute('GET /admin/core/cache', showCache, {
      admin: true,
      template:'cache',
      block:'admin.cache'
    }, this.parallel());

    module.router.addRoute('GET /admin/core/cache/clear', clearCache, {
      admin: true,
      template:'cache',
      block:'admin.cache'
    }, this.parallel());

    module.router.addRoute('GET /admin/core/languages', showLanguages, {
      admin: true,
      template:'languages',
      block:'admin.languages',
    }, this.parallel());


    // Default installation routers
    module.router.addRoute('GET /admin/install', install, null, this.parallel());
    module.router.addRoute('POST /admin/install', install, null, this.parallel());
    module.router.addRoute('POST /admin/installTest/mongo', installMongoTest, null, this.parallel());
    module.router.addRoute('POST /admin/installTest/user', installUserTest, null, this.parallel());

  }, function done() {

    next();

  });

}


/**
 * Show languages stored in memory,
 * optionally enable translation of these by google translate.
 */
function showLanguages(req, res, template, block, next) {

  // Check to see if we should google translate?!
  // e.g. /admin/languages?translate=es
  if(req.moduleParams.translate) {

    var language = req.moduleParams.translate;
    var languageCache = req.languageCache[language];

    var gt = require('utils/googleTranslate');

    if(languageCache) {
      calipso.lib.step(
        function translateAll() {
          var group = this.group();
          for(var item in languageCache) {
            gt.googleTranslate(item, language, group());
          }
        },
        function allTranslated(err, translations) {

          if(err) {
            req.flash('error',req.t('There was an error translating that language because {msg}', {msg: err.message}));
          }

          if(!err && translations) {
            translations.forEach(function(translation) {
              req.languageCache[language][translation.string] = translation.translation;
            });
          }

          calipso.theme.renderItem(req, res, template, block, {
            languageCache: req.languageCache
          }, next);

        }
      )
    } else {

      req.flash('info',req.t('That language does not exist.'));
      calipso.theme.renderItem(req, res, template, block, {
        languageCache: req.languageCache
      }, next);


    }

  } else {

    calipso.theme.renderItem(req, res, template, block, {
      languageCache: req.languageCache
    }, next);

  }

}

/**
 * Installation routine, this is triggered by the install flag being set
 * in the configuration, which is detected in the core routing function
 * in calipso.js and redirected here.
 */
function install(req, res, template, block, next) {


  // If not in install mode, do not install
  if (calipso.config.get('installed')) {
    res.redirect("/");
    next();
    return;
  }
  
  // Ensure we are using the install layout
  res.layout = "install";

  // The install process will work in steps
  var installStep = req.moduleParams.installStep || "welcome";

  // Process the input from the previous step
  calipso.form.process(req, function(form) {

      if (form) {
        if(form.userStep) {
          // Store the user for later
          calipso.data.adminUser = form.user;
        } else {
          // Update the configuration
          updateConfiguration(form);
        }
        // Override install step
        installStep = form.installStep
      }

      // Process the installation
      switch (installStep) {
        case "welcome":
          installWelcome(req,res,localNext);
          break;
        case "mongodb":
          installMongo(req,res,localNext);
          break;
        case "user":
          installUser(req,res,localNext);
          break;
        case "modules":
          installModules(req,res,localNext);
          break;
        case "done":
          installDone(req,res,localNext);
          break;
        default:
          localNext(new Error("A step was specified that is not defined in the install process: " + installStep));
      }

  });

  function localNext(err) {
    if (err) {
      res.statusCode = 500;
      res.errorMessage = err.message;
      req.flash('error', req.t('Calipso has become stuck in install mode. The specific error returned was: ' + err.message));
    }
    next();
  }

}

/**
 * Installation welcome screen - called by install router, not a routing function.
 */
function updateConfiguration(values) {
    
  // Update config for all the values, do not save now
  for(value in values) {
    if(value !== 'installStep' && value !== 'userStep' && value !== 'returnTo' && value !== 'submit')
      calipso.config.set(value,values[value]);
  }
  return;
}



/**
 * Installation welcome screen - called by install router, not a routing function.
 */
function installWelcome(req,res,next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_welcome;
  calipso.theme.renderItem(req, res, template, 'admin.install.welcome', {}, next);

}

/**
 * Installation mongodb - called by install router, not a routing function.
 */
function installMongo(req,res,next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_mongo;

  // Create the form
  var mongoForm = {id:'install-mongo-form',title:'',type:'form',method:'POST',action:'/admin/install',
        fields:[
          {label:'MongoDB URI',name:'database:uri',cls:'database-uri', type:'text',description:'Enter the database URI, in the form: mongodb://servername:port/database'},
          {label:'',name:'installStep',type:'hidden'}
        ],
        buttons:[]}; // Submitted via template

  var formValues = {
    database: {
        uri: calipso.config.get('database:uri')
    },
    'installStep':'user'
  }

  calipso.form.render(mongoForm, formValues, req, function(form) {
      calipso.theme.renderItem(req, res, template, 'admin.install.mongo', {form:form}, next);
  });

}

/**
 * Function to enable ajax testing of the mongo configuration
 */
function installMongoTest(req, res, template, block, next) {

  if (calipso.config.get('installed')) {
      res.format = "json";
      res.end(JSON.stringify({status:"Invalid Request"}),"UTF-8");
      return next();      
  }

  calipso.form.process(req,function(form) {
    
    var dbUri = form.dbUri;
    var output = {};

    if(dbUri) {
      calipso.mongoConnect(dbUri,true,function(err,connected) {
        if(!err) {
          output.status = "OK";
        } else {
          output.status = "FAILED";
          output.message= "Failed to connect to MongoDB because: " + err.message;
        }
        res.format = "json";
        res.end(JSON.stringify(output),"UTF-8");
        next();
      });      
    } else {
      output.status = "FAILED";
      output.message= "You need to provide a valid database uri, in the format described.";      
      res.format = "json";
      res.end(JSON.stringify(output),"UTF-8");
      next();
    }

  });
}



/**
 * Installation user - called by install router, not a routing function.
 */
function installUser(req,res,next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_user;

  // Create the form
  // TODO - reference exported form from user module instead, this will be difficult to maintain
  var userForm = {
    id:'install-user-form',title:'',type:'form',method:'POST',action:'/admin/install',
      fields:[
        {label:'Username', name:'user[username]', cls:'username', type:'text'},
        {label:'Full Name', name:'user[fullname]', type:'text'},
        {label:'Email', name:'user[email]', cls:'email', type:'text'},
        {label:'Language', name:'user[language]', type:'select', options:req.languages}, // TODO : Select based on available
        {label:'Password', name:'user[password]', cls:'password', type:'password'},        
        {label:'Repeat Password', name:'user[check_password]', cls: 'check_password', type:'password'},  
        {label:'',name:'installStep',type:'hidden'},
        {label:'',name:'userStep',type:'hidden'}
      ],
    buttons:[]
  };

  var formValues = {
    user:(calipso.data.adminUser || {}), // Store here during install process
    'userStep':true,
    'installStep':'modules'
  }

  calipso.form.render(userForm, formValues, req, function(form) {
      calipso.theme.renderItem(req, res, template, 'admin.install.user', {form:form}, next);
  });

}

/**
 * Function to enable ajax testing of the mongo configuration
 */
function installUserTest(req, res, template, block, next) {

  if (calipso.config.get('installed')) {
      res.format = "json";
      res.end(JSON.stringify({status:"Invalid Request"}),"UTF-8");
      return next();      
  }


  calipso.form.process(req,function(form) {
        
    // Check to see if new passwords match
    var err;
    
    if(form.password != form.check_password) {
      err = new Error(req.t('Your passwords do not match.'));
    }

    // Check to see if new passwords are blank
    if(form.password === '') {
      err = new Error(req.t('Your password cannot be blank.'));        
    }
    
    if(form.username === '') {
      err = new Error(req.t('Your username cannot be blank.'));        
    }    

    // Check to see if new passwords are blank
    if(form.email === '') {
      err = new Error(req.t('Your email cannot be blank.'));        
    }

    var output = {};
    if(err) {
      output.status = "FAILED";
      output.message= "There was a problem because: " + err.message;          
    } else {
      output.status = "OK";
    }
    res.format = "json";
    res.end(JSON.stringify(output),"UTF-8");
    next();

  });
  
}

/**
 * Install Modules - called by install router, not a routing function.
 */
function installModules(req,res,next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_modules;

  // Create the form
  var moduleForm = {id:'install-modules-form',title:'',type:'form',method:'POST',action:'/admin/install',
        fields:[
          {label:'',name:'installStep',type:'hidden'}
        ],
        buttons:[]}; // Submitted via template

  //Add the modules
  moduleForm.fields = createModuleFields(moduleForm.fields);
  
  // Defaults
  var formValues = {
    modules: {
      admin: {
        enabled: true
      },
      content: {
        enabled: true
      },
      contentTypes: {
        enabled: true
      },
      user: {
        enabled: true
      }      
    },
    installStep: 'done'    
  };

  calipso.form.render(moduleForm, formValues, req, function(form) {
    calipso.theme.renderItem(req, res, template, 'admin.install.modules', {form:form}, next);
  });

}

function doInstallation(next) {

  // NOTE: User is installed via the user module
    
  // Set the install flag to true, enable db connection
  calipso.config.set('installed',true);
  calipso.mongoConnect(function(err) {

    if(err) {
      return next(err);
    }

    // Get a list of all the modules to install 
    var modulesToInstall = [];
    for (var module in calipso.modules) {
      // Check to see if the module is currently enabled, if so install it
      if (calipso.modules[module].enabled && calipso.modules[module].fn && typeof calipso.modules[module].fn.install === 'function') {
        modulesToInstall.push(module);
      }
    } 

    // Note - the admin user is created in the user module install process
    calipso.lib.step(
      function installModules() {
        var group = this.group();
         modulesToInstall.forEach(function(module){
          calipso.silly("Installing module " + module);
          calipso.modules[module].fn.install(group());            
        });
      },
      function saveConfiguration(err) {
        // Save configuration to file
        calipso.silly("Saving configuration ... ");
        calipso.config.set('installed',true);
        calipso.config.save(this);        
      },
      function reloadConfiguration() {
        // This ensures the configuration is applied in cluster mode
        calipso.reloadConfig("ADMIN_INSTALL", calipso.config, this);
      },
      function done(err) {
        return next(err);
      }
    );
    
  });

}


/**
 * Install Modules - called by install router, not a routing function.
 */
function installDone(req,res,next) {

  doInstallation(function(err) {

    var template = calipso.modules.admin.templates.install_done;
    calipso.theme.renderItem(req, res, template, 'admin.install.done', {err:err,calipso:calipso}, next);

  });

}


/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function showAdmin(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {},next);

}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function coreConfig(req, res, template, block, next) {

  calipso.data.themes = [];
  calipso.data.adminThemes = []; // TODO
  for(var themeName in calipso.themes){
    var theme = calipso.themes[themeName];
    if(theme.about.type === "full" || theme.about.type === "frontend") {
      calipso.data.themes.push(themeName);
    }
    if(theme.about.type === "full" || theme.about.type === "admin") {
      calipso.data.adminThemes.push(themeName);
    }
    if(!theme.about.type) {
      console.error("Theme " + themeName + " not enabled due to missing type.");
    }
  }


  var adminForm = {
    id:'admin-form',
    title:'Administration',
    type:'form',
    method:'POST',
    action:'/admin/core/config/save',
    tabs:true,
    sections:[
      {
        id:'form-section-core',
        label:'Site',
        fields:[
          {
            label:'Site Name',
            name:'server:name',
            type:'text'
          },
           {
            label:'Modules Location',
            name:'server:modulePath',
            type:'text'
          },
           {
            label:'Themes Location',
            name:'server:themePath',
            type:'text'
          },
           {
            label:'Server URL',
            name:'server:url',
            type:'text'
          }
        ]
      },
      {
        id:'form-section-language',
        label:'Language',
        fields:[
          {
            label:'Default Language',
            name:'i18n:language',
            type:'select',
            options: req.languages
          },
          {
            label:'Add Unknown Terms',
            name:'i18n:additive',
            type:'checkbox',  
            labelFirst: true
          }
        ]
      },
      {
        id:'form-section-performance',
        label:'Performance & Clustering',
        fields:[
          {
            label:'Performance',
            legend:'Performance',
            type:'fieldset',
            fields:[
              {
                label:'Enable Cache',
                name:'performance:cache:enabled',
                type:'checkbox',
                description:'Experimental - will probably break things!',
                labelFirst: true
              },
              {
                label:'Default Cache TTL',
                name:'performance:cache:ttl',
                type:'text',
                description:'Default age (in seconds) for cache items.'
              },
              {
                label:'Watch Template Files',
                name:'performance:watchFiles',
                type:'checkbox',
                labelFirst: true
              }
            ]
          },
          {
            label:'Hook.IO',
            legend:'Hook.IO',
            type:'fieldset',
            fields:[
              {
                label:'Hook.IO Name',
                name:'server:hookio:name',
                type:'text'
              }, 
              {
                label:'Hook.IO Port',
                name:'server:hookio:port',
                type:'text'
              },
              {
                label:'Hook.IO Host Name',
                name:'server:hookio:host',
                type:'text'
              },
              {
                label:'Hook.IO Debug',
                name:'server:hookio:debug',
                type:'checkbox',
                labelFirst: true
              },
              {
                label:'Hook.IO Max Listeners',
                name:'server:hookio:maxListeners',
                type:'text'
              }
            ]
          },
          {
            label:'Event Emitter',
            legend:'Event Emitter',
            type:'fieldset',
            fields:[
              {
                label:'EventEmitter Max Listeners',
                name:'server:events:maxListeners',
                type:'text'
              }
            ]
          }
        ]
      },
      {
        id:'form-section-theme',
        label:'Theme',
        fields:[
          {
            label:'Frontend Theme',
            name:'theme:front',
            type:'select',
            options: calipso.data.themes,
            description:'Theme used for all web pages excluding admin pages'
          },
          {
            label:'Admin Theme',
            name:'theme:admin',
            type:'select',
            options: calipso.data.adminThemes,
            description:'Administration theme [NOT YET IMPLEMENTED]'
          },{            
            name:'theme:default',
            type:'hidden'
          }          
        ]
      },
      {
        id:'form-section-logging',
        label:'Logging',
        fields:[
          {
            label:'Console Logging',
            name:'logging:console:enabled',
            type:'checkbox',
            labelFirst: true,
            description:'Enable logging to the console.'
          },
          {
            label:'Console Log Level',
            name:'logging:console:level',
            type:'select',
            options: calipso.data.loglevels,
            description:'Log level that controls verbosity of display on the console.'
          },
          {
            label:'Console Timestamp',
            name:'logging:console:timestamp',
            type:'checkbox',
            labelFirst: true,
            description:'Prepend timestamps to console logs.'
          },
          {
            label:'Console Colorize',
            name:'logging:console:colorize',
            type:'checkbox',
            labelFirst: true,
            description:'Show colors on the console logs'
          },
          {
            label:'File Logging',
            name:'logging:file:enabled',
            type:'checkbox',
            labelFirst: true
          },
          {
            label:'File Log Level',
            name:'logging:file:level',
            type:'select',
            options: calipso.data.loglevels,
            description:'Log level that controls verbosity of display in the file logs.'
          },
          {
            label:'File Log Path',
            name:'logging:file:filepath',
            type:'text',
            description:'Path to create the file logs.'
          },
          {
            label:'File Log Timestamp',
            name:'logging:file:timestamp',
            type:'checkbox',
            labelFirst: true,
            description:'Prepend timestamps to file logs.'
          }
        ]
      },
      {
        id:'form-section-modules',
        label:'Modules',
        fields:[] // populated in a loop just below
      }
    ],
    fields:[
      {
        label:'',
        name:'returnTo',
        type:'hidden'
      }
    ],
    buttons:[
      {
        name:'submit',
        type:'submit',
        value:'Save Configuration'
      },
     {name:'cancel',type:'button',href:'/admin', value:'Cancel'}
    ]
  };

  // Values can come straight off the config.
  var values = calipso.config;

  var adminModuleFields = adminForm.sections[5].fields;
  createModuleFields(adminModuleFields);
  
  res.layout = 'admin';

  calipso.form.render(adminForm, values, req, function(form) {
    calipso.theme.renderItem(req, res, form, block, {}, next);
  });

}


/**
 * Create a form field for a module
 */
function createModuleFields(formFields) {

  var readonlyModules = ["admin","user","content","contentTypes"]; // Modules that cant be disabled
  var tempModuleFields = {};

  // load up the tempModuleFields (according to module category)
  for(var moduleName in calipso.modules) {    

    var cM = {};
    var module = calipso.modules[moduleName];       
    
    if(module.about) {
      var moduleDisplayName = module.about.label ? module.about.label : module.about.name;

      cM.label = moduleDisplayName;
      cM.name = 'modules:'+ moduleName + ":enabled";
      // cM.checked = module.enabled;
      cM.type = 'checkbox';
      if(calipso.lib._.indexOf(readonlyModules,moduleName) !== -1) {
       cM.readonly = true;
      }
      cM.description = module.about ? module.about.description : '<span class="error">' + moduleName + ' is missing its package.json file</span>';

      //adminModuleFields[moduleFieldMap[module.type]].fields.push(cM);    
      tempModuleFields[module.type] = tempModuleFields[module.type] || [];      
      tempModuleFields[module.type].push(cM);  
      
    } else {
      
      calipso.error("Module: " + moduleName + " @ " + module.path + ", appears to be invalid, it will not be shown in the configuration form.");
      
    }
    
  }

  for(moduleType in tempModuleFields) {      
    var moduleTypeFields = tempModuleFields[moduleType];
    // "Site" modules fieldset will only show up if there are any to show.
    if(moduleTypeFields.length){
      formFields.push({
        type: 'fieldset',
        name: moduleType + '_fieldset', // shouldn't need a name ...
        legend: moduleType,
        fields: moduleTypeFields
      });
    }
  };

  // sort modules
  function moduleSort(a, b){
    return a.name < b.name ? -1 : 1;
  }

  for(var i=0;i<formFields.length;i++){
    if(formFields[i].fields && formFields[i].fields.length){
      formFields[i].fields.sort(moduleSort);
    }
  }

  return formFields;

}

/**
 * Display the reload administration block
 */
function reloadAdmin(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {},next);

}

/**
 * Save the modified configuration details on submission
 */
function saveAdmin(req, res, template, block, next) {

  calipso.form.process(req, function(config) {

    if (config) {

      calipso.e.pre_emit('CONFIG_UPDATE',config,function(config) {

        // Update the configuration
        updateConfiguration(config);
        // updateEnabledModules(config);     

        calipso.config.save(function(err) {
          if(err) {
            
            req.flash('error', req.t('Could not save the updated configuration, there was an error: ' + err.message));
            res.redirect('/admin/core/config');
            
          } else {
            
            // Set the reload config flag for event handler to pick up
            calipso.e.post_emit('CONFIG_UPDATE',config,function(config) {       
                                              
              req.flash('info', req.t('Changes to configuration saved.'));
              res.redirect('/admin');
              next();                
              
            });
            
          }
        });
        
      });
   
    } else {

      req.flash('error', req.t('Could not process the updated configuration.'));
      res.redirect('/admin/core/config');
      next();

    }

  });

}

/**
 * Process the core config and enable / disable modules
 */
function updateEnabledModules(form) {
  // todo ?
}

/**
 * Display the cache
 */
function showCache(req,res,template,block,next) {
    
  calipso.theme.renderItem(req, res, template, block, {
    cache: calipso.cache.cache
  },next);
  
}


/**
 * Display the cache
 */
function clearCache(req,res,template,block,next) {
  calipso.cache.clear(function() {
    calipso.theme.renderItem(req, res, template, block, {
      cache: calipso.cache.cache
    },next);
  });
}
