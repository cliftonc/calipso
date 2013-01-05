/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  helper = require('./helpers/calipsoHelper');

helper.finalize(function (err, calipsoHelper) {
  var calipso = calipsoHelper.calipso,
    testPermit = calipsoHelper.testPermit,
    Menu = require('./helpers/require')('core/Menu');

  /**
   * Test data
   */
  var anonMenuBasic = {name:'Public Menu Item', path:'publicpath', url:'/public'};
  var simpleMenuBasic = {name:'Basic Menu Item', path:'simplepath', url:'/bob', permit:testPermit, order:1};
  var simpleMenuFull = {name:'Full Menu Item', path:'fullpath', url:'/bill', description:'This is a simple menu', permit:testPermit, order:2}
  var childMenuShort = {name:'Short Menu Item', path:'simplepath/child', url:'/bob/child', permit:testPermit};
  var childMenuDeep = {name:'Deep Menu Item', path:'simplepath/a/b', url:'/bob/a/b', permit:testPermit};
  var childMenuDeepLater = {name:'Later Menu Item', path:'simplepath/a/b/c', url:'/bob/a/b/c', permit:testPermit};

  describe('Menus', function () {

    before(function (done) {
      calipsoHelper.calipso.loaded.should.equal(true);
      done();
    });

    describe('Creating items with correct permissons', function () {

      it('I can create a menu, it has default sortby and is root.', function (done) {
        var tm = new Menu('MyMenu');
        tm.name.should.equal('MyMenu');
        tm.type.should.equal('root');
        done();
      });

      it('I can create a menu, with different sort by', function (done) {
        var tm = new Menu('OtherMenu', 'key');
        tm.name.should.equal('OtherMenu');
        done();
      });

      it('I can add a menu item with no permission and it is visible to everyone', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.anonUser;
        tm.addMenuItem(req, anonMenuBasic);
        should.exist(tm.children[anonMenuBasic.path])
        tm.children[anonMenuBasic.path].name.should.equal(anonMenuBasic.name);
        tm.children[anonMenuBasic.path].url.should.equal(anonMenuBasic.url);
        tm.children[anonMenuBasic.path].path.should.equal(anonMenuBasic.path);

        done();

      });

      it('I can add a menu item and it is added to the menu correctly when user has the correct permission', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;
        tm.addMenuItem(req, simpleMenuBasic);
        should.exist(tm.children[simpleMenuBasic.path])
        tm.children[simpleMenuBasic.path].name.should.equal(simpleMenuBasic.name);
        tm.children[simpleMenuBasic.path].url.should.equal(simpleMenuBasic.url);
        tm.children[simpleMenuBasic.path].path.should.equal(simpleMenuBasic.path);
        done();

      });

      it('Adding a menu item without the correct permission does not add the menu item', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.anonUser;
        tm.addMenuItem(req, simpleMenuBasic);
        should.not.exist(tm.children[simpleMenuBasic.path])
        done();

      });

      it('Administrators can see all menu items', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.adminUser;
        tm.addMenuItem(req, simpleMenuBasic);
        should.exist(tm.children[simpleMenuBasic.path])
        done();

      });

      it('Admin menus are invisible by default if they have no permit fn defined', function (done) {

        var tm = new Menu('admin'), req = calipsoHelper.requests.testUser;
        tm.addMenuItem(req, anonMenuBasic);
        should.not.exist(tm.children[anonMenuBasic.path])
        done();

      });

      it('I can add the same menu twice without adverse effects', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, simpleMenuBasic);

        tm.children[simpleMenuBasic.path].name.should.equal(simpleMenuBasic.name);
        tm.children[simpleMenuBasic.path].url.should.equal(simpleMenuBasic.url);
        tm.children[simpleMenuBasic.path].path.should.equal(simpleMenuBasic.path);

        done();

      });

    });

    describe('Creating hierarchical menus', function () {

      it('I can add a menu with a heirarchical path and get a hierarchy', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, childMenuShort);

        // Check created deep heirarchy
        tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);

        // Check parent still matches parent url
        tm.children.simplepath.url.should.equal(simpleMenuBasic.url);

        done();

      });


      it('I can add a menu with an overlapping heirarchical path and get a hierarchy', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, childMenuShort);
        tm.addMenuItem(req, childMenuDeep);

        // Check created deep heirarchy
        tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);
        tm.children.simplepath.children.a.children.b.name.should.equal(childMenuDeep.name);

        // Check parent has still has first child url, it is not updated by second menu
        tm.children.simplepath.url.should.equal(simpleMenuBasic.url);
        done();

      });


      it('Creating menus in the wrong order is ok, they get updated', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        tm.addMenuItem(req, childMenuShort);
        tm.addMenuItem(req, simpleMenuBasic);

        // Check created deep heirarchy
        tm.children.simplepath.children.child.name.should.equal(childMenuShort.name);

        // Check that parent url is set correctly
        tm.children.simplepath.url.should.equal(simpleMenuBasic.url);

        done();

      });

      it('Creating menus with an invalid sort defaults to sorting by item name', function (done) {

        var tm = new Menu('MyMenu', 'invalid'), req = calipsoHelper.requests.testUser;

        // Add in reverse order to what we expect
        tm.addMenuItem(req, simpleMenuFull);
        tm.addMenuItem(req, simpleMenuBasic);

        tm.sortedChildren.should.eql([simpleMenuBasic.path, simpleMenuFull.path])

        done();

      });

      it('Creating menus with a non string sort sorts by that directly', function (done) {

        var tm = new Menu('MyMenu', 'order'), req = calipsoHelper.requests.testUser;

        // Add in reverse order to what we expect
        tm.addMenuItem(req, simpleMenuFull);
        tm.addMenuItem(req, simpleMenuBasic);

        tm.sortedChildren.should.eql([simpleMenuBasic.path, simpleMenuFull.path])

        done();

      });


    });

    describe('Recursing and displaying menus', function () {

      it('I can recursively scan the menu tree', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;
        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, childMenuShort);
        tm.addMenuItem(req, childMenuDeep);
        tm.addMenuItem(req, childMenuDeepLater);

        var output = [];
        var menuFn = function (menu) {
          return menu.path;
        }
        tm.fnRecurse(tm, menuFn, output);

        output.length.should.equal(5);
        output[0].should.equal(simpleMenuBasic.path);

        done();

      });

      it('I can highlight selected menu items in a tree based on current url matching', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        // Over-ride the url
        req.url = '/bob/child';

        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, childMenuShort);
        tm.addMenuItem(req, childMenuDeep);
        tm.addMenuItem(req, childMenuDeepLater);

        var selected = tm.selected(req);
        selected.length.should.equal(2);
        selected[0].should.equal(simpleMenuBasic.path);
        selected[1].should.equal(childMenuShort.path);
        done();

      });

      it('I can render a menu as html', function (done) {

        var tm = new Menu('MyMenu'), req = calipsoHelper.requests.testUser;

        tm.addMenuItem(req, simpleMenuBasic);
        tm.addMenuItem(req, childMenuShort);
        tm.addMenuItem(req, childMenuDeep);
        tm.addMenuItem(req, childMenuDeepLater);

        // Mock request object
        var html = tm.render(req);

        html.should.match(/MyMenu/);

        done();

      });


    });

    after(function () {

    })

  });
});
