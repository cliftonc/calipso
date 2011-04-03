
var assert = require('assert'), should = require('should'), mongoose = require('mongoose');
var app = require('app').boot();

/**
 * Simple expresso tests for the AppController
 */
module.exports = {
		
		'Default route shows the home page with a 200 status code': function(done){									
			assert.response(app, {
			    url: '/',
			    method: 'GET'
			}, function(res) {
				res.statusCode.should.equal(200);
				res.body.should.include.string('Welcome!');
			    done();
			});						
		},
		'An invalid route shows the 404 Error page': function(done){			
			assert.response(app, {
			    url: '/this/is/an/invalid/route',
			}, function(res){
				res.statusCode.should.equal(200);
				res.body.should.include.string('Cannot find /this/is/an/invalid/route');		
				done();
			});						
		},
		tearDown: function(done){
		   mongoose.disconnect();
		   done();
		}
		
};