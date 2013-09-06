/*!
 * Calipso Menu Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * This library provides the base functions to manage the creation of menus.
 * A default renderer will be provided in this library, but this is intended to be over-ridden
 * By menu modules (e.g. to export different structures), or even source menus from different locations.
 *
 */

/**
 * Includes
 */
var sys;
try {
  sys = require('util');
}
catch (e) {
  sys = require('sys');
}
var rootpath = process.cwd() + '/',
  path = require('path'),
  utils = require('connect').utils,
  merge = utils.merge,
  calipso = require(path.join('..', 'calipso'));

/**
 * The default menu item object, with default configuration values.
 * Constructor
 */

function CalipsoMenu(name, sort, type, options) {

  // Basic menu options, used typically for root menu holder
  this.name = name || 'default'; // This should be mandatory
  this.type = type || 'root';
  this.sort = sort || 'name';

  // Options for this menu item
  if (options) {
    this.setOptions(options);
  }

  // Child menu items
  this.children = {};
  this.sortedChildren = []; // Sorted array of prop names for recursion
}

/**
 * Exports
 */
module.exports = CalipsoMenu;

/**
 * Wrapper to enable setting of menu options
 */
CalipsoMenu.prototype.setOptions = function (options) {
  merge(this, options);
};

/**
 * Function to enable addition of a menu item to the menu.
 *
 * Menu Options:
 * name: req.t('Admin')  -- Label to display
 * path: admin -- the menu heirarchy path, used for parent child.
 * e.g. path: admin/config -- the menu heirarchy path, used for parent child.
 * instruction: req.t('Administration Menu') -- tooltip label
 * url: '/admin'  -- Url to use as link
 * security: [/admin/,"bob"] -- regex based on user role
 */
CalipsoMenu.prototype.addMenuItem = function (req, options) {

  var self = this;

  // The req parameter was added in 0.3.0, if not passed, assuming options only
  if (options === undefined) {
    calipso.error("Attempting to add menu item with invalid params, please update your module for the 0.3.0 api, path: " + req.path);
  }

  // Check security
  if (options.permit) {

    var permitFn = new calipso.permission.Filter(options, options.permit),
      permit = permitFn.check(req);

    if (typeof permit !== "object") {
      return;
    }
    if (!permit.allow) {
      return;
    }
  }
  // Admin security is opposite to default
  if (self.name === 'admin') {
    var isAdmin = req.session.user && req.session.user.isAdmin;
    // Admin by default is not shown unless permitted
    if (!options.permit && !isAdmin) {
      return;
    }
  }

  // Split the path, traverse items and add menuItems.
  // If you add a child prior to parent, then create the parent.
  var newItem = self.createPath(options, options.path.split("/"));

};

/**
 * Ensure that a full path provided is a valid menu tree
 */
CalipsoMenu.prototype.createPath = function (options, path) {

  var self = this;
  var currentItem = path[0];
  var remainingItems = path.splice(1, path.length - 1);

  if (self.children[currentItem] && remainingItems.length > 0) {

    // Recurse
    self.children[currentItem].createPath(options, remainingItems);

  } else {

    // If the current item does not yet exist
    if (!self.children[currentItem]) {

      // Do we have children left, if so, mark this as a temporary node (e.g. we dont actually have its options)
      if (remainingItems.length > 0) {
        self.children[currentItem] = new CalipsoMenu('Child of ' + currentItem, self.sort, 'temporary', options);
      } else {
        self.children[currentItem] = new CalipsoMenu('Child of ' + currentItem, self.sort, 'child', options);
      }
      self.sortedChildren.push(currentItem); // Add to array for later sorting
    }

    // Check to see if we need to update a temporary node
    if (self.children[currentItem] && remainingItems.length === 0 && self.children[currentItem].type === 'temporary') {
      self.children[currentItem].type = 'child';
      self.children[currentItem].setOptions(options);
    }

    if (remainingItems.length > 0) {
      // Recurse
      self.children[currentItem].createPath(options, remainingItems);
    }

  }

  // Sort the sorted array
  self.sortedChildren.sort(function (a, b) {

    // a & b are strings, but both objects on the current children
    var diff;
    if (self.sort in self.children[a] && self.sort in self.children[b]) {

      if (typeof self.children[a][self.sort] === "string") {
        diff = self.children[a][self.sort].toLowerCase() > self.children[b][self.sort].toLowerCase();
      } else {
        diff = self.children[a][self.sort] > self.children[b][self.sort];
      }

    } else {
      diff = self.children[a].name.toLowerCase() > self.children[b].name.toLowerCase();
    }

    return diff;
  });


};


/**
 * Render the menu as a html list - this is the default.
 * The idea is that this can be over-ridden (or the sub-function), to control
 * HTML generation.
 */
