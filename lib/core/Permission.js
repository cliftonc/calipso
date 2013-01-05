/*!
 * Calipso Permissions Class
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library adds a permissions class to the router, defining functions that are used by the router to control access.
 *
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso'));

/**
 * A set of helper functions to simplify the application of filters, as well as store
 * the in memory map of roles to permissions (in memory for performance reasons)
 */
var PermissionHelpers = {

  // Holder of defined permissions
  permissions:{},
  sortedPermissions:[],
  structuredPermissions:{},

  // Clear all oaded permissions
  clearPermissionRoles:function () {

    var self = this;
    for (var perm in self.permissions) {
      delete self.permissions[perm].roles;
      self.permissions[perm].roles = [];
    }

  },

  // Add a permission
  addPermission:function (permission, description, isCrud) {

    var self = this;

    // if Crud, automatically add level below
    if (isCrud) {
      calipso.lib._.map(["view", "create", "update", "delete"], function (crudAction) {
        var crudPermission = permission + ":" + crudAction;
        self.permissions[crudPermission] = {
          roles:[],
          queries:[],
          description:crudAction + " " + description
        };
        self.sortedPermissions.push(crudPermission);
      });
    } else {

      // Add Permission always resets it if it already exists
      self.permissions[permission] = {
        roles:[],
        queries:[],
        description:description
      };
      self.sortedPermissions.push(permission);

    }

  },

  structureAndSort:function () {

    var self = this;

    // This could be done by the permissions module
    self.sortedPermissions.sort(function (a, b) {
      return a < b;
    });

    // Now we need to create our permissions object structure
    self.sortedPermissions.forEach(function (value) {

      var path = value.split(":"),
        target = self.structuredPermissions,
        counter = 0;

      while (path.length > 1) {
        key = path.shift();
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }

      // Set the specified value in the nested JSON structure
      key = path.shift();
      if (typeof target[key] !== "object") {
        target[key] = self.permissions[value].roles;
      }

    });

  },

  // Add a map between role / permission (this is loaded via the user module)
  addPermissionRole:function (permission, role) {

    var self = this;

    // Store this as a simple in memory map
    if (self.permissions[permission]) {
      self.permissions[permission].roles.push(role);
      return true;
    } else {
      calipso.warn("Attempted to map role: " + role + " to a permission: " + permission + " that does not exist (perhaps related to a disabled module?).");
      return false;
    }

  },

  // Does a user have a role
  hasRole:function (role) {
    // Curried filter
    return function (user) {
      var isAllowed = user.roles.indexOf(role) >= 0 ? true : false,
        message = isAllowed ? ('User has role ' + role) : 'You dont have the appropriate roles to view that page!';
      return {
        allow:isAllowed,
        msg:message
      };
    };
  },

  // Does a user have a permission
  hasPermission:function (permission) {

    var self = this;

    // Curried filter
    return function (user) {

      // Check if the user has a role that maps to the permission
      var userRoles = user.roles,
        permissionRoles = self.permissions[permission] ? self.permissions[permission].roles : [];

      // Check if allowed based on intersection of user roles and roles that have permission
      var isAllowed = calipso.lib._.intersect(permissionRoles, userRoles).length > 0,
        message = isAllowed ? ('User has permission ' + permission) : 'You do not have any of the roles required to perform that action.';


      return {
        allow:isAllowed,
        msg:message
      };

    };

  }

};


/**
 * The default calipso permission filter, this is attached to every route, and processed as part of the route matching.
 */
function PermissionFilter(options, permit) {

  // Store the options
  var self = this;
  self.options = options;

  if (permit) {
    if (typeof permit === 'function') {
      // permit is already a fn created by a helper
      self.permit = permit;
    } else {
      // permit is a string - e.g. 'admin:core:configuration'
      self.permit = calipso.permission.Helper.hasPermission(permit);
    }
  }

}

PermissionFilter.prototype.check = function (req) {

  var self = this;
  if (!self.permit && self.options.permit) {
    self.permit = self.options.permit;
  }
  if (self.permit) {

    var user = req.session.user;
    var isAdmin = req.session.user && req.session.user.isAdmin;

    if (isAdmin) {
      return {
        allow:true
      };
    } // Admins always access everything
    // Else check for a specific permission
    if (user) {
      return self.permit(user);
    } else {
      return {
        allow:false,
        msg:'You must be a logged in user to view that page'
      };
    }

  } else {
    return {
      allow:true
    };
  }

};


/**
 * Export an instance of our object
 */
exports.Filter = PermissionFilter;
exports.Helper = PermissionHelpers;
