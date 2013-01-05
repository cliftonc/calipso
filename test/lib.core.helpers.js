/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  exec = require('child_process').exec,
  Helpers = require('./helpers/require')('core/Menu');

describe('Menus', function () {

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

