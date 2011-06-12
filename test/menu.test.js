/**
 *  Sanity test
 *  Test must be executed serially as it runs
 *  against an app instance, this is typically executed by the make file
 **/
require.paths.unshift(__dirname + "/../"); //make local application paths accessible
 
var assert = require('assert'),
    sys = require('sys'),
    should = require('should'),
    menu = require('Menu');

var simpleMenuBasic = {name:'Basic Menu Item',path:'simplepath',url:'/bob'};
var simpleMenuFull = {name:'Full Menu Item',path:'fullpath',url:'/bill',description:'This is a simple menu',security:["test"]}
var childMenuShort = {name:'Short Menu Item',path:'simplepath/child',url:'/bob/child'};
var childMenuDeep = {name:'Deep Menu Item',path:'simplepath/a/b',url:'/bob/a/b'};
var childMenuDeepLater = {name:'Later Menu Item',path:'simplepath/a/b/c',url:'/bob/a/b/c'};

/**
 * Tests
 */
exports['I can create a menu, it has default sortby and is root.'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');
  tm.name.should.equal('MyMenu');
  tm.type.should.equal('root');
  
};

exports['I can create a menu, with different sort by'] = function() {
  
  var tm = new menu.CalipsoMenu('OtherMenu','key');  
  tm.name.should.equal('OtherMenu');  
  
};

exports['I can add a menu item and it is added to the menu correctly'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');  
  tm.addMenuItem(simpleMenuBasic);
  
  // Checks
  tm.children[simpleMenuBasic.path].name.should.equal(simpleMenuBasic.name);
  tm.children[simpleMenuBasic.path].url.should.equal(simpleMenuBasic.url);
  tm.children[simpleMenuBasic.path].path.should.equal(simpleMenuBasic.path);
  
};


exports['I can add two menu children and both appear'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(simpleMenuFull);
    
  // Checks
  tm.children[simpleMenuBasic.path].name.should.equal(simpleMenuBasic.name);
  tm.children[simpleMenuBasic.path].url.should.equal(simpleMenuBasic.url);
  tm.children[simpleMenuBasic.path].path.should.equal(simpleMenuBasic.path);
  
  tm.children[simpleMenuFull.path].name.should.equal(simpleMenuFull.name);
  tm.children[simpleMenuFull.path].url.should.equal(simpleMenuFull.url);
  tm.children[simpleMenuFull.path].path.should.equal(simpleMenuFull.path);
  tm.children[simpleMenuFull.path].description.should.equal(simpleMenuFull.description);
  
};


exports['I can add the same menu twice without adverse results'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(simpleMenuBasic);
    
  // Checks
  tm.children[simpleMenuBasic.path].name.should.equal(simpleMenuBasic.name);
  tm.children[simpleMenuBasic.path].url.should.equal(simpleMenuBasic.url);
  tm.children[simpleMenuBasic.path].path.should.equal(simpleMenuBasic.path);
  
};



exports['I can add a menu with a heirarchical path and get a hierarchy'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(childMenuShort);

  // Check created deep heirarchy
  tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);
  
  // Check parent still matches parent url
  tm.children.simplepath.url.should.equal(simpleMenuBasic.url);
  
};


exports['I can add a menu with an overlapping heirarchical path and get a hierarchy'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(childMenuShort);
  tm.addMenuItem(childMenuDeep);

  // Check created deep heirarchy
  tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);
  tm.children.simplepath.children.a.children.b.name.should.equal(childMenuDeep.name);
  
  // Check parent has still has first child url, it is not updated by second menu 
  tm.children.simplepath.url.should.equal(simpleMenuBasic.url);
  
};


exports['Creating menus in the wrong order is ok, they get updated'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(childMenuShort);  
  tm.addMenuItem(simpleMenuBasic);
  
  // Check created deep heirarchy
  tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);
  
  // Check that parent url is set correctly  
  tm.children.simplepath.url.should.equal(simpleMenuBasic.url);
  
};

exports['I can recursively scan the menu tree'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(childMenuShort);
  tm.addMenuItem(childMenuDeep);
  tm.addMenuItem(childMenuDeepLater);
  
  var output = [];
  var menuFn = function(menu) {
      return menu.path;
  }
  tm.fnRecurse(tm,menuFn,output);

  output.length.should.equal(5);
  output[0].should.equal(simpleMenuBasic.path);  
  
};


exports['I can highlight selected menu items in a tree based on current url matching'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(childMenuShort);
  tm.addMenuItem(childMenuDeep);
  tm.addMenuItem(childMenuDeepLater);
  
  // Mock request object
  var req = {url:'/bob/child', t: function(string) { return string }}
  
  var selected = tm.selected(req);
  selected.length.should.equal(2);
  selected[0].should.equal(simpleMenuBasic.path);
  selected[1].should.equal(childMenuShort.path);    
  
};


exports['I can render html'] = function() {
  
  var tm = new menu.CalipsoMenu('MyMenu');    
  tm.addMenuItem(simpleMenuBasic);
  tm.addMenuItem(childMenuShort);
  tm.addMenuItem(childMenuDeep);
  tm.addMenuItem(childMenuDeepLater);
  tm.addMenuItem(simpleMenuFull);
  
  // Mock request object
  var req = {url:'/bob/child', t: function(string) { return string }}  
  var html = tm.render(req);  
  
  html.should.include.string("MyMenu");
  
};

