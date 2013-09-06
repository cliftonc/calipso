/**
 * This is sub module called by user, to allow management of roles.
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  Query = require("mongoose").Query,
  calipso = require(path.join(rootpath, 'lib/calipso'));

module.exports = {
  init:init,
  route:route,
  install:install
}

/**
 * Define the routes that this module will repsond to.
 */
var routes = [
  {path:'GET /user/role', fn:listRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:view"), template:'role.list', block:'content.user.role.show'},
  {path:'GET /user/role/list.:format?', fn:listRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:view"), template:'role.list', block:'content.user.role.list'},
  {path:'POST /user/role/create', fn:createRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:create")},
  {path:'GET /user/role/new', fn:createRoleForm, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:create"), block:'content.user.role.new', template:'role.form'},
  {path:'GET /user/role/show/:id.:format?', fn:showRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:view"), template:'role.show', block:'content.user.role.show'},
  {path:'GET /user/role/edit/:id', fn:editRoleForm, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:update"), block:'content.user.role.edit'},
  {path:'GET /user/role/delete/:id', fn:deleteRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:delete")},
  {path:'POST /user/role/update/:id', fn:updateRole, admin:true, permit:calipso.permission.Helper.hasPermission("admin:user:role:update")}
]

/**
 * Router - not async
 */
function route(req, res, module, app) {

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Roles', path:'admin/security/roles', weight:10, url:'/user/role/list', description:'Manage roles ...', security:[] });

}

/**
 * Initialisation
 */
function init(module, app, next) {

  calipso.e.addEvent('USER_ROLE_CREATE');
  calipso.e.addEvent('USER_ROLE_UPDATE');
  calipso.e.addEvent('USER_ROLE_DELETE');

  calipso.permission.Helper.addPermission("admin:roles", "Roles", true);

  calipso.lib.async.map(routes, function (options, next) {
      module.router.addRoute(options, next)
    },
    function (err, data) {

      // Done adding routes
      var Role = new calipso.lib.mongoose.Schema({
        name:{type:String, required:true, unique:true},
        description:{type:String, "default":''},
        isAdmin:{type:Boolean, required:true, "default":false},
        isDefault:{type:Boolean, required:true, "default":false}
      });
      calipso.db.model('Role', Role);

      // Load roles into calipso data
      if (app.config.get('installed')) {
        storeRoles(null, null, next);
      } else {
        next(null);
      }

    });

  // Register event listeners
  calipso.e.post('USER_ROLE_CREATE', module.name, storeRoles);
  calipso.e.post('USER_ROLE_UPDATE', module.name, storeRoles);
  calipso.e.post('USER_ROLE_DELETE', module.name, storeRoles);

}

/**
 * Store roles in calipso.data cache
 */
function storeRoles(event, data, next) {

  var Role = calipso.db.model('Role');

  delete calipso.data.roleArray;
  delete calipso.data.roles;
  calipso.data.roleArray = [];
  calipso.data.roles = {};

  Role.find({}).sort('name').find(function (err, roles) {

    if (err || !roles) {
      // Don't throw error, just pass back failure.
      calipso.error(err);
    }

    // Create a role array and object cache
    roles.forEach(function (role) {
      calipso.data.roleArray.push(role.name);
      calipso.data.roles[role.name] = {description:role.description, isAdmin:role.isAdmin};
    });

    next();

  });

}

/**
 * Content type create / edit form
 */
var roleForm = {
  id:'FORM', title:'Role', type:'form', method:'POST', tabs:true, action:'/user/role',
  sections:[
    {id:'type-section', label:'Role', fields:[
      {label:'Role Name', name:'role[name]', type:'text', description:'Enter the name of the role, it must be unique.'},
      {label:'Role Description', name:'role[description]', type:'text', description:'Enter a description.'},
      {label:'Is Admin', name:'role[isAdmin]', type:'checkbox', labelFirst:true, description:"Is this role an administrative role (e.g. it can access everything)."},
      {label:'Is Default', name:'role[isDefault]', type:'checkbox', labelFirst:true, description:"Is this role assigned to any new users by default when they register."}
    ]
    }
  ],
  buttons:[
    {name:'submit', type:'submit', value:'Save Role'},
    {name:'cancel', type:'button', href:'/user/role', value:'Cancel'}
  ]
};

/**
 * Create new role
 */
function createRole(req, res, template, block, next) {

  calipso.form.process(req, function (form) {

    if (form) {

      var Role = calipso.db.model('Role');

      var c = new Role(form.role);
      var saved;

      calipso.e.pre_emit('USER_ROLE_CREATE', c, function (c) {

        c.save(function (err) {

          if (err) {
            req.flash('error', req.t('Could not save role because {msg}.', {msg:err.message}));
            if (res.statusCode != 302) {
              res.redirect('/user/role/new');
            }
            next();

          } else {
            calipso.e.post_emit('USER_ROLE_CREATE', c, function (c) {
              res.redirect('/user/role');
              next();
            });
          }

        });

      });

    }
  });

}

/**
 * Create new role
 */
function createRoleForm(req, res, template, block, next) {

  roleForm.title = "Create Role";
  roleForm.action = "/user/role/create";

  calipso.form.render(roleForm, null, req, function (form) {
    calipso.theme.renderItem(req, res, template, block, {form:form}, next);
  });

}

/**
 * Edit role
 */
function editRoleForm(req, res, template, block, next) {

  var Role = calipso.db.model('Role');
  var id = req.moduleParams.id;
  var item;

  res.menu.adminToolbar.addMenuItem(req, {name:'List', path:'list', url:'/user/role/', description:'List all ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:view")});
  res.menu.adminToolbar.addMenuItem(req, {name:'View', path:'show', url:'/user/role/show/' + id, description:'Current item ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:view")});
  res.menu.adminToolbar.addMenuItem(req, {name:'Edit', path:'edit', url:'/user/role/edit/' + id, description:'Edit role ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:edit")});
  res.menu.adminToolbar.addMenuItem(req, {name:'Delete', path:'delete', url:'/user/role/delete/' + id, description:'Delete role ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:delete")});

  Role.findById(id, function (err, c) {

    if (err || c === null) {

      res.statusCode = 404;
      next();

    } else {

      roleForm.title = "Edit Role";
      roleForm.action = "/user/role/update/" + id;

      var values = {
        role:c
      }

      calipso.form.render(roleForm, values, req, function (form) {
        calipso.theme.renderItem(req, res, form, block, {}, next);
      });

    }

  });

}

/**
 * Update a role
 */
function updateRole(req, res, template, block, next) {

  calipso.form.process(req, function (form) {

    if (form) {

      var Role = calipso.db.model('Role');
      var id = req.moduleParams.id;

      Role.findById(id, function (err, c) {
        if (!err && c) {

          calipso.form.mapFields(form.role, c);
          c.ispublic = form.role.ispublic === "Yes" ? true : false;
          c.updated = new Date();

          calipso.e.pre_emit('USER_ROLE_UPDATE', c, function (c) {

            c.save(function (err) {
              if (err) {
                req.flash('error', req.t('Could not update role because {msg}.', {msg:err.message}));
                if (res.statusCode != 302) {
                  // Don't redirect if we already are, multiple errors
                  res.redirect('/user/role/edit/' + id);
                }
                next();
              } else {
                calipso.e.post_emit('USER_ROLE_UPDATE', c, function (c) {
                  res.redirect('/user/role/show/' + id);
                  next();
                });
              }
            });
          });
        } else {
          req.flash('error', req.t('Could not locate that role.'));
          res.redirect('/user/role');
          next();
        }
      });
    }

  });
}

/**
 * Show role
 */
function showRole(req, res, template, block, next) {

  var item;

  var Role = calipso.db.model('Role');
  var id = req.moduleParams.id;
  format = req.moduleParams.format || 'html';

  Role.findById(id, function (err, role) {

    if (err || role === null) {

      // item = {id:'ERROR',type:'content',meta:{title:"Not Found!",content:"Sorry, I couldn't find that role!"}};
      // res.redirect
      next();

    } else {

      res.menu.adminToolbar.addMenuItem(req, {name:'List', path:'list', url:'/user/role/', description:'List all ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:view")});
      res.menu.adminToolbar.addMenuItem(req, {name:'View', path:'show', url:'/user/role/show/' + id, description:'Current item ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:view")});
      res.menu.adminToolbar.addMenuItem(req, {name:'Edit', path:'edit', url:'/user/role/edit/' + id, description:'Edit role ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:edit")});
      res.menu.adminToolbar.addMenuItem(req, {name:'Delete', path:'delete', url:'/user/role/delete/' + id, description:'Delete role ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:delete")});

    }

    // Set the page layout to the role
    if (format === "html") {
      calipso.theme.renderItem(req, res, template, block, {item:role}, next);
    }

    if (format === "json") {
      res.format = format;
      res.send(role.toObject());
      next();
    }

  });

}

/**
 * List all roles
 */
function listRole(req, res, template, block, next) {

  // Re-retrieve our object
  var Role = calipso.db.model('Role');

  res.menu.adminToolbar.addMenuItem(req, {name:'New Role', path:'new', url:'/user/role/new', description:'Create role ...', permit:calipso.permission.Helper.hasPermission("admin:user:role:create")});

  var format = req.moduleParams.format || 'html';

  var query = new Query();

  // Initialise the block based on our content
  Role.count(query, function (err, count) {

    var total = count;

    Role.find(query)
      .sort('role', 1)
      .find(function (err, roles) {

        // Render the item into the response
        if (format === 'html') {
          calipso.theme.renderItem(req, res, template, block, {items:roles}, next);
        }

        if (format === 'json') {
          res.format = format;
          res.send(roles.map(function (u) {
            return u.toObject();
          }));
          next();
        }

      });

  });

}

/**
 * Delete a role
 * TODO - deal with referential integrity
 */
function deleteRole(req, res, template, block, next) {

  var Role = calipso.db.model('Role');
  var id = req.moduleParams.id;

  Role.findById(id, function (err, c) {

    calipso.e.pre_emit('USER_ROLE_DELETE', c);

    Role.remove({_id:id}, function (err) {
      if (err) {
        req.flash('info', req.t('Unable to delete the role because {msg}.', {msg:err.message}));
        res.redirect("/user/role");
      } else {
        calipso.e.post_emit('USER_ROLE_DELETE', c);
        req.flash('info', req.t('The role has now been deleted.'));
        res.redirect("/user/role");
      }
      next();
    });

  });

}

/**
 * Installation process - asynch
 */
function install(next) {

  // Create the default roles
  var Role = calipso.db.model('Role');

  calipso.lib.step(

    function createDefaults() {

      var self = this;

      Role.findOne({name:'Guest'}, function (err, item) {
        // Create default roles
        if (item != null)
          return self.parallel()(null);
        var r = new Role({
          name:'Guest',
          description:'Guest account',
          isAdmin:false,
          isDefault:true
        });
        r.save(self.parallel());
      });

      Role.findOne({name:'Contributor'}, function (err, item) {
        if (item)
          return self.parallel()(null);
        var r = new Role({
          name:'Contributor',
          description:'Able to create and manage own content items linked to their own user profile area.',
          isAdmin:false,
          isDefault:false
        });
        r.save(self.parallel());
      });

      Role.findOne({name:'Administrator'}, function (err, item) {
        if (item)
          return self.parallel()(null);
        var r = new Role({
          name:'Administrator',
          description:'Able to manage the entire site.',
          isAdmin:true,
          isDefault:false
        });
        r.save(self.parallel());
      });

    },
    function allDone(err) {
      if (err) {
        calipso.error("User Roles sub-module failed " + err.message);
        next();
      } else {
        calipso.info("User Roles sub-module installed ... ");
        storeRoles(null, null, next);
      }
    }
  )

}
