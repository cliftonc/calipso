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

  before(function(){

  });

  describe('Core', function(){
  
    it('Calipso has loaded successfully', function(done) {      
      calipso.loaded.should.equal(true);
      done();
    });

    it('Calipso can initialise', function(done) {    
      calipso.init(calipsoHelper.app, function(app) {
        done();
      })
    });

  }); 

  after(function() {
    
  })

});