CalipsoMenu.prototype.render = function (req, depth) {

  var self = this;

  // If the menu is empty, render nothing
  if (self.sortedChildren.length === 0) {
    return '';
  }

  // Get selected items
  var selected = self.selected(req);

  var htmlOutput = '';
  htmlOutput += self.startTag();

  var renderUp = function (menu) {
    var selectedClass = '';
    if (contains(selected, menu.path)) {
      selectedClass = '-selected';
    }
    var html = self.menuStartTag(menu, selectedClass) + self.menuLinkTag(req, menu, selectedClass);
    return html;
  };

  var renderDown = function (menu) {
    var html = self.menuEndTag(menu);
    return html;
  };

  var renderStart = function (menu) {
    var html = self.childrenStartTag(menu);
    return html;
  };

  var renderFinish = function (menu) {
    var html = self.childrenEndTag(menu);
    return html;
  };

  var output = [];
  self.fnRecurse(self, renderUp, renderDown, renderStart, renderFinish, depth, output);

  htmlOutput += output.join("");
  htmlOutput += self.endTag();

  return htmlOutput;

};

/**
 * Specific tag rendering functions
 * Over-write to enable custom menu rendering
 */
CalipsoMenu.prototype.startTag = function () {
  return "<ul id='" + this.name + "-menu' class='menu" + (this.cls ? ' ' + this.cls : '') + "'>";
};
CalipsoMenu.prototype.endTag = function () {
  return "</ul>";
};
CalipsoMenu.prototype.menuStartTag = function (menu, selected) {
  var menuItemTagId = menu.path.replace(/\//g, '-') + "-menu-item";
  return "<li id='" + menuItemTagId + "' class='" + this.name + "-menu-item" + selected + "'>";
};
CalipsoMenu.prototype.menuLinkTag = function (req, menu, selected) {
  var popup = menu.popup ? 'popupMenu' : '';
  return "<a href='" + menu.url + "' title='" + req.t(menu.description) + "' class='" + popup + " " + this.name + "-menu-link" + selected + (menu.cls ? " " + menu.cls : "") + "'>" + req.t(menu.name) + (menu.icon ? " <i class='" + menu.icon + "'></i>" : "") + "</a>";
};
CalipsoMenu.prototype.menuEndTag = function (menu) {
  return "</li>";
};
CalipsoMenu.prototype.childrenStartTag = function () {
  return "<ul>";
};
CalipsoMenu.prototype.childrenEndTag = function () {
  return "</ul>";
};

CalipsoMenu.prototype.childrenIcon = function () {
  return "<i class='icon-download' ";
}
/**
 * Locate selected paths based on current request
 */
CalipsoMenu.prototype.selected = function (req) {

  // Based on current url, create a regex string that can be used to test if a menu item
  // Is selected during rendering
  var self = this;
  var output = [];

  var selectedFn = function (menu) {

    var menuSplit = menu.url.split("/");
    var reqSplit = req.url.split("/");
    var match = true;

    menuSplit.forEach(function (value, key) {
      match = match && (value === reqSplit[key]);
    });

    // Check if the url matches
    if (match) {
      return menu.path;
    }

  };

  self.fnRecurse(self, selectedFn, output);

  return output;

};

/**
 * Helper function that can recurse the menu tree
 * From a start point, execute a function and add the result to an output array
 */
CalipsoMenu.prototype.fnRecurse = function (menu, fnUp, fnDown, fnStart, fnFinish, depth, output) {

  var self = this;
  var result;
  if (typeof fnDown != 'function') {
    output = fnDown;
  }
  output = output || [];

  // Recurse from menu item selected
  if (menu.type === 'root') {

    // Functions don't run on root
    menu.sortedChildren.forEach(function (child) {
      self.fnRecurse(menu.children[child], fnUp, fnDown, fnStart, fnFinish, depth, output);
    });

  } else {

    // Control depth of recursion
    depth = depth === undefined ? -1 : depth;
    if (depth > 0) {
      depth = depth - 1;
    } else if (depth === -1) {
      // Recures infinitely
    } else {
      return output;
    }

    // Count the number of children
    var childCount = menu.sortedChildren.length;

    // Execute fn
    if (typeof fnUp === 'function') {

      result = fnUp(menu);
      if (result) {
        output.push(result);
      }

      if (childCount > 0) {
        if (typeof fnStart === 'function') {
          result = fnStart(menu);
          if (result) {
            output.push(result);
          }
        }
      }

    }

    // Recurse
    menu.sortedChildren.forEach(function (child) {
      self.fnRecurse(menu.children[child], fnUp, fnDown, fnStart, fnFinish, depth, output);
    });

    // Close
    if (typeof fnDown === 'function') {

      result = fnDown(menu);
      if (result) {
        output.push(result);
      }

      if (childCount > 0) {
        if (typeof fnFinish === 'function') {
          result = fnFinish(menu);
          if (result) {
            output.push(result);
          }
        }
      }
    }

  }

};

/**
 * Return current menu as a JSON object, used for Ajax style menus.
 * Path : root to return menu from, default is root (entire menu)
 * Depth : How many levels to return menu
 */
CalipsoMenu.prototype.getMenuJson = function (path, depth) {

  // TODO
};

/**
 * Private helper functions
 */

function contains(a, obj) {
  var i = a.length;
  while (i--) {
    if (a[i] === obj) {
      return true;
    }
  }
  return false;
}
