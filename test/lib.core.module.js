/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  exec = require('child_process').exec,
  Module = require('./helpers/require')('core/Module');

describe('Modules', function () {

  before(function () {
    // 
  });

  describe('Core', function () {


    it('I am a placeholder', function () {

      // Most of the module tests will be done via lib.calipso, as it has a lot of dependencies on Calipso re. modules.

    });

  });

  after(function () {

  })

});

