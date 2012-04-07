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
    {path: 'GET /admin/permissions', fn: showPermissions, admin:true, template: 'permissions',block: 'admin.permissions'},
    {path: 'POST /admin/permissions', fn: updatePermissions, admin:true}
  ];


exports = module.exports = {
  init: init,
  route: route,
  routes: routes,
  install:install,
  last: true,
  depends:['user']
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Permissions', path: 'admin/security/permissions', weight: 10, url: '/admin/permissions', description: 'Manage permissions ...', security: [] });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module
  calipso.e.addEvent('PERMISSIONS_UPDATE');

  calipso.e.post('PERMISSIONS_UPDATE',module.name,loadPermissionRoles);

  var PermissionRole = new calipso.lib.mongoose.Schema({
    permission:{type: String, required: true},
    role:{type: String, required: true}
  });
  calipso.lib.mongoose.model('PermissionRole', PermissionRole);

  loadPermissionRoles(function(err) {
    next();   
  });

}

/**
 * Load all the permission role mappings into the permissions object
 */
function loadPermissionRoles(next) {
 
  var perm = calipso.permissions,
      PermissionRole = calipso.lib.mongoose.model('PermissionRole'); 
  
  // Clear down first - this may cause strange behaviour to anyone
  // making a request at just this moment ... 
  perm.clearPermissionRoles();

  // Load the permissions
  PermissionRole.find({}).sort('permission',1).sort('role',1).find(function (err, prs) {
    prs.forEach(function(pr) {
      perm.addPermissionRole(pr.permission, pr.role);
    });

    perm.addPermissionRole("admin:content:type:view","Contributor");
    perm.addPermissionRole("admin:content:type:create","Contributor");
    perm.addPermissionRole("admin:content:type:delete","Contributor");

perm.addPermissionRole("admin:core:configuration","Contributor");
    
perm.addPermissionRole("content:view","Contributor");

perm.addPermissionRole("content:update","Contributor");

perm.addPermissionRole("content:create","Contributor");
    

    perm.structureAndSort();

    next();
  });

}

/**
 * Show permissions
 */
function showPermissions(req, res, options, next) {

  var structuredPermissions = calipso.permissions.structuredPermissions,
      Role = calipso.lib.mongoose.model('Role'),
      PermissionRole = calipso.lib.mongoose.model('PermissionRole');

  Role.find({}).sort('name',1).find(function (err, roles) {
    var output = renderPermissionTable(structuredPermissions, roles);
    calipso.theme.renderItem(req, res, options.templateFn, options.block, {output: output}, next);
  });

}

function renderPermissionTable(structuredPermissions, roles) {

  var output = "<form action='/admin/permissions' method='POST'>", cols = roles.length;

  // First we need to create the header structure
  output += "<table class='admin-permissions'><thead><tr><th class='admin-permissions-permission'>Permissions</th>";
  roles.forEach(function(role,key) {
    if(role.name !== 'Administrator') {
      output += "<th class='admin-permissions-role'>" + role.name + "</th>";
    }
  })
  output += "</tr>";

  var op = [];
  op = recursePermissions(structuredPermissions, '', 0, op);
    
  op.forEach(function(item) {
    if(calipso.permissions.permissions[item.key]) {
      output += "<tr class='" + item.perm + "'><td>"  + item.perm + "</td>";
      roles.forEach(function(role) {
        if(role.name !== 'Administrator') {
          var roleValue = calipso.permissions.permissions[item.key].roles.indexOf(role.name) >= 0 ? true : false;        
          output += "<td>";
          output += "<input name=" + item.key + '-' + role.name + " type='hidden' value='no' />"
          output += "<input name=" + item.key + '-' + role.name + " type='checkbox' " + (roleValue ? 'CHECKED' : '') + "/>"
          output += "</td>" 
        }
      }) 
      output += "</tr>"
    } else {
      output += "<tr class='" + item.perm + "'><td>" + item.perm + "</td><td colspan='" + cols + "'></td></tr>"; 
    }
  })
  output += "</table>";
  output += "<input type='submit' value='Save'>";
  output += "</form>";
  return output;

}


function recursePermissions(perms, key, count, op) {

  if(typeof perms === "object") {    
    for(var perm in perms) {
      var newKey = key ? key + ':' + perm : perm; 
      op.push({key:newKey,perm:perm, depth: count}); 
      if(!calipso.permissions.permissions[newKey]) {   
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

 
}

/**
 * Installation process - asynch
 */
function install(next) {

  next();
}