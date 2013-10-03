/*!
 * Core administration module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  crypto = require("crypto"),

  exports = module.exports = {
    init:init,
    route:route,
    first:true // Admin must run before all else
  };

var readonlyModules = ["admin", "user", "content", "contentTypes", "permissions", "checkbox", "field", "hidden", "text"]; // Modules that cant be disabled

/*
 * Router
 */
function route(req, res, module, app, next) {

  // Config helpers
  var corePermit = "admin:core:configuration",
    modulePermit = "admin:module:configuration",
    cachePermit = "admin:core:cache";

  // Menu items
  res.menu.admin.addMenuItem(req, {name:'Administration', path:'admin', url:'/admin', description:'Calipso administration ...', permit:corePermit, icon:"icon-users"});
  res.menu.admin.addMenuItem(req, {name:'Core', path:'admin/core', url:'/admin', description:'Manage core settings for Calipso ...', permit:corePermit, icon:"icon-wrench"});
  res.menu.admin.addMenuItem(req, {name:'Configuration', path:'admin/core/config', url:'/admin/core/config', description:'Core configuration ...', permit:corePermit, icon:"icon-wrench"});
  res.menu.admin.addMenuItem(req, {name:'View Languages', path:'admin/core/languages', url:'/admin/core/languages', description:'Languages ...', permit:corePermit, icon:"icon-airplane"});
  if (typeof calipso.cache.clear === "function") { // cache module not activated, deactivate menu item (will appear - then fail - if permission exist and module deactivated)
    // WTF Thought : cache module related code should not be here at all
    res.menu.admin.addMenuItem(req, {name:'View Cache', path:'admin/core/cache', url:'/admin/core/cache', description:'Cache ...', permit:cachePermit, icon:"icon-view-2"});
    res.menu.admin.addMenuItem(req, {name:'Clear Cache', path:'admin/core/cache/clear', url:'/admin/core/cache/clear', description:'Clear Cache ...', permit:cachePermit, icon:"icon-refresh"});
  }
  res.menu.admin.addMenuItem(req, {name:'Modules', path:'admin/modules', url:'/admin', description:'Manage module settings ...', permit:modulePermit, icon:"icon-layout"});

  // Routing and Route Handler
  module.router.route(req, res, next);

}

/*
 * Initialisation
 */
