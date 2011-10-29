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
  calipso = require(path.join(rootpath, 'lib/calipso'));

/**
 * The default calipso permission filter, this is attached to every route, and processed as part of the route matching.
 */
function PermissionFilter(route, permit) {

  // Store the options
  var self = this;
  self.permit = permit || {};

}

PermissionFilter.prototype.check = function(req) {

  if(this.permit) {
    var user = req.session.user;
    if(user) {
      return this.permit(user);
    } else {
      return {allow:false, msg:'You must be a logged in user to view that page'};
    }
  } else {
      return {allow:true};
  }

}

/**
 * A set of helper functions to simplify the application of filters, as well as store
 * the in memory map of roles to permissions (in memory for performance reasons)
 */
var PermissionHelpers = {

  // Holder of defined permissions
  permissions: {},
  sortedPermissions: [],

  // Add a permission
  addPermission: function(permission, description, isCrud) {

    var self = this, calipso = require(path.join(rootpath, 'lib/calipso'));

    // Add Permission always resets it if it already exists
    self.permissions[permission] = {roles: [], queries:[], description: description};
    self.sortedPermissions.push(permission);

    // if Crud, automatically add level below
    calipso.lib._.map(["create","view","update","delete"], function(crudAction) {
      var crudPermission = permission + ":" + crudAction;
      self.permissions[crudPermission] = {roles: [], queries:[], description: description};
      self.sortedPermissions.push(crudPermission);
    })

    self.sortedPermissions.sort(function(a,b) {
      return a < b;
    });

  },

  // Add a map between role / permission (this is loaded via the user module)
  addRolePermission: function(role, permission) {

    var self = this, calipso = require(path.join(rootpath, 'lib/calipso'));

    // Store this as a simple in memory map
    if(self.permissions[permission]) {
      self.permissions[permission].roles.push(role);
      return true;
    } else {
      calipso.error("Attempted to map role: " + role + " to a permission: " + permission +" that does not exist (perhaps related to a disabled module?).");
      return false;
    }

  },

  // Does a user have a role
  hasRole: function(role) {
    // Curried filter
    return function(user) {
      var isAllowed = user.roles.indexOf(role) >= 0 ? true : false;
      return {allow: isAllowed , msg: 'You dont have the appropriate roles to view that page!'}
    }
  },

  // Does a user have a permission
  hasPermission: function(permission) {

    var self = this, calipso = require(path.join(rootpath, 'lib/calipso'));
    var permissionRoles = self.permissions[permission] ? self.permissions[permission].roles : [];

    // Curried filter
    return function(user) {

      // Check if the user has a role that maps to the permission
      var userRoles = user.roles;

      // Check if allowed based on intersection of user roles and roles that have permission
      var isAllowed = calipso.lib._.intersect(permissionRoles,userRoles).length > 0;

      return {allow:isAllowed, msg:'You do not have any of the roles required to view this page or perform that action'};
    }

  }

}

/**
 * Export an instance of our object
 */
exports.PermissionFilter = PermissionFilter;
exports.PermissionHelpers = PermissionHelpers;