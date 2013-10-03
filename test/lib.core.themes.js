/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
  fs = require('fs'),
  rootpath = process.cwd() + '/',
  path = require('path'),
  exec = require('child_process').exec,
  Themes = require('./helpers/require')('core/Themes');


/**
 * Create a theme config from a path to the json file
 * @param  {string} path Path to json file, relative to the fixtures/themes
 *                       directory (e.g. core/mocha/theme.json)
 * @return {Object}      object with name and path properties
 */
getThemeConfig = function(path) {
  var themeConfig = {
    name: path.match(/\/([^\/\.]+)\.json$/)[1],
    path : __dirname + '/' + path.match(/(.+)\/[^\/]+\.json/)[1] + '/'
  };
  return themeConfig;
};

describe('Themes', function () {

  before(function () {
    //
  });

  describe('Core', function () {

    var returned = false;

    it('I can instantiate a valid theme.json', function (done) {
      Themes.Theme(
        getThemeConfig('fixtures/themes/core/mocha/theme.json'),
        function(err, theme) {
          should.not.exist(err);
          theme.should.be.ok;
          done();
        }
      );
    });

    it('I can find errors in an invalid theme.json', function (done) {
      // NOTE: we're looking for specific errors that are in the invalid-schema
      // fixture -- not a comprehensive, and only ever as comprehensive
      // as the schema validator, anyway
      Themes.Theme(
        getThemeConfig('fixtures/themes/custom/invalid-schema/theme.json'),
        function(err, theme) {
          err.should.match(/\[theme\]\.type is required/);
          err.should.match(/\[theme\]\.layouts\.home\.layout\.template is required/);
          done();
        }
      );
    });

  });

  after(function () {

  })

});

