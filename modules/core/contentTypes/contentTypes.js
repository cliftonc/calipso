/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query;

/**
 * Define the routes that this module will repsond to.
 */
var routes = [
  {path:'GET /content/type', fn:listContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), template:'list', block:'content.type.show'},
  {path:'GET /content/type/list.:format?', fn:listContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), template:'list', block:'content.type.list'},
  {path:'POST /content/type/create', fn:createContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:create")},
  {path:'GET /content/type/new', fn:createContentTypeForm, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:create"), block:'content.type.new', template:'form'},
  {path:'GET /content/type/show/:id.:format?', fn:showContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), template:'show', block:'content.type.show'},
  {path:'GET /content/type/edit/:id', fn:editContentTypeForm, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:update"), block:'content.type.edit'},
  {path:'GET /content/type/delete/:id', fn:deleteContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:delete")},
  {path:'POST /content/type/update/:id', fn:updateContentType, admin:true, permit:calipso.permission.Helper.hasPermission("admin:content:type:update")}
]

/**
 * Exports
 */
exports = module.exports = {
  routes:routes,
  init:init,
  route:route,
  install:install
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  /**
   * Menu items
   */
  res.menu.admin.addMenuItem(req, {name:'Content Types', path:'cms/type', url:'/content/type', description:'Manage content types ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), icon:"icon-suitcase"});

  /**
   * Routing and Route Handler
   */
  module.router.route(req, res, next);

}

/**
 *Init
 */
function init(module, app, next) {

  // Register events for the Content Module
  calipso.e.addEvent('CONTENT_TYPE_CREATE');
  calipso.e.addEvent('CONTENT_TYPE_UPDATE');
  calipso.e.addEvent('CONTENT_TYPE_DELETE');
  calipso.e.addEvent('CONTENT_TYPE_MAP_FIELDS');

  // Register event listeners
  calipso.e.post('CONTENT_TYPE_CREATE', module.name, storeContentTypes);
  calipso.e.post('CONTENT_TYPE_UPDATE', module.name, storeContentTypes);
  calipso.e.post('CONTENT_TYPE_DELETE', module.name, storeContentTypes);

  calipso.e.post('CONTENT_TYPE_CREATE', module.name, updateContentAfterChange);
  calipso.e.post('CONTENT_TYPE_UPDATE', module.name, updateContentAfterChange);

  calipso.e.pre('CONTENT_TYPE_CREATE', module.name, compileTemplates);
  calipso.e.pre('CONTENT_TYPE_UPDATE', module.name, compileTemplates);

  // Define permissions
  calipso.permission.Helper.addPermission("admin:content:type", "Content Types", true);

  // Schemea
  var ContentType = new calipso.lib.mongoose.Schema({
    contentType:{type:String, required:true, unique:true, "default":'default', index:true},
    description:{type:String, required:true, "default":'Default Content Type'},
    layout:{type:String, required:true, "default":'default'},
    ispublic:{type:Boolean, required:true, "default":true},
    created:{ type:Date, "default":Date.now },
    updated:{ type:Date, "default":Date.now },
    fields:{type:String, "default":""},
    templateLanguage:{type:String, required:true, "default":'html'},
    viewTemplate:{type:String, "default":''},
    listTemplate:{type:String, "default":''}
  });

  calipso.db.model('ContentType', ContentType);

  // Cache the content types in the calipso.data object
  if (app.config.get('installed')) {
    storeContentTypes(null, null, function () {
      module.initialised = true;
      next();
    });
  } else {
    module.initialised = true;
    next();
  }
}

/**
 * Installation process - asynch
 * @returns
 */
function install(next) {
  // Create the default content types
  var ContentType = calipso.db.model('ContentType');
  function saveItem(item, cb) {
    ContentType.findOne({contentType:item.contentType}, function (err, ct) {
      if (err) { return cb(err); }
      if (ct) { return cb(); }
      item.save(cb);
    });
  }
  var article = new ContentType({contentType:'Article',
    description:'Standard page type used for most content.',
    layout:'default',
    ispublic:true
  });
  var block = new ContentType({contentType:'Block Content',
    description:'Content that is used to construct other pages in a page template via the getContent call, not visibile in the taxonomy or tag cloud.',
    layout:'default',
    ispublic:false
  });
  calipso.lib.step(
    function createDefaults() {
      saveItem(article, this.parallel());
      saveItem(block, this.parallel());
    },
    function allDone(err) {
      if (err) {
        next(err)
      } else {
        // Cache the content types in the calipso.data object
        storeContentTypes(null, null, function () {
        });
        calipso.info("Content types module installed ... ");
        next();
      }
    }
  );

}

/**
 * Content type create / edit form
 */
var contentTypeForm = {
  id:'FORM', title:'Form', type:'form', method:'POST', tabs:true, action:'/content/type',
  sections:[
    {id:'type-section', label:'Content Type', fields:[
      {label:'Content Type', name:'contentType[contentType]', type:'text', description:'Enter the name of the content type, it must be unique.', placeholder:"myNewContentType", required:true},
      {label:'Description', name:'contentType[description]', type:'text', description:'Enter a description.', placeholder:"Serves as a..."},
      {label:'Layout', name:'contentType[layout]', type:'select', options:function () {
        return calipso.theme.getLayoutsArray()
      }, description:'Select the layout from the active theme used to render this type, choose default if unsure!'},
      {label:'Is Public', name:'contentType[ispublic]', type:'select', options:["Yes", "No"], description:"Public content types appear in lists of content; private types are usually used as components in other pages."}
    ]},
    {id:'type-custom-fields', label:'Custom Fields', fields:[
      {label:'Custom Fields Definition', name:'contentType[fields]', type:'json', description:"Define any custom fields using the Calipso form language, see the help below.", placeholder:"Custom fields here >>"}
    ]},
    {id:'type-custom-templates', label:'Custom Templates', fields:[
      {label:'Template Language', name:'contentType[templateLanguage]', type:'select', options:[
        {label:"EJS", value:"html"},
        {label:"Jade", value:"jade"}
      ], description:"Select the template language to use (if you are over-riding the default templates using the fields below)."},
      {label:'List Template', name:'contentType[listTemplate]', type:'textarea', description:"NOT YET IMPLEMENTED: Define the template used when listing groups of content of this type, leave blank for default.", placeholder:"put template here"},
      {label:'View Template', name:'contentType[viewTemplate]', type:'textarea', description:"Define the template to display a single item of this type, leave blank for default.", placeholder:"Put template here >>"}
    ]}
  ],
  buttons:[
    {name:'submit', type:'submit', value:'Save Content Type'},
    {name:'cancel', type:'button', href:'/content/type', value:'Cancel'}
  ]
};

/**
 * Create new content type
 */
function createContentType(req, res, template, block, next) {

  calipso.form.process(req, function (form) {

    if (form) {

      var ContentType = calipso.db.model('ContentType');

      var c = new ContentType(form.contentType);
      c.ispublic = form.contentType.contentType.ispublic === "Yes" ? true : false;

      var saved;

      calipso.e.pre_emit('CONTENT_TYPE_CREATE', c, function (c) {

        c.save(function (err) {

          if (err) {
            req.flash('error', req.t('Could not save content type because {msg}.', {msg:err.message}));
            if (res.statusCode != 302) {
              res.redirect('/content/type/new');
            }
            next();

          } else {
            calipso.e.post_emit('CONTENT_TYPE_CREATE', c, function (c) {
              res.redirect('/content/type');
              next();
            });
          }

        });

      });

    }
  });

}

/**
 * Create new content type
 */
function createContentTypeForm(req, res, template, block, next) {

  contentTypeForm.title = "Create Content Type";
  contentTypeForm.action = "/content/type/create";

  calipso.form.render(contentTypeForm, null, req, function (form) {
    calipso.theme.renderItem(req, res, template, block, {form:form}, next);
  });

}

/**
 * Edit content type
 */
function editContentTypeForm(req, res, template, block, next) {

  var ContentType = calipso.db.model('ContentType');
  var id = req.moduleParams.id;
  var item;

  res.menu.adminToolbar.addMenuItem(req, {name:'List', path:'list', url:'/content/type/', description:'List all ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), icon:"icon-list-3"});
  res.menu.adminToolbar.addMenuItem(req, {name:'View', path:'show', url:'/content/type/show/' + id, description:'Current item ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), icon:"icon-file"});
  res.menu.adminToolbar.addMenuItem(req, {name:'Edit', path:'edit', url:'/content/type/edit/' + id, description:'Edit content type ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:edit"), icon:"icon-pencil-2"});
  res.menu.adminToolbar.addMenuItem(req, {name:'Delete', path:'delete', url:'/content/type/delete/' + id, description:'Delete content type ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:delete"), icon:"icon-file-remove"});

  ContentType.findById(id, function (err, c) {

    if (err || c === null) {

      res.statusCode = 404;
      next();

    } else {

      contentTypeForm.title = "Edit Content Type";
      contentTypeForm.action = "/content/type/update/" + id;

      var values = {
        contentType:c
      }
      values.contentType.ispublic = c.ispublic ? "Yes" : "No";

      calipso.form.render(contentTypeForm, values, req, function (form) {
        calipso.theme.renderItem(req, res, form, block, {}, next);
      });

    }

  });

}

/**
 * Update a content type
 */
function updateContentType(req, res, template, block, next) {

  calipso.form.process(req, function (form) {

    if (form) {

      var ContentType = calipso.db.model('ContentType');
      var id = req.moduleParams.id;

      ContentType.findById(id, function (err, c) {
        if (!err && c) {

          var fields = c.fields,
            updatedFields = fields,
            formData = {form: form, json: ''};
          calipso.e.pre_emit('CONTENT_TYPE_MAP_FIELDS', formData, function (formData) {
            updatedFields = formData.json;
          });
          calipso.form.mapFields(form.contentType, c);
          if (c.fields == fields && updatedFields != fields) {
            c.fields = updatedFields;
          }
          c.ispublic = form.contentType.ispublic === "Yes" ? true : false;
          c.updated = new Date();

          calipso.e.pre_emit('CONTENT_TYPE_UPDATE', c, function (c) {

            c.save(function (err) {
              if (err) {
                req.flash('error', req.t('Could not update content type because {msg}.', {msg:err.message}));
                if (res.statusCode != 302) {
                  // Don't redirect if we already are, multiple errors
                  res.redirect('/content/type/edit/' + id);
                }
                next();
              } else {
                calipso.e.post_emit('CONTENT_TYPE_UPDATE', c, function (c) {
                  res.redirect('/content/type/show/' + id);
                  next();
                });
              }
            });
          });
        } else {
          req.flash('error', req.t('Could not locate that content type.'));
          res.redirect('/content/type');
          next();
        }
      });
    }

  });
}

/**
 * Show content type
 */
function showContentType(req, res, template, block, next) {

  var item;

  var ContentType = calipso.db.model('ContentType');
  var id = req.moduleParams.id;
  format = req.moduleParams.format || 'html';

  ContentType.findById(id, function (err, content) {

    if (err || content === null) {
      item = {id:'ERROR', type:'content', meta:{title:"Not Found!", content:"Sorry, I couldn't find that content type!"}};

    } else {

      res.menu.adminToolbar.addMenuItem(req, {name:'List', path:'list', url:'/content/type/', description:'List all ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), icon:"icon-list-3"});
      res.menu.adminToolbar.addMenuItem(req, {name:'View', path:'show', url:'/content/type/show/' + id, description:'Current item ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:view"), icon:"icon-file"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Edit', path:'edit', url:'/content/type/edit/' + id, description:'Edit content type ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:edit"), icon:"icon-pencil-2"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Delete', path:'delete', url:'/content/type/delete/' + id, description:'Delete content type ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:delete"), icon:"icon-file-remove"});

      item = {id:content._id, type:'content', meta:content.toObject()};

    }

    // Check to see if fields are valid json
    item.meta['fieldsValid'] = 'Yes';
    try {
      if (item.meta.fields) {
        JSON.parse(item.meta.fields)
      }
    }
    catch (ex) {
      item.meta['fieldsValid'] = 'No - ' + ex.message;
    }

    // Set the page layout to the content type
    if (format === "html") {
      calipso.theme.renderItem(req, res, template, block, {item:item}, next);
    }

    if (format === "json") {
      res.format = format;
      res.send(content.toObject());
      next();
    }

  });

}

/**
 * List all content types
 */
function listContentType(req, res, template, block, next) {

  // Re-retrieve our object
  var ContentType = calipso.db.model('ContentType');

  res.menu.adminToolbar.addMenuItem(req, {name:'New Type', path:'new', url:'/content/type/new', description:'Create content type ...', permit:calipso.permission.Helper.hasPermission("admin:content:type:create"), icon:"icon-file-add"});

  var format = req.moduleParams.format || 'html';

  var query = new Query();

  // Initialise the block based on our content
  ContentType.count(query, function (err, count) {

    var total = count;

    ContentType.find(query)
      .sort('contentType')
      .find(function (err, contents) {

        // Render the item into the response
        if (format === 'html') {
          calipso.theme.renderItem(req, res, template, block, {items:contents}, next);
        }

        if (format === 'json') {
          res.format = format;
          res.send(contents.map(function (u) {
            return u.toObject();
          }));
          next();
        }

      });

  });

}

/**
 * Delete a content type
 * TODO - deal with referential integrity
 */
function deleteContentType(req, res, template, block, next) {

  var ContentType = calipso.db.model('ContentType');
  var id = req.moduleParams.id;

  ContentType.findById(id, function (err, c) {

    calipso.e.pre_emit('CONTENT_TYPE_DELETE', c);

    ContentType.remove({_id:id}, function (err) {
      if (err) {
        req.flash('info', req.t('Unable to delete the content type because {msg}.', {msg:err.message}));
        res.redirect("/content/type");
      } else {
        calipso.e.post_emit('CONTENT_TYPE_DELETE', c);
        req.flash('info', req.t('The content type has now been deleted.'));
        res.redirect("/content/type");
      }
      next();
    });

  });

}

/**
 * Compile any custom templates and load them into the theme cache
 */
function compileTemplates(event, contentType, next) {

  var type = contentType.contentType,
    template = contentType.templateLanguage,
    list = contentType.listTemplate,
    view = contentType.viewTemplate;

  calipso.theme.cache.contentTypes = calipso.theme.cache.contentTypes || {};
  delete calipso.theme.cache.contentTypes[type];
  calipso.theme.cache.contentTypes[type] = {};

  if (list) {
    try {
      var templateFn = calipso.theme.compileTemplate(list, null, template);
      calipso.theme.cache.contentTypes[type].list = templateFn;
    }
    catch (ex) {
      calipso.error("Error compile list template for type '" + type + "', message: " + ex.message);
    }
  }

  if (view) {
    try {
      var templateFn = calipso.theme.compileTemplate(view, null, template);
      calipso.theme.cache.contentTypes[type].view = templateFn;
    }
    catch (ex) {
      calipso.error("Error compile view template for type '" + type + "', message: " + ex.message);
    }
  }

  next(contentType);

}

/**
 * Store content types in calipso.data cache
 */
function storeContentTypes(event, contentType, next) {

  var ContentType = calipso.db.model('ContentType');

  delete calipso.data.contentTypes;
  calipso.data.contentTypes = [];

  ContentType.find({}).sort('contentType').find(function (err, types) {
    if (err || !types) {

      // Don't throw error, just pass back failure.
      calipso.error("Error storing content types in cache: " + err.message);
      return next(contentType);

    } else {
      types.forEach(function (type) {

        calipso.data.contentTypes.push(type.contentType);

        // If this is part of the start up process, lets compile all the templates
        if (event === null) {
          compileTemplates(null, type, function () {
          });
        }

      });

      return next(contentType);
    }
  });

}

/**
 * Hook to update content after change
 * TODO
 */
function updateContentAfterChange(event, contentType, next) {

  // TODO
  // Referential integrity update
  return next(contentType);

}
