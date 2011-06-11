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
var sys = require('sys');

/**
 * Exports
 */
exports.CalipsoMenu = CalipsoMenu;

/**
 * The default menu item object, with default configuration values.
 * Constructor
 */
function CalipsoMenu(name,type,options) {

  // Basic menu options, used typically for root menu holder
  this.name = name || 'default';  // This should be mandatory
  this.type = type || 'root';
  
  // Options for this menu item
  if(options) {
    this.setOptions(options);
  }
  
  // Child menu items
  this.children = {};
  
}

/** 
 * Wrapper to enable setting of menu options
 */
CalipsoMenu.prototype.setOptions = function(options) { 
    this.path = options.path || '';
    this.name = options.name || '';  
    this.url = options.url || '';
    this.description = options.description || '';
    this.security = options.security || [];
}


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
CalipsoMenu.prototype.addMenuItem = function(options) { 

  var self = this;
  
  // Refresh the reference, as it is initially loaded at startup
  calipso = require('lib/calipso');
  
  // Split the path, traverse items and add menuItems.
  // If you add a child prior to parent, then create the parent.      
  var newItem = self.createPath(options,options.path.split("/"));  
  
};

/**
 * Ensure that a full path provided is a valid menu tree
 */
CalipsoMenu.prototype.createPath = function(options,path) {
   
  var self = this;
  var currentItem = path[0];
  var remainingItems = path.splice(1,path.length - 1);
    
  if(self.children[currentItem] && remainingItems.length > 0) {
    
    // Recurse
    self.children[currentItem].createPath(options,remainingItems);
         
  } else {
    
    // If the current item does not yet exist
    if(!self.children[currentItem]) {
      // Do we have children left, if so, mark this as a temporary node (e.g. we dont actually have its options)
      if(remainingItems.length > 0) {        
        self.children[currentItem] = new CalipsoMenu('Child of ' + currentItem,'temporary',options);
      } else {
         self.children[currentItem] = new CalipsoMenu('Child of ' + currentItem,'child',options);
      }
    }    
    
    // Check to see if we need to update a temporary node
    if(self.children[currentItem] && remainingItems.length == 0 && self.children[currentItem].type === 'temporary') {
      self.children[currentItem].type = 'child';       
      self.children[currentItem].setOptions(options);
    }
    
    if(remainingItems.length > 0) {
      // Recurse
      self.children[currentItem].createPath(options,remainingItems);
    }
    
  }
    
};


/** 
 * Return current menu as a JSON object, used for Ajax style menus. 
 * Path : root to return menu from, default is root (entire menu)
 * Depth : How many levels to return menu
 */
CalipsoMenu.prototype.render = function(path,depth) {
  
  var self = this; 
  
  // Defaults
  depth = depth || 0;
  path = path || '';
  
  // Start from path  
  if(path) {
    
  }
  
  
};


/** 
 * Return current menu as a JSON object, used for Ajax style menus. 
 * Path : root to return menu from, default is root (entire menu)
 * Depth : How many levels to return menu
 */
CalipsoMenu.prototype.getMenuJson = function(path,depth) {
   
  // TODO
  
};
  

