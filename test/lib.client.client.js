/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  helper = require('./helpers/calipsoHelper');

helper.finalize(function (err, calipsoHelper) {
  var calipso = calipsoHelper.calipso,
    Client = require('./helpers/require')('client/Client');

  describe('Client', function () {

    before(function () {
      //
    });

    describe('Adding scripts', function () {

      it('I can add a basic client script', function (done) {
        var client = new Client(), script = {name:'test', url:'/test.js', weight:10};
        client.addScript(script);
        client.scripts.length.should.equal(1);
        client.scripts[0].should.equal(script);
        done();
      });

      it('If there is no name, it assigns the url as the name', function (done) {
        var client = new Client(), script = {url:'/test.js', weight:10}, scriptWithName = {url:'/test.js', weight:10, name:'/test.js'};
        client.addScript(script);
        client.scripts.length.should.equal(1);
        client.scripts[0].should.eql(scriptWithName);
        done();
      });

      it('I can add core scripts just by name', function (done) {
        var client = new Client(), script = 'calipso', scriptWithName = {key:'calipso', url:'calipso.js', weight:-50, name:'calipso.js'};
        client.addScript(script);
        client.scripts.length.should.equal(1);
        client.scripts[0].should.eql(scriptWithName);
        done();
      });

      it('I can add a script just by name', function (done) {
        var client = new Client(), script = '/myscript.js', scriptWithName = {url:'/myscript.js', weight:0, name:'/myscript.js'};
        client.addScript(script);
        client.scripts.length.should.equal(1);
        client.scripts[0].should.eql(scriptWithName);
        done();
      });


      it('Adding a script twice does not duplicate it', function (done) {
        var client = new Client(), script = {name:'test', url:'/test.js', weight:10};

        client.addScript(script);
        client.addScript(script);

        client.scripts.length.should.equal(1);
        client.scripts[0].should.equal(script);
        done();

      });


    });

    describe('Adding styles', function () {

      it('I can add a basic client style', function (done) {
        var client = new Client(), style = {name:'test', url:'/test.css', weight:10};
        client.addStyle(style);
        client.styles.length.should.equal(1);
        client.styles[0].should.equal(style);
        done();
      });

      it('If there is no name, it assigns the url as the name', function (done) {
        var client = new Client(), style = {url:'/test.css', weight:10}, styleWithName = {url:'/test.css', weight:10, name:'/test.css'};
        client.addStyle(style);
        client.styles.length.should.equal(1);
        client.styles[0].should.eql(styleWithName);
        done();
      });

      it('I can add a style by just passing in a url', function (done) {
        var client = new Client(), style = '/test.css', styleWithName = {url:'/test.css', weight:0, name:'/test.css'};
        client.addStyle(style);
        client.styles.length.should.equal(1);
        client.styles[0].should.eql(styleWithName);
        done();
      });


    });

    describe('Listing scripts and styles', function () {

      it('Listing scripts satisfies the ordering defined', function (done) {
        var client = new Client(),
          s1 = {url:'/test1.js', weight:10},
          s2 = {url:'/test2.js', weight:-10};

        client.addScript(s1);
        client.addScript(s2);

        client.listScripts(function (err, scripts) {
          should.not.exist(err);
          scripts.should.match(/<script title=\"\/test2\.js\" src=\"\/test2\.js\"><\/script>\r\n<script title=\"\/test1\.js\" src=\"\/test1\.js\">/);
          done();
        })

      });

      it('Listing styles satisfies the ordering defined', function (done) {
        var client = new Client(),
          s1 = {url:'/test1.css', weight:10},
          s2 = {url:'/test2.css', weight:-10};

        client.addStyle(s1);
        client.addStyle(s2);

        client.listStyles(function (err, styles) {
          should.not.exist(err);
          styles.should.match(/<link rel=\"stylesheet\" title=\"\/test2\.css\" href=\"\/test2\.css\"\/>\r\n<link rel=\"stylesheet\" title=\"\/test1\.css\" href=\"\/test1\.css\"\/>/);
          done();
        })

      });

    });

    after(function () {

    })

  });
});
