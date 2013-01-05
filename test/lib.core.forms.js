/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  exec = require('child_process').exec,
  Form = require('./helpers/require')('../lib/core/Form');

describe('Forms', function () {

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