function init(module, app, next) {

  // Initialise administration events - enabled for hook.io
  calipso.e.addEvent('CONFIG_UPDATE', {enabled:true});

  // Add listener to config_update
  calipso.e.post('CONFIG_UPDATE', module.name, calipso.reloadConfig);

  calipso.permission.Helper.addPermission("admin:core:configuration", "Manage core configuration.");
  calipso.permission.Helper.addPermission("admin:module:configuration", "Manage module configuration.");
  calipso.permission.Helper.addPermission("admin:core:cache", "View and clear cache.");

  // Admin routes
  calipso.lib.step(

    function defineRoutes() {

      // Permissions
      var corePermit = "admin:core:configuration",
        modulePermit = "admin:module:configuration",
        cachePermit = "admin:core:cache";

      // Core Administration dashboard
      module.router.addRoute('GET /admin', showAdmin, {
        template:'admin',
        block:'admin.show',
        admin:true,
        permit:corePermit
      }, this.parallel());

      module.router.addRoute('GET /admin/config.json', downloadConfig, {
        admin:true,
        permit:corePermit
      }, this.parallel());

      // Core configuration
      module.router.addRoute('GET /admin/core/config', coreConfig, {
        block:'admin.show',
        admin:true,
        permit:corePermit
      }, this.parallel());

      module.router.addRoute('POST /admin/core/config/save', saveAdmin, {
        admin:true,
        permit:corePermit
      }, this.parallel());
      if (typeof calipso.cache.clear === "function") { // same cause same reason (cf WTF)
        module.router.addRoute('GET /admin/core/cache', showCache, {
          admin:true,
          template:'cache',
          block:'admin.cache',
          permit:cachePermit
        }, this.parallel());
  
        module.router.addRoute('GET /admin/core/cache/clear', clearCache, {
          admin:true,
          template:'cache',
          block:'admin.cache',
          permit:cachePermit
        }, this.parallel());
      }
      module.router.addRoute('GET /admin/core/languages', showLanguages, { 
        admin:true,
        template:'languages',
        block:'admin.languages',
        permit:corePermit
      }, this.parallel());

      module.router.addRoute('GET /admin/modules', modulesConfig, {
        admin:true,
        block:'admin.show',
        permit:modulePermit
      }, this.parallel());

      module.router.addRoute('POST /admin/modules/save', saveModulesConfig, {
        admin:true,
        permit:modulePermit
      }, this.parallel());

      // Default installation routers - only accessible in install mode
      module.router.addRoute('GET /admin/install', install, null, this.parallel());
      module.router.addRoute('POST /admin/install', install, null, this.parallel());
      if (!process.env.MONGO_URI) {
        module.router.addRoute('POST /admin/installTest/mongo', installMongoTest, null, this.parallel());
      }
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
  if (req.moduleParams.translate) {

    var language = req.moduleParams.translate;
    var languageCache = req.languageCache[language];

    var gt = require('utils/googleTranslate');

    if (languageCache) {
      calipso.lib.step(
        function translateAll() {
          var group = this.group();
          for (var item in languageCache) {
            gt.googleTranslate(item, language, group());
          }
        },
        function allTranslated(err, translations) {

          if (err) {
            req.flash('error', req.t('There was an error translating that language because {msg}', {msg:err.message}));
          }

          if (!err && translations) {
            translations.forEach(function (translation) {
              req.languageCache[language][translation.string] = translation.translation;
            });
          }

          calipso.theme.renderItem(req, res, template, block, {
            languageCache:req.languageCache
          }, next);

        }
      )
    } else {

      req.flash('info', req.t('That language does not exist.'));
      calipso.theme.renderItem(req, res, template, block, {
        languageCache:req.languageCache
      }, next);

    }

  } else {

    calipso.theme.renderItem(req, res, template, block, {
      languageCache:req.languageCache
    }, next);

  }

}

var installPass = crypto.randomBytes(25).toString('base64');
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
  calipso.form.process(req, function (form) {

    if (form) {

      if (form.userStep) {
        // Store the user for later
        calipso.data.adminUser = form.user;
      } else {
        // Update the configuration
        updateConfiguration(form);
      }
      // Override install step
      installStep = form.installStep
      if (form.installPassword !== installPass) {
        installStep = 'welcome';
      }
    }
    
    // Process the installation
    switch (installStep) {
      case "welcome":
        console.log('Installation Password: "' + installPass + '" (inside quotes)');
        installWelcome(req, res, localNext);
        break;
      case "mongodb":
        installMongo(req, res, localNext);
        break;
      case "user":
        installUser(req, res, localNext);
        break;
      case "modules":
        installModules(req, res, localNext);
        break;
      case "finalise":
        doInstallation(req, res, localNext);
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
  for (value in values) {
    if (value !== 'installStep' && value !== 'userStep' && value !== 'returnTo' && value !== 'submit') {
      calipso.config.set(value, values[value]);
    }
  }
  return;
}

/**
 * Installation welcome screen - called by install router, not a routing function.
 */
function installWelcome(req, res, next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_welcome;

  var installPassword = {id:'install-welcome-form', title:'', type:'form', method:'POST', action:'/admin/install',
    fields:[
      {label:'Installation Password', name:'installPassword', cls:'database-uri', type:'text', description:'Enter the Installation Password output by calipso during startup. Check log file.', required:true},
      {label:'', name:'installStep', type:'hidden'}
    ],
    buttons:[]}; // Submitted via template

  var formValues = {
    install:{
      password:''
    },
    'installStep': process.env.MONGO_URI ? 'user' : 'mongodb'
  }

  calipso.form.render(installPassword, formValues, req, function (form) {
    calipso.theme.renderItem(req, res, template, 'admin.install.welcome', {form:form, needMongo:!process.env.MONGO_URI}, next);
  });
}

/**
 * Installation mongodb - called by install router, not a routing function.
 */
function installMongo(req, res, next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_mongo;

  // Create the form
  var mongoForm = {id:'install-mongo-form', title:'', type:'form', method:'POST', action:'/admin/install',
    fields:[
      {label:'MongoDB URI', name:'database:uri', cls:'database-uri', type:'text', description:'Enter the database URI, in the form: mongodb://servername:port/database', required:true, placeholder:"mongodb://servername:port/database"},
      {label:'', name:'installStep', type:'hidden'},
      {label:'', name:'installPassword', type:'hidden'}
    ],
    buttons:[]}; // Submitted via template

  var formValues = {
    database:{
      uri:calipso.config.get('database:uri')
    },
    'installStep':'user',
    installPassword: installPass
  }

  calipso.form.render(mongoForm, formValues, req, function (form) {
    calipso.theme.renderItem(req, res, template, 'admin.install.mongo', {form:form}, next);
  });

}

/**
 * Function to enable ajax testing of the mongo configuration
 */
function installMongoTest(req, res, template, block, next) {

  if (calipso.config.get('installed')) {
    res.format = "json";
    res.end(JSON.stringify({status:"Invalid Request"}), "UTF-8");
  }

  calipso.form.process(req, function (form) {

    var dbUri = form.dbUri;
    var output = {};

    if (dbUri) {
      calipso.storage.mongoConnect(dbUri, true, function (err, connected) {
        if (!err) {
          output.status = "OK";
        } else {
          output.status = "FAILED";
          output.message = "Failed to connect to MongoDB because: " + err.message;
        }
        res.format = "json";
        res.end(JSON.stringify(output), "UTF-8");
      });
    } else {
      output.status = "FAILED";
      output.message = "You need to provide a valid database uri, in the format described.";
      res.format = "json";
      res.end(JSON.stringify(output), "UTF-8");
    }

  });
}

/**
 * Installation user - called by install router, not a routing function.
 */
function installUser(req, res, next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_user;

  // Create the form
  // TODO - reference exported form from user module instead, this will be difficult to maintain
  var userForm = {
    id:'install-user-form', title:'', type:'form', method:'POST', action:'/admin/install',
    fields:[
      {label:'Username', name:'user[username]', cls:'username', type:'text', required:true, 'placeholder':"Your desired username"},
      {label:'Full Name', name:'user[fullname]', type:'text'},
      {label:'Email', name:'user[email]', type:'email', required:true, 'placeholder':"someone@gmail.com"},
      {label:'Language', name:'user[language]', type:'select', options:req.languages, required:true},
      // TODO : Select based on available
      {label:'Password', name:'user[password]', cls:'password', type:'password', required:true, placeholder:"Password"},
      {label:'Repeat Password', name:'user[check_password]', cls:'check_password', type:'password', required:true, placeholder:"Repeat Password"},
      {label:'', name:'installStep', type:'hidden'},
      {label:'', name:'userStep', type:'hidden'},
      {label:'', name:'installPassword', type:'hidden'}
    ],
    buttons:[]
  };

  var formValues = {
    user:(calipso.data.adminUser || {}), // Store here during install process
    'userStep':true,
    'installStep':'modules',
    installPassword: installPass
  }

  calipso.form.render(userForm, formValues, req, function (form) {
    calipso.theme.renderItem(req, res, template, 'admin.install.user', {form:form,needMongo:!process.env.MONGO_URI}, next);
  });

}

/**
 * Function to enable ajax testing of the mongo configuration
 */
function installUserTest(req, res, template, block, next) {

  if (calipso.config.get('installed')) {
    res.format = "json";
    res.end(JSON.stringify({status:"Invalid Request"}), "UTF-8");
  }

  calipso.form.process(req, function (form) {

    // Check to see if new passwords match
    var err;

    if (form.password != form.check_password) {
      err = new Error(req.t('Your passwords do not match.'));
    }

    // Check to see if new passwords are blank
    if (form.password === '') {
      err = new Error(req.t('Your password cannot be blank.'));
    }

    if (form.username === '') {
      err = new Error(req.t('Your username cannot be blank.'));
    }

    // Check to see if new passwords are blank
    if (form.email === '') {
      err = new Error(req.t('Your email cannot be blank.'));
    }

    var output = {};
    if (err) {
      output.status = "FAILED";
      output.message = "There was a problem because: " + err.message;
    } else {
      output.status = "OK";
    }
    res.format = "json";
    res.end(JSON.stringify(output), "UTF-8");

  });

}

/**
 * Install Modules - called by install router, not a routing function.
 */
function installModules(req, res, next) {

  // Manually grab the template
  var template = calipso.modules.admin.templates.install_modules;

  // Create the form
  var moduleForm = {id:'install-modules-form', title:'', type:'form', method:'POST', action:'/admin/install',
    fields:[
      {label:'', name:'installStep', type:'hidden'},
      {label:'', name:'installPassword', type:'hidden'}
    ],
    buttons:[]}; // Submitted via template

  //Add the modules
  moduleForm.fields = createModuleFields(moduleForm.fields);

  // Defaults
  var formValues = {
    modules:{},
    installStep:'finalise',
    installPassword:installPass
  };
  readonlyModules.forEach(function(e) {
    formValues.modules[e] = {
      enabled:true
    };
  });

  calipso.form.render(moduleForm, formValues, req, function (form) {
    calipso.theme.renderItem(req, res, template, 'admin.install.modules', {form:form,needMongo:!process.env.MONGO_URI}, next);
  });

}

function doInstallation(req, res, next) {

  // NOTE: User is installed via the user module

  // Set the install flag to true, enable db connection
  calipso.config.set('installed', true);
  calipso.storage.mongoConnect(function (err) {

    if (err) {
      return next(err);
    }

    // Note - the admin user is created in the user module install process
    calipso.lib.step(
      function saveConfiguration() {
        // Save configuration to file
        calipso.info("Saving configuration ... ");
        calipso.config.save(this);
      },
      function reloadConfiguration() {
        // This actually re-loads all of the modules
        calipso.info("Reloading updated configuration ... ");
        calipso.reloadConfig("ADMIN_INSTALL", calipso.config, this);
      },
      function installModules() {
        // TODO - this should just be part of enabling them the first time!

        var group = this.group();

        // Get a list of all the modules to install
        var modulesToInstall = [];
        for (var module in calipso.modules) {
          // Check to see if the module is currently enabled, if so install it
          if (calipso.modules[module].enabled && calipso.modules[module].fn && typeof calipso.modules[module].fn.install === 'function') {
            modulesToInstall.push(module);
          }
        }

        modulesToInstall.forEach(function (module) {
          calipso.info("Installing module " + module);
          calipso.modules[module].fn.install(group());
        });

      },
      function done(err) {

        res.redirect("/")
        return next(err);

      }
    );

  });

}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function showAdmin(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {}, next);

}

function downloadConfig(req, res, template, block, next) {
  if (process.env.MONGO_URI) {
    var Conf = calipso.db.model('Conf');
    Conf.findOne({environment:calipso.config.env}, function (err, conf) {
      if (err) return next(err);
      res.format = 'json';
      res.statusCode = 200;
      conf = conf.configuration;
      res.send(conf);
      next();
    });
  } else {
    fs.readFile(calipso.config.file, function (err, data) {
      if (err) return next(err);
      try {
        config = JSON.parse(data);
      }
      catch (e) {
        return next(e);
      }
      res.format = 'json';
      res.statusCode = 200;
      res.send(config);
      next();
    });
  }
}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function coreConfig(req, res, template, block, next) {

  calipso.data.themes = [];
  calipso.data.adminThemes = []; // TODO
  for (var themeName in calipso.availableThemes) {
    var theme = calipso.availableThemes[themeName];
    if (theme.about && theme.about.type) {
      if (theme.about.type === "full" || theme.about.type === "frontend") {
        calipso.data.themes.push(themeName);
      }
      if (theme.about.type === "full" || theme.about.type === "admin") {
        calipso.data.adminThemes.push(themeName);
      }
    }
    else {
      calipso.warn("Theme " + themeName + " not enabled due to missing type.  Is theme.json valid JSON?");
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
            type:'text',
            placeholder:"My Site Name",
            required:true
          },
          {
            label:'Login Path',
            name:'server:loginPath',
            type:'text',
            placeholder:"/"
          },
          {
            label:'Modules Location',
            name:'server:modulePath',
            type:'text'
          },
          {
            label:'Themes Location',
            name:'server:themePath',
            type:'text',
            placeholder:"./themes",
            required:true
          },
          {
            label:'Server URL',
            name:'server:url',
            type:'url',
            placeholder:"./themes",
            required:true
          },
          {
            label:'Session Secret',
            name:'session:secret',
            type:'password',
            placeholder:"http://localhost:3000",
            required:true
          },
          {
            label:'Session Max Age (seconds)',
            name:'session:maxAge',
            type:'text',
            placeholder:"960000"
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
            options:req.languages,
            required:true
          },
          {
            label:'Add Unknown Terms',
            name:'i18n:additive',
            type:'checkbox',
            labelFirst:true
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
                labelFirst:true
              },
              {
                label:'Default Cache TTL',
                name:'performance:cache:ttl',
                type:'text',
                description:'Default age (in seconds) for cache items.',
                placeholder:"96000"
              },
              {
                label:'Watch Template Files',
                name:'performance:watchFiles',
                type:'checkbox',
                labelFirst:true
              }
            ]
          },
          {
            label:'Clustering',
            legend:'Clustering',
            type:'fieldset',
            fields:[
              {
                label:'Number Workers',
                description:'Number of workers to start, set to 0 to have Calipso default to number of available cpus.',
                name:'server:cluster:workers',
                type:'text',
                placeholder:"ex: 600"
              },
              {
                label:'Restart Workers',
                name:'server:cluster:restartWorkers',
                description:'Automatically restart workers if they die.',
                type:'checkbox',
                labelFirst:true
              },
              {
                label:'Maximum Restarts',
                name:'server:cluster:maximumRestarts',
                description:'Number of failures before it will stop attempting to restart a worker.',
                type:'text',
                placeholder:"3"
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
                type:'text',
                placeholder:"500"
              }
            ]
          }
        ]
      },
      {
        id:'form-section-authentication',
        label:'Authentication',
        fields:[
          {
            label:'Password Login and Registration (changes require a restart of calipso)',
            legend:'Password Login and Registration (changes require a restart of calipso)',
            type:'fieldset',
            fields:[
              {
                label:'Enable password authentication and registration',
                type:'checkbox',
                name:'server:authentication:password',
                defaultValue:true,
                description:'Please make sure you have made an external user (google, facebook or twitter an admin account) so you don\'t lose access to your system.'
              },
              {
                label:'Enable password migration to pbkdf2 hash',
                type:'checkbox',
                name:'server:authentication:migrate2pbkdf2',
                description:'As new people create password hashes they will be converted to pbkdf2 hashes.'
              }
            ]
          },
          {
            label:'Facebook Authentication (changes require a restart of calipso)',
            legend:'Set this information to enable Facebook Authentication (changes require a restart of calipso)',
            type:'fieldset',
            fields:[
              {
                label:'AppId',
                description:'Set AppId and Secret to enable facebook authentication',
                name:'server:authentication:facebookAppId',
                type:'password',
                placeholder:"short number you could potentially memorize"
              },
              {
                label:'AppSecret',
                description:'AppSecret for this application to allow facebook authentication',
                name:'server:authentication:facebookAppSecret',
                type:'password',
                placeholder:"long-ass hash code that you would never memorize"
              }
            ]
          },
          {
            label:'Google Authentication (changes require a restart of calipso)',
            legend:'Set this information to enable Google Authentication (changes require a restart of calipso)',
            type:'fieldset',
            fields:[
              {
                label:'ClientId',
                description:'Set ClientId and ClientSecret to enable google authentication',
                name:'server:authentication:googleClientId',
                type:'password',
                placeholder:"short number you could potentially memorize"
              },
              {
                label:'ClientSecret',
                description:'ClientSecret for this application to allow google authentication',
                name:'server:authentication:googleClientSecret',
                type:'password',
                placeholder:"you could never memorize this"
              },
              {
                label:'Google Callback',
                description:'Callback URL for google authentication',
                type:'readonlytext',
                value:calipso.config.get('server:url') + '/auth/google/callback',
                placeholder:"Callback URL for google authentication"
              }
            ]
          },
          {
            label:'Twitter Authentication (changes require a restart of calipso)',
            legend:'Set this information to enable Twitter Authentication (changes require a restart of calipso)',
            type:'fieldset',
            fields:[
              {
                label:'Twitter ConsumerKey',
                description:'Set ConsumerKey and ConsumerSecret to allow twitter authentication',
                name:'server:authentication:twitterConsumerKey',
                type:'password',
                placeholder:"short number you could potentially memorize"
              },
              {
                label:'Twitter ConsumerSecret',
                description:'ConsumerSecret for this application to allow twitter authentication',
                name:'server:authentication:twitterConsumerSecret',
                type:'password',
                placeholder:"This is long, so copy-paste from Twitter"
              },
              {
                label:'Twitter Callback',
                description:'Callback URL for twitter authentication',
                type:'readonlytext',
                value:calipso.config.get('server:url') + '/auth/twitter/callback',
                placeholder:"Your callback URL here"
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
            options:calipso.data.themes,
            description:'Theme used for all web pages excluding admin pages'
          },
          {
            label:'Admin Theme',
            name:'theme:admin',
            type:'select',
            options:calipso.data.adminThemes,
            description:'Administration theme [NOT YET IMPLEMENTED]'
          },
          {
            name:'theme:default',
            type:'hidden'
          },
          {
            label:'Stylus Middleware',
            legend:'Stylus Middleware',
            type:'fieldset',
            fields:[
              {
                label:'Enable Stylus',
                type:'checkbox',
                defaultValue:false,
                name:'libraries:stylus:enable'
              },
              {
                label:'Show Warnings',
                type:'checkbox',
                defaultValue:false,
                name:'libraries:stylus:warn'
              },
              {
                label:'Compress CSS',
                type:'checkbox',
                defaultValue:false,
                name:'libraries:stylus:compress'
              }
            ]
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
            labelFirst:true,
            description:'Enable logging to the console.'
          },
          {
            label:'Console Log Level',
            name:'logging:console:level',
            type:'select',
            options:calipso.data.loglevels,
            description:'Log level that controls verbosity of display on the console.'
          },
          {
            label:'Console Timestamp',
            name:'logging:console:timestamp',
            type:'checkbox',
            labelFirst:true,
            description:'Prepend timestamps to console logs.'
          },
          {
            label:'Console Colorize',
            name:'logging:console:colorize',
            type:'checkbox',
            labelFirst:true,
            description:'Show colors on the console logs'
          },
          {
            label:'File Logging',
            name:'logging:file:enabled',
            type:'checkbox',
            labelFirst:true
          },
          {
            label:'File Log Level',
            name:'logging:file:level',
            type:'select',
            options:calipso.data.loglevels,
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
            labelFirst:true,
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
      {
        name:'cancel',
        type:'button',
        href:'/admin',
        value:'Cancel'
      },
      {
        name:'download',
        type:'button',
        href:'/admin/config.json',
        value:'Download JSON'
      }
    ]
  };

  // Values can come straight off the config.
  var values = calipso.config;

  var adminModuleFields = adminForm.sections[6].fields;
  createModuleFields(adminModuleFields);

  res.layout = 'admin';

  calipso.form.render(adminForm, values, req, function (form) {
    calipso.theme.renderItem(req, res, form, block, {}, next);
  });

}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function modulesConfig(req, res, template, block, next) {

  var moduleName = req.query.module || '';

  if (!moduleName || !calipso.modules[moduleName]) {
    req.flash('error', 'You need to specify a valid module.');
    res.redirect('/admin');
    return next();
  }

  var configForm = {
    id:'module-config-form',
    title:'Configure: ' + moduleName,
    type:'form',
    method:'POST',
    action:'/admin/modules/save',
    tabs:false,
    fields:[
      {
        label:'',
        value:moduleName,
        name:'moduleName',
        type:'hidden'
      }
    ],
    buttons:[
      {
        name:'submit',
        type:'submit',
        value:'Save Configuration'
      },
      {
        name:'cancel',
        type:'button',
        href:'/admin',
        value:'Cancel'
      }
    ]
  };

  // Values can come straight off the config.
  var values = calipso.config.getModuleConfig(moduleName);

  // Fields come from the module
  var config = calipso.modules[moduleName].fn.config;

  calipso.lib._.keys(config).forEach(function (key) {
    var field = {};
    field.label = config[key].label || key;
    field.name = key;

    if (config[key].type) {

      field.type = config[key].type;

      // select boxes
      if (config[key].options) {
        field.options = config[key].options;
      }

    } else {
      // infer from value
      if (typeof values[key] === 'boolean') {
        field.type = 'checkbox';
        field.labelFirst = true;
      } else {
        field.type = 'text';
      }
    }

    field.description = config[key].description || '';
    configForm.fields.push(field);
  })

  res.layout = 'admin';

  calipso.form.render(configForm, values, req, function (form) {
    calipso.theme.renderItem(req, res, form, block, {}, next);
  });

}

/**
 * Save module configuratino
 */
function saveModulesConfig(req, res, template, block, next) {

  calipso.form.process(req, function (moduleConfig) {

    if (moduleConfig) {

      var moduleName = moduleConfig.moduleName;

      // Clean the submitted object
      delete moduleConfig.moduleName
      delete moduleConfig.submit

      calipso.config.setModuleConfig(moduleName, '', moduleConfig);

      calipso.e.pre_emit('CONFIG_UPDATE', {module:moduleName, config:moduleConfig}, function (config) {

        calipso.config.save(function (err) {

          if (err) {

            req.flash('error', req.t('Could not save the updated configuration, there was an error: ' + err.message));
            res.redirect('/admin/modules?module=' + moduleName);

          } else {

            // Set the reload config flag for event handler to pick up
            calipso.e.post_emit('CONFIG_UPDATE', {module:moduleName, config:moduleConfig}, function (config) {

              req.flash('info', req.t('Changes to configuration saved.'));
              res.redirect('/admin');
              next();

            });

          }
        });

      });

    } else {

      req.flash('error', req.t('Could not process the updated module configuration.'));
      res.redirect('/admin');
      next();

    }

  });
}

/**
 * Create a form field for a module
 */
function createModuleFields(formFields) {

  var tempModuleFields = {};

  // load up the tempModuleFields (according to module category)
  for (var moduleName in calipso.modules) {

    var cM = {};
    var module = calipso.modules[moduleName];

    if (module.about) {
      var moduleDisplayName = module.about.label ? module.about.label : module.about.name;

      cM.label = moduleDisplayName;
      cM.name = 'modules:' + moduleName + ":enabled";
      // cM.checked = module.enabled;
      cM.type = 'checkbox';
      if (calipso.lib._.indexOf(readonlyModules, moduleName) !== -1) {
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

  for (moduleType in tempModuleFields) {
    var moduleTypeFields = tempModuleFields[moduleType];
    // "Site" modules fieldset will only show up if there are any to show.
    if (moduleTypeFields.length) {
      formFields.push({
        type:'fieldset',
        name:moduleType + '_fieldset', // shouldn't need a name ...
        legend:moduleType,
        fields:moduleTypeFields
      });
    }
  }

  // sort modules
  function moduleSort(a, b) {
    return a.name < b.name ? -1 : 1;
  }

  for (var i = 0; i < formFields.length; i++) {
    if (formFields[i].fields && formFields[i].fields.length) {
      formFields[i].fields.sort(moduleSort);
    }
  }

  return formFields;

}

/**
 * Display the reload administration block
 */
function reloadAdmin(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {}, next);

}

/**
 * Save the modified configuration details on submission
 */
function saveAdmin(req, res, template, block, next) {

  calipso.form.process(req, function (config) {

    if (config) {

      calipso.e.pre_emit('CONFIG_UPDATE', config, function (config) {

        // Update the configuration
        updateConfiguration(config);
        // updateEnabledModules(config);

        calipso.config.save(function (err) {
          if (err) {

            req.flash('error', req.t('Could not save the updated configuration, there was an error: ' + err.message));
            res.redirect('/admin/core/config');
            next();

          } else {

            // Set the reload config flag for event handler to pick up
            calipso.e.post_emit('CONFIG_UPDATE', config, function (config) {

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
function showCache(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {
    cache:calipso.cache.cache
  }, next);

}

/**
 * Display the cache
 */
function clearCache(req, res, template, block, next) {
  calipso.cache.clear(function () {
    calipso.theme.renderItem(req, res, template, block, {
      cache:calipso.cache.cache
    }, next);
  });
}
