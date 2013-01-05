/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  exec = require('child_process').exec,
  Router = require('./helpers/require')('core/Router');

describe('Router', function () {

  before(function () {
    // 
  });

  describe('Core', function () {


    it('I am a placeholder', function () {
      true.should.equal(true);
    });

  });

  after(function () {

  })

});

