/**
 *  Sanity test
 *  Test must be executed serially as it runs 
 *  against an app instance.
 **/
var assert = require('assert'), 
  mongoose = require('mongoose'),   
  should = require('should');

/**
 * Simple sanity tests to make sure that calipso will run.
 * 
 */

var cookie;

module.exports = { 

       setup: function(done){           

          require('../app').boot(function(server) {
             
             app = server;
             console.log("Server loaded - tests starting next tick ...");             
             process.nextTick(done);
                          	           
          });
             
        },
	     'Get the home page and confirm a 200': function(done) {
	          assert.response(app, {
                  url: '/',
                  method: 'GET'
              }, function(res) {
                  res.statusCode.should.equal(200);                  
                  done();
              });  
	      },
       'Get an invalid page as an anonymous user and get a 404': function(done) {
            assert.response(app, {
                  url: '/this-is-an-invalid-page.html',
                  method: 'GET'
              }, function(res) {
                  res.statusCode.should.equal(404);                  
                  done();
              });  
        },        
        'Logging in as an invalid user will flash an error and redirect me back to the home page': function(done){
              var data = 'user[username]=invalid&user[password]=login';
              assert.response(app, {
                  url: '/user/login',
                  method: 'POST',
                  headers: {'host':'dummyhost','Content-Length': data.length,'Content-Type':'application/x-www-form-urlencoded'},
                  data: data
              }, function(res) {                                        
                  res.statusCode.should.equal(302);                      
                  res.headers['location'].should.equal('http://dummyhost/');
                  done();
              });
        },        
        'I can login to calipso as the default administrator and it will redirect me back to the home page': function(done){
              var data = 'user[username]=admin&user[password]=password';
              assert.response(app, {
                  url: '/user/login',
                  method: 'POST',
                  headers: {'host':'dummyhost','Content-Length': data.length,'Content-Type':'application/x-www-form-urlencoded'},
                  data: data
              }, function(res) {                                   
                  cookie = res.headers['set-cookie'];   
                  res.statusCode.should.equal(302);                      
                  res.headers['location'].should.equal('http://dummyhost/');
                  done();
              });
        },
       'Get an invalid page as an admin user and get a 302 to create a new page': function(done) {
            assert.response(app, {
                  url: '/this-is-an-invalid-page.html',
                  method: 'GET',
                  headers:{'Cookie':cookie}
              }, function(res) {
                  res.statusCode.should.equal(302);                  
                  done();
              });  
        },
        tearDown: function(done){
           mongoose.disconnect();
            done(process.exit());
        }
}

