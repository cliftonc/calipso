/**
 *  Sanity test
 *  Test must be executed serially as it runs
 *  against an app instance, this is typically executed by the make file
 **/
var assert = require('assert'),
    mongoose = require('mongoose'),
    should = require('should'),
    path = require('path'),
    rootpath = process.cwd() + '/';

/**
 * Simple sanity tests to make sure that calipso will run.
 */
var adminCookie;

/**
 * Initialise server
 */
require('../app').boot(function(server) {

    app = server;

    exports['Get the home page and confirm a 200'] = function(done) {
        assert.response(app, {
            url: '/',
            method: 'GET'
        }, function(res) {
            res.statusCode.should.equal(200);
            done();
        });
    };

    exports['Get an invalid page as an anonymous user and get a 404'] = function(done) {
        assert.response(app, {
            url: '/this-is-an-invalid-page.html',
            method: 'GET'
        }, function(res) {
            res.statusCode.should.equal(404);
            done();
        });
    };

    exports['Logging in as an invalid user will flash an error and redirect me back to the home page'] = function(done) {
        var data = 'user[username]=invalid&user[password]=login';
        assert.response(app, {
            url: '/user/login',
            method: 'POST',
            headers: {
                'host': 'dummyhost',
                'Content-Length': data.length,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        }, function(res) {
            res.statusCode.should.equal(302);
            res.headers['location'].should.equal('http://dummyhost/');
            done();
        });
    };

    exports['I can login to calipso as the default administrator and it will redirect me back to the home page'] = function(done) {
        var data = 'user[username]=admin&user[password]=password';
        assert.response(app, {
            url: '/user/login',
            method: 'POST',
            headers: {
                'host': 'dummyhost',
                'Content-Length': data.length,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        }, function(res) {
            adminCookie = res.headers['set-cookie'];
            res.statusCode.should.equal(302);
            res.headers['location'].should.equal('http://dummyhost/');
            done();
        });
    };

    exports['Get an invalid page as an admin user and get a 302 to create a new page'] = function(done) {
        var url = 'this-is-an-invalid-page';
        assert.response(app, {
            url: '/' + url + '.html',
            method: 'GET',
            headers: {
                'host': 'dummyhost',
                'Cookie': adminCookie
            }
        }, function(res) {
            res.statusCode.should.equal(302);
            res.headers['location'].should.equal('http://dummyhost/content/new?alias=' + url + '&type=Article');
            done();
        });
    };

    exports['My profile page is valid and contains the user name'] = function(done) {
        assert.response(app, {
            url: '/user',
            method: 'GET',
            headers: {
                'host': 'dummyhost',
                'Cookie': adminCookie
            }
        }, function(res) {
            res.statusCode.should.equal(200);
            res.body.should.include.string('admin');
            done();
        });
    };

    exports['The admin page renders and contains the default modules are enabled'] = function(done) {
        var request = {
            method: 'GET',
            headers: {
                'host': 'dummyhost',
                'Cookie': adminCookie
            }
        };
        request.url = '/admin/core/config';
        assert.response(app, request, function(res) {
            res.statusCode.should.equal(200);
            res.body.should.include.string('Modules');
            done();
        });

    };

    exports['The content admin page renders'] = function(done) {
        var request = {
            method: 'GET',
            headers: {
                'host': 'dummyhost',
                'Cookie': adminCookie
            }
        };
        request.url = "/content";
        assert.response(app, request, function(res) {
            res.statusCode.should.equal(200);
            done();
        });
    };


    exports['The content types page renders'] = function(done) {
        var request = {
            method: 'GET',
            headers: {
                'host': 'dummyhost',
                'Cookie': adminCookie
            }
        };
        request.url = "/content/type";
        assert.response(app, request, function(res) {
            res.statusCode.should.equal(200);
            res.body.should.include.string('Article'); // Default content type
            done();
        });
    };

    // Ok, now lets test the modules
    calipso = require(path.join(rootpath, 'lib/calipso'));

    // Login as some modules may require admin access
    for(var module in calipso.modules) {

        var moduleName = calipso.modules[module].name;
        var modulePath = __dirname + "/../" + calipso.modules[module].path;
        var moduleTests = modulePath + "/test";

        // TODO ... launch or run, or integrate?

    };

    exports.tearDown = function(done) {
        mongoose.disconnect();
        done(process.exit());
    }

});