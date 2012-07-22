/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    fs = require('fs'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    exec = require('child_process').exec,
    jsc = require('jscoverage'),
    require = jsc.require(module), // rewrite require function
    link = require('./helpers/require')('core/Link');

describe('Links', function(){

  before(function(){
    // 
  });

  describe('Core', function(){
  

    it('I am a placeholder', function(){    

    });

  }); 

  after(function() {
    
  })

});

