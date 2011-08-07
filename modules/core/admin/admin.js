/*!
 * Core administration module
 */
var calipso = require("lib/calipso");

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

    module.router.addRoute('GET /admin/core/config/reload', reloadAdmin, {
      template: 'reload',
      block: 'admin.reload',
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


    // Default installation router
    module.router.addRoute('GET /admin/install', install, null, this.parallel());


  }, function done() {

    // Shortcuts
    calipso.data.loglevels = calipso.lib.winston.config.npm.levels;
    calipso.data.modules = calipso.modules; // TODO - why do we need this?
    next();


  });

  // NOTE: Configuration schemas are defined in Configuration.js
}


/**
 * Show languages stored in memory,
 * optionally enable translation of these by google translate.
 */
function showLanguages(req, res, template, block, next) {



  //res.menu.admin.secondary.push({ name: req.t('Configuration'),url: '/admin/core/config',regexp: /admin\/config/});
  //res.menu.admin.secondary.push({ name: req.t('Languages'),url: '/admin/core/languages',regexp: /admin\/admin/});
  //res.menu.admin.secondary.push({ name: req.t('Cache'),url: '/admin/core/cache',regexp: /admin\/cache/});



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
  if (!calipso.app.set('config').install) {
    res.redirect("/");
    next();
    return;
  }

  // Run the module install scripts
  calipso.lib.step(

  function installModules() {
    var group = this.group();
    for (var module in calipso.modules) {
      // Check to see if the module is currently enabled, if so install it
      if (calipso.modules[module].enabled && typeof calipso.modules[module].fn.install === 'function') {
        calipso.modules[module].fn.install(group());
      } else {
        // Just call the group function to enable step to continue
        group()();
      }
    }
  }, function done(err) {

    // If we encounter any issues it must be catastrophic.
    if (err) {
      res.statusCode = 500;
      res.errorMessage = err.message;
      req.flash('error', req.t('Calipso has become stuck in install mode. This is a catastrophic failure, please report it on github.'));
      next()
      return;
    }

    // Retrieve the configuration from the database
    var AppConfig = calipso.lib.mongoose.model('AppConfig');
    AppConfig.findOne({}, function(err, c) {

      calipso.app.set('config').install = false;
      c.install = false;
      c.save(function(err) {
        if (err) {
          res.statusCode = 500;
          res.errorMessage = err.message;
          req.flash('error', req.t('Calipso has become stuck in install mode. This is a catastrophic failure, please report it on github.'));
        } else {
          req.flash('info', req.t('Calipso has been installed with default user: {user}, password: {password}.  It is a good idea to login and change this via the user profile page.',
                                  {user:'admin',password:'password'}));
          if (res.statusCode != 302) {
            res.redirect("/");
          }
        }

        next();
        return;

      });
    });

  })

}


/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function showAdmin(req, res, template, block, next) {

  //res.menu.admin.secondary.push({ name: req.t('Configuration'),url: '/admin/core/config',regexp: /admin\/config/});
  //res.menu.admin.secondary.push({ name: req.t('Languages'),url: '/admin/core/languages',regexp: /admin\/admin/});
  //res.menu.admin.secondary.push({ name: req.t('Cache'),url: '/admin/core/cache',regexp: /admin\/cache/});

  calipso.theme.renderItem(req, res, template, block, {},next);

}

/**
 * Show the current configuration
 * TODO Refactor this to a proper form
 */
