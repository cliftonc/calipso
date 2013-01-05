/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  fs = require('fs'),
  helper = require('./helpers/calipsoHelper'),
  mochaConfig = path.join(rootpath, 'tmp', 'mocha.json');

//calipso = require('./helpers/require')('calipso');

helper.finalize(function (err, calipsoHelper) {
  var calipso = calipsoHelper.calipso;

  describe('Calipso', function () {

    before(function (done) {
      try {
        fs.unlinkSync(mochaConfig);
      } catch (ex) { /** ignore **/
      }
      calipso.init(calipsoHelper.app, function (app) {
        done();
      })
    });

    describe('Basic loading and initialisation', function () {

      it('Calipso has loaded successfully', function (done) {
        calipso.loaded.should.equal(true);
        calipso.modules.should.exist;
        done();
      });

      it('I can send a mock request through.', function (done) {

        var req = calipsoHelper.requests.testUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

        req.url = '/';
        res.outputStack = [];

        // Over ride the res.end and increment our counter
        res.send = function (content) {
          response++;
        }

        routeFn(req, res, function (err) {
          response.should.equal(1);
          res.outputStack.should.eql(['module_first', 'module_b', 'module_last']);
          done();
        })

      });

      it('I can send a mock request through to an invalid route and get a 404', function (done) {

        var req = calipsoHelper.requests.testUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

        req.url = '/invalid.html';
        res.outputStack = [];

        // Over ride the res.end and increment our counter
        res.send = function (content) {
          response++;
        }

        routeFn(req, res, function (err) {
          response.should.equal(1);
          res.statusCode.should.equal(404);
          res.outputStack.should.eql(['module_first', 'module_last']);
          done();
        })

      });

      it('I can send a mock admin request through as an admin user', function (done) {

        var req = calipsoHelper.requests.adminUser,
          res = calipsoHelper.response,
          response = 0,
          responseContent = '',
          routeFn = calipso.routingFn();

        req.url = '/secured';
        res.outputStack = [];

        // Over ride the res.end and increment our counter
        res.send = function (content) {
          responseContent = content;
          response++;
        }
        routeFn(req, res, function (err) {
          response.should.equal(1);
          res.outputStack.should.eql(['module_first', 'module_a', 'module_last']);
          responseContent.should.match(/world/);
          done();
        })
      });

      it('I can send a mock admin request through and fail as a test user.', function (done) {
        var req = calipsoHelper.requests.anonUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

        req.cookies = {};
        req.url = '/secured';
        res.outputStack = [];

        routeFn(req, res, function (err) {
          res.outputStack.should.eql(['module_first', 'module_last']);
          req.flashMsgs[0].type.should.equal('error');
          res.redirectQueue.length.should.equal(1);
          res.redirectQueue[0].should.equal('/');
          response.should.equal(0); // Don't match
          done();
        })

      });

      it('I can reload the configuration', function (done) {
        calipso.reloadConfig('RELOAD', {}, function (err) {
          calipso.modules.should.exist;
          done();
        });
      });

    });

    after(function () {
      try {
        fs.unlinkSync(mochaConfig);
      } catch (ex) { /** ignore **/
      }
    })

  });
});
