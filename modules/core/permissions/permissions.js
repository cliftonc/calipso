/**
 * Permissions module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query;

exports = module.exports = {
  init: init,
  route: route,
  routes: routes,
  install:install,
  last: true,
  depends:['user']
};

/**
 * Routes this module will respond to
 */
function routes() {
  return [
    {path: 'GET /admin/permissions', fn: showPermissions, admin:true, template: 'permissions',block: 'admin.permissions'},
    {path: 'POST /admin/permissions', fn: updatePermissions, admin:true}
  ];
}

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Menu
  res.menu.admin.addMenuItem({name:'Permissions', path: 'admin/permissions', weight: 10, url: '/admin/permissions', description: 'Manage permissions ...', security: [] });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module
  calipso.e.addEvent('PERMISSION_MODIFY');

  var PermissionRole = new calipso.lib.mongoose.Schema({
    permission:{type: String, required: true},
    role:{type: String, required: true}
  });
  calipso.lib.mongoose.model('PermissionRole', PermissionRole);

  next();

}

/**
 * Show permissions
 */
function showPermissions(req, res, options, next) {

  var permissions = calipso.permissions.permissions,
      sortedPermissions = calipso.permissions.sortedPermissions;
  var Role = calipso.lib.mongoose.model('Role');
  var PermissionRole = calipso.lib.mongoose.model('PermissionRole');

  Role.find({}).sort('name',1).find(function (err, roles) {

    PermissionRole.find({}).sort('permission',1).sort('role',1).find(function (err, permissionRoles) {
        calipso.theme.renderItem(req, res, options.templateFn, options.block, {permissions: permissions, sortedPermissions:sortedPermissions, roles: roles, permissionRoles: permissionRoles}, next);
    });

  });

}

/**
 * Update permissions
 */
function updatePermissions(req, res, options, next) {

  calipso.theme.renderItem(req, res, template, block, {}, next);

}

/**
 * Installation process - asynch
 */
function install(next) {

  next();
}