function coreConfig(req, res, template, block, next) {

  // Temporary data for form
  calipso.data.loglevels = [];
  for(var level in calipso.lib.winston.config.npm.levels){
    calipso.data.loglevels.push(level);
  }

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


  var AppConfig = calipso.lib.mongoose.model('AppConfig');

  AppConfig.findOne({}, function(err, config) {
    var item = {
      id: config._id,
      type: 'config',
      meta: config.toObject()
    };

    var values = {
      config: {
        cache:item.meta.cache,
        cacheTtl:item.meta.cacheTtl,
        watchFiles: item.meta.watchFiles,
        language: item.meta.language,
        theme: item.meta.theme,
        adminTheme: item.meta.adminTheme,
        logslevel: item.meta.logs.level,
        logsconsoleenabled:  item.meta.logs.console.enabled,
        logsfileenabled: item.meta.logs.file.enabled,
        logsfilefilepath: item.meta.logs.file.filepath
      }
    };

    var adminForm = {
      id:'admin-form',
      title:'Administration',
      type:'form',
      method:'POST',
      action:'/admin/core/config/save',
      tabs:true,
      sections:[
        {
          id:'form-section-development',
          label:'Development',
          fields:[
            {
              label:'Default Language',
              name:'config[language]',
              type:'select',
              value:item.meta.language,
              options: req.languages
            },
            {
              label:'Watch Template Files',
              name:'config[watchFiles]',
              type:'checkbox',
              value: item.meta.watchFiles,
              labelFirst: true
            }
          ]
        },
        {
          id:'form-section-performance',
          label:'Performance',
          fields:[
            {
              label:'Enable Cache',
              name:'config[cache]',
              type:'checkbox',
              description:'Experimental - will probably break things!',
              value: item.meta.cache,
              labelFirst: false
            },
            {
              label:'Default Cache TTL',
              name:'config[cacheTtl]',
              type:'textbox',
              description:'Default age (in seconds) for cache items.',
              value: item.meta.cacheTtl
            }
          ]
        },
        {
          id:'form-section-theme',
          label:'Theme',
          fields:[
            {
              label:'Frontend Theme',
              name:'config[theme]',
              type:'select',
              value:item.meta.theme,
              options: calipso.data.themes,
              description:'Theme used for all web pages excluding admin pages'
            },
            {
              label:'Admin Theme',
              name:'config[adminTheme]',
              type:'select',
              value:item.meta.adminTheme,
              options: calipso.data.adminThemes,
              description:'Administration theme [NOT YET IMPLEMENTED]'
            }
          ]
        },
        {
          id:'form-section-logging',
          label:'Logging',
          fields:[
            {
              label:'Log Level',
              name:'config[logslevel]',
              type:'select',
              value:item.meta.logs.level,
              options: calipso.data.loglevels
            },
            {
              label:'Console Logging',
              name:'config[logsconsoleenabled]',
              type:'checkbox',
              value: item.meta.logs.console.enabled,
              labelFirst: true
            },
            {
              label:'File Logging',
              name:'config[logsfileenabled]',
              type:'checkbox',
              value: item.meta.logs.file.enabled,
              labelFirst: true
            },
            {
              label:'File Log Path',
              name:'config[logsfilefilepath]',
              type:'text',
              value: item.meta.logs.file.filepath
            }
          ]
        },
        {
          id:'form-section-modules',
          label:'Modules',
          fields:[] // populated in a loop just below
        },
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
          value:'Save Content'
        }
      ]
    };


    // populate the Modules form fields
    // TODO - make this dynamic
    var adminModuleFields = adminForm.sections[4].fields;
    var tempModuleFields = {core:[],community:[],site:[],downloaded:[]};
    var readonlyModules = ["admin","user","content","contentTypes"]; // Modules that cant be disabled

    // load up the tempModuleFields (according to module category)
    for(var moduleName in calipso.modules) {
      var cM = {};
      var module = calipso.modules[moduleName];
      cM.label = moduleName;
      cM.name = 'config[modules]['+ moduleName +']';
      cM.checked = module.enabled;
      cM.type = 'checkbox';
      if(calipso.lib._.indexOf(readonlyModules,moduleName) !== -1) {
       cM.readonly = true;
      }

      cM.description = module.about ? module.about.description : '<span class="error">' + moduleName + ' is missing its package.json file</span>';

      //adminModuleFields[moduleFieldMap[module.type]].fields.push(cM);
      tempModuleFields[module.type].push(cM);
    }

    // add only non-empty fieldsets for module categories
    ['Core','Community','Site','Downloaded'].forEach(function(moduleType){
      var moduleTypeFields = tempModuleFields[moduleType.toLowerCase()];
      // "Site" modules fieldset will only show up if there are any to show.
      if(moduleTypeFields.length){
        adminModuleFields.push({
          type: 'fieldset',
          name: moduleType + '_fieldset', // shouldn't need a name ...
          legend: moduleType,
          fields: moduleTypeFields
        });
      }
    });

    // sort modules
    function moduleSort(a, b){
      return a.name < b.name ? -1 : 1;
    }

    for(var i=0;i<adminModuleFields.length;i++){
      if(adminModuleFields[i].fields.length){
        adminModuleFields[i].fields.sort(moduleSort);
      }
    }

    //console.log(values.config);
    res.layout = 'admin';

    // Test!
    calipso.form.render(adminForm, values, req, function(form) {
      calipso.theme.renderItem(req, res, form, block, {}, next);
    });
    // if you want to use ./templates/admin.html (must contain <%- form %>):
    //calipso.form.render(adminForm, incomingForm, req, function(form) {
    //  calipso.theme.renderItem(req, res, template, block, {form: form}, next);
    //});

    //console.log(item.meta.logs);
  });

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

  calipso.form.process(req, function(form) {

    if (form) {

      // Re-retrieve our object
      var AppConfig = calipso.lib.mongoose.model('AppConfig');

      AppConfig.findOne({}, function(err, c) {

        if (!err && c) {

          c.theme = form.config.theme;
          c.adminTheme = form.config.adminTheme;
          c.cache = form.config.cache;
          c.cacheTtl = form.config.cacheTtl;
          c.language = form.config.language;
          c.watchFiles = form.config.watchFiles;
          c.logs.level = form.config.logslevel;
          c.logs.file.enabled = form.config.logsfileenabled;
          c.logs.file.filepath = form.config.logsfilefilepath;
          c.logs.console.enabled = form.config.logsconsoleenabled;
          c.modules = moduleFormatToArray(res, form.config.modules);

          c.save(function(err) {
            if (err) {
              req.flash('error', req.t('Could not update the configuration because {msg}.',{msg:err.message}));
              if (res.statusCode != 302) { // Don't redirect if we already are, multiple errors
                res.redirect('/admin/core/config');
              }
            } else {
              calipso.config = c; // TODO : This wont work on multiple edits
              res.reloadConfig = true;
              res.redirect('/admin/core/config/reload');
            }
            next();
          });

        } else {
          req.flash('error', req.t('Could not load the application configuration, please check your database.'));
          res.redirect('/admin');
          next();

        }
      });

    } else {

      req.flash('error', req.t('Could not process the updated configuration.'));
      res.redirect('/admin/core/config');
      next();

    }

  });

}

/**
 *Convert the modules into an array to enable rendering to the form
 */
function moduleFormatToArray(res, modules) {

  var arrayModules = [];

  for (var module in calipso.modules) {
    var enabled = modules[module] === 'on';
    arrayModules.push({
      name: module,
      enabled: enabled
    });
  }

  return arrayModules;

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