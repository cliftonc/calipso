/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    fs = require('fs'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    exec = require('child_process').exec,
    Storage = require('./helpers/require')('core/Storage');

describe('Storage', function(){

  before(function(){
    // 
  });

  describe('Core', function(){
  

    it('I am a placeholder', function(){    
      true.should.equal(true);
    });

  }); 

  after(function() {
    
  })

});

