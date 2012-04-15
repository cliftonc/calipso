/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    calipsoHelper = require('./helpers/calipsoHelper'),
    calipso = calipsoHelper.calipso;

    //calipso = require('./helpers/require')('calipso');

describe('Calipso', function(){

  before(function(done){
      calipso.init(calipsoHelper.app, function(app) {
        done();
      })
  });

  describe('Basic loading and initialisation', function(){
  
    it('Calipso has loaded successfully', function(done) {      
      calipso.loaded.should.equal(true);
      calipso.modules.should.exist;
      done();
    });

    it('I can send a mock request through.', function(done) {    
      
      var req = calipsoHelper.requests.testUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

      // Over ride the res.end and increment our counter
      res.end = function(content) {
        response++;
      }

      routeFn(req, res, function(err) {
        response.should.equal(1);
        done();
      })

    });

    it('I can send a mock admin request through as an admin user', function(done) {    
      
      var req = calipsoHelper.requests.adminUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

      // Over ride the res.end and increment our counter
      res.end = function(content) {
        response++; 
      }

      routeFn(req, res, function(err) {
        response.should.equal(1);
        done();
      })

    });

    it('I can send a mock admin request through and fail as a test user.', function(done) {    
      
      var req = calipsoHelper.requests.anonUser,
          res = calipsoHelper.response,
          response = 0,
          routeFn = calipso.routingFn();

      req.url = '/secured';

      // Over ride the res.end and increment our counter
      res.end = function(content) {
        response++; 
      }

      routeFn(req, res, function(err) {
        req.flashMsgs[0].type.should.equal('error');
        res.redirectQueue.length.should.equal(1);
        res.redirectQueue[0].should.equal('/');
        response.should.equal(0); // Don't match        
        done();
      })

    });

    it('I can reload the configuration', function(done) {
      calipso.reloadConfig('RELOAD', {}, done);
    });

  }); 

  after(function() {
    
  })

});

