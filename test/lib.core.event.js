/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  helper = require('./helpers/calipsoHelper', true);

helper.finalize(function (err, calipsoHelper) {
  var calipso = calipsoHelper.calipso;
  Event = require('./helpers/require')('core/Event');

  describe('Events', function () {

    before(function () {
      // 
    });

    describe('General Events', function () {

      it('I can create pre and post event emitters and emit an event, with no asynchronous callback', function (done) {

        var ee = new Event.CalipsoEventEmitter();
        ee.init();

        var eventCount = 0;

        ee.addEvent('TEST');

        ee.pre('TEST', 'myPreListener', function (event, data) {
          eventCount++;
        });

        ee.post('TEST', 'myPostListener', function (event, data) {
          eventCount++;
        });

        ee.pre_emit('TEST', {
          data:"data"
        });
        ee.post_emit('TEST', {
          data:"data"
        });

        eventCount.should.equal(2);

        done();

      });

      it('I can create a pre and post event emitters and emit an event, with an asynchronous callback', function (done) {

        var ee = new Event.CalipsoEventEmitter();
        ee.init();

        var eventCount = 0;

        ee.addEvent('TEST');

        var callbackFn = function (err, data) {
          eventCount++;
        }

        ee.pre('TEST', 'myPreListener', function (event, data, next) {
          eventCount++;
          data.newData = "Pre Hello World";
          next(data);
        });

        ee.post('TEST', 'myPostListener', function (event, data, next) {
          eventCount++;
          data.newData = "Post Hello World";
          next(data);
        });

        ee.pre_emit('TEST', {
          data:"data"
        }, function (data) {
          data.newData.should.equal("Pre Hello World");
        });

        ee.post_emit('TEST', {
          data:"data"
        }, function (data) {
          data.newData.should.equal("Post Hello World");
        });

        eventCount.should.equal(2);

        done();

      });

      it('I can create custom events', function (done) {

        var ee = new Event.CalipsoEventEmitter();
        ee.init();

        var eventCount = 0;

        ee.addEvent('TEST');

        ee.custom('TEST', 'START', 'startListener', function (event, data, next) {
          eventCount++;
          data.start = "Started";
          next(data);
        });

        ee.custom('TEST', 'FINISH', 'finishListener', function (event, data, next) {
          eventCount++;
          data.finish = "Finished";
          next(data);
        });

        ee.custom_emit('TEST', 'START', {
          data:"data"
        }, function (data) {
          data.start.should.equal("Started");
        });

        ee.custom_emit('TEST', 'FINISH', {
          data:"data"
        }, function (data) {
          data.finish.should.equal("Finished");
        });

        eventCount.should.equal(2);

        done();

      });

      it('I can reload events e.g. after a config reload', function (done) {

        var ee = new Event.CalipsoEventEmitter();
        ee.init();

        ee.addEvent('TEST2');
        ee.events['TEST2'].should.exist;
        ee.events['FORM'].should.exist;

        // Re-initialise
        ee.init();
        ee.events['TEST2'].should.not.exist;
        ee.events['FORM'].should.exist;

        done();

      });

    });

    describe('Module initialisation events', function () {

      it('I can add a module event listener to a module', function (done) {

        var module = {
          moduleName:'test'
        };

        Event.addModuleEventListener(module);

        module.event._events.should.exist;
        module.event.init_start.should.exist;
        module.event.init_finish.should.exist;

        done();

      });

    });

    describe('Module request events', function () {

      it('I can add a module event listener to a request object', function (done) {

        var notify = 0, register = 0, req = calipsoHelper.requests.testUser,
          res = calipsoHelper.response,
          re = new Event.RequestEventListener({
            notifyDependencyFn:function () {
              notify++
            }, // Normally to calipso.module.notifyDependenciesOfRoute
            registerDependenciesFn:function () {
              register++
            } // Normally to calipso.module.registerDependencies
          });

        re.registerModule(req, res, 'module_a');

        // We should be registered, no notifications.
        notify.should.equal(0);
        register.should.equal(1);
        re.modules.module_a.should.exist;

        // Fire route start
        re.modules.module_a.route_start();
        re.modules.module_a.route_finish();

        // Now have notifications
        notify.should.equal(1);
        re.modules.module_a.routed.should.equal(true);

        done();

      });

    });

    after(function () {

    })

  });
});