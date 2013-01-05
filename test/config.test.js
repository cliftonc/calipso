/**
 *  Sanity test
 *  Test must be executed serially as it runs
 *  against an app instance, this is typically executed by the make file
 **/

var rootpath = process.cwd() + '/',
  fs = require('fs'),
  exec = require('child_process').exec,
  path = require('path'),
  assert = require('assert'),
  sys = require(/^v0\.[012]/.test(process.version) ? "sys" : "util"),
  should = require('should'),
  Config = require('./helpers/require')('core/Configuration');

var defaultConfig = {
  "test":"test"
};

/**
 * Tests
 */
describe('Calipso config test', function () {
  it('I can create a development configuration', function (done) {
    mkdir(path.join(rootpath, 'tmp'), function () {
      fs.writeFileSync(path.join(rootpath, 'tmp', 'default.json'), JSON.stringify(defaultConfig));
      var conf = new Config({env:'development', path:path.join(rootpath, 'tmp')});
      conf.type.should.equal('file');
      conf.file.should.equal(path.join(rootpath, 'tmp', 'development.json'));
      done();
    });
  });

  it('I can add and retrieve configuration', function (done) {

    var conf = new Config({env:'development', path:path.join(rootpath, 'tmp')});
    conf.init(function () {
      conf.set('test:v1', 'v1');
      conf.get('test:v1').should.equal('v1');
      conf.set('test:v2', 'v2');
      conf.get('test:v2').should.equal('v2');

      var test = conf.get('test');
      test.v1.should.equal('v1');
      test.v2.should.equal('v2');
      done();
    });
  });

  it('I can use different environments (dev config)', function (done) {
    var confDev = new Config({env:'development', path:path.join(rootpath, 'tmp')});

    confDev.init(function () {
      confDev.set('test:v1', 'v1');
      confDev.get('test:v1').should.equal('v1');
      confDev.save(function (err) {
        (fs.existsSync || path.existsSync)(confDev.file);
        done();
      });
    });
  });
  it('I can use different environments (test config)', function (done) {
    var confTest = new Config({env:'test', path:path.join(rootpath, 'tmp')});
    confTest.init(function () {
      confTest.set('test:v1', 'v1');
      confTest.get('test:v1').should.equal('v1');
      confTest.save(function (err) {
        (fs.existsSync || path.existsSync)(confTest.file);
        done();
      });
    });
  });

  it('I can use the setSave shortcut', function (done) {

    var conf = new Config({path:path.join(rootpath, 'tmp')});
    conf.init(function () {
      conf.setSave('test:setsave', 'Yah!', function (err) {
        var confTest = new Config({path:path.join(rootpath, 'tmp')});
        confTest.init(function () {
          confTest.get('test:setsave').should.equal('Yah!');
          done();
        });
      });
    });
  });


  /**
   * Mkdir -p.
   *
   * TODO - these are unix only ...
   *
   * @param {String} path
   * @param {Function} fn
   */

  function mkdir(path, fn) {
    exec('mkdir -p ' + path, function (err) {
      if (err) {
        throw err;
      }
      fn && fn();
    });
  }
});
