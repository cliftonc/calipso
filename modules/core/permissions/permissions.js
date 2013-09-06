/**
 * Permissions module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query;

/**
 * Routes this module will respond to
 */
var routes = [
  {path:'GET /admin/permissions', fn:showPermissions, permit:calipso.permission.Helper.hasPermission("admin:permission:configuration"), admin:true, template:'permissions', block:'admin.permissions'},
  {path:'POST /admin/permissions', fn:updatePermissions, permit:calipso.permission.Helper.hasPermission("admin:permission:configuration"), admin:true}
];

exports = module.exports = {
  init:init,
  route:route,
  routes:routes,
  install:install,
  last:true,
  depends:['user']
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  var permPermit = calipso.permission.Helper.hasPermission("admin:permission:configuration");

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Permissions', permit:permPermit, path:'admin/security/permissions', weight:10, url:'/admin/permissions', description:'Manage permissions ...', security:[], icon:"icon-users" });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module
  calipso.e.addEvent('PERMISSIONS_UPDATE');

  calipso.e.post('PERMISSIONS_UPDATE', module.name, loadPermissionRoles);

  calipso.permission.Helper.addPermission("admin:permission:configuration", "Manage role based permissions.");

  var PermissionRole = new calipso.lib.mongoose.Schema({
    permission:{type:String, required:true},
    role:{type:String, required:true}
  });
  calipso.db.model('PermissionRole', PermissionRole);

  loadPermissionRoles(function (err) {
    next(err);
  });

}

/**
 * Load all the permission role mappings into the permissions object
 */
function loadPermissionRoles(next) {

  var perm = calipso.permission.Helper,
    PermissionRole = calipso.db.model('PermissionRole');

  // Clear down first - this may cause strange behaviour to anyone
  // making a request at just this moment ...
  perm.clearPermissionRoles();

  // Load the permissions
  PermissionRole.find({}).sort('permission').sort('role').find(function (err, prs) {

    prs.forEach(function (pr) {
      perm.addPermissionRole(pr.permission, pr.role);
    });

    perm.structureAndSort();

    next();

  });

}

/**
 * Show permissions
 */
function showPermissions(req, res, options, next) {

  var structuredPermissions = calipso.permission.Helper.structuredPermissions,
    Role = calipso.db.model('Role'),
    PermissionRole = calipso.db.model('PermissionRole');

  Role.find({}).sort('name').find(function (err, roles) {
    var output = renderPermissionTable(structuredPermissions, roles);
    calipso.theme.renderItem(req, res, options.templateFn, options.block, {output:output}, next);
  });

}

function renderPermissionTable(structuredPermissions, roles) {

  var output = "<form action='/admin/permissions' method='POST'>", cols = roles.length;

  // First we need to create the header structure
  output += "<table class='admin-permissions'><thead><tr><th class='admin-permissions-permission'>Permissions</th>";
  roles.forEach(function (role, key) {
    if (role.name !== 'Administrator') {
      output += "<th class='admin-permissions-role'>" + role.name + "</th>";
    }
  })
  output += "</tr>";

  var op = [];
  op = recursePermissions(structuredPermissions, '', 0, op);

  op.forEach(function (item) {

    var depthCount = item.key.match(/:/g), depth = depthCount ? depthCount.length : 0;

    if (calipso.permission.Helper.permissions[item.key]) {
      output += "<tr class='perm-row perm-depth-" + depth + "'><td class='perm-description'>" + calipso.permission.Helper.permissions[item.key].description + "</td>";
      roles.forEach(function (role) {
        if (role.name !== 'Administrator') {
          var roleValue = calipso.permission.Helper.permissions[item.key].roles.indexOf(role.name) >= 0 ? true : false;
          output += "<td>";
          // output += "<input name=" + item.key + '-' + role.name + " type='hidden' value='false' />"
          output += "<input name=" + item.key + '-' + role.name + " type='checkbox' " + (roleValue ? 'CHECKED' : '') + "/>"
          output += "</td>"
        }
      })
      output += "</tr>"
    } else {

      output += "<tr class='perm-header perm-depth-" + depth + "'><td>" + item.perm + "</td><td colspan='" + cols + "'></td></tr>";
    }
  })
  output += "</table>";
  output += "<input type='submit' value='Save'>";
  output += "</form>";
  return output;

}

function recursePermissions(perms, key, count, op) {

  if (typeof perms === "object") {
    for (var perm in perms) {
      var newKey = key ? key + ':' + perm : perm;
      op.push({key:newKey, perm:perm, depth:count});
      if (!calipso.permission.Helper.permissions[newKey]) {
        recursePermissions(perms[perm], newKey, count + 1, op);
      }
    }
  }
  return op;

}

/**
 * Update permissions
 */
function updatePermissions(req, res, options, next) {

  var structuredPermissions = calipso.permission.Helper.structuredPermissions,
    Role = calipso.db.model('Role'),
    PermissionRole = calipso.db.model('PermissionRole');

  calipso.form.process(req, function (permissions) {

    if (permissions) {

      // Extract the defaults from the config
      var newPermissions = calipso.lib._.reduce(calipso.lib._.keys(permissions), function (memo, key) {
        var permKey = key.split("-")[0],
          role = key.split("-")[1];

        memo.push({permission:permKey, role:role});
        return memo;
      }, [])

      // Delete all the existing permissions
      PermissionRole.find({}).find(function (err, prs) {

        // Delete all
        calipso.lib.async.map(prs, function (permission, next) {
          PermissionRole.remove({_id:permission._id}, function (err) {
            next(err);
          })
        }, function (err) {

          // Add new ones
          calipso.lib.async.map(newPermissions, function (permissionRole, next) {

            // Create a new PermissionRole and save
            var pr = new PermissionRole(permissionRole);
            pr.save(next);

          }, function (err) {

            // Now reload them all
            loadPermissionRoles(function () {

              req.flash('info', req.t('Permissions updated.'));
              res.redirect('/admin/permissions');
              return next();

            })

          });

        });

      });

    } else {

      req.flash('error', req.t('There was a problem reading in the updated permissions.'));
      res.redirect('/admin');
      next();

    }

  });

}

/**
 * Installation process - asynch
 */
function install(next) {
  /// Nothign yet
  next();
}