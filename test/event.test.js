/**
 *  Sanity test
 *  Test must be executed serially as it runs
 *  against an app instance, this is typically executed by the make file
 **/
require.paths.unshift(__dirname + "/../"); //make local application paths accessible
 
var assert = require('assert'),
    sys = require('sys'),
    should = require('should'),
    event = require('lib/Event');

/**
 * Tests
 */
exports['I can create an event emitter, it fires and can be enabled and disabled'] = function() {
    
  var ee = new event.CalipsoEventEmitter();
  var eventCount = 0;  

  ee.addEvent('TEST');
  ee.pre('TEST','bob',function(options) {
      eventCount++;
  });  
  ee.pre_emit('TEST',{data:"data"});  
  ee.events['TEST'].enabled = false;  
  ee.pre_emit('TEST',{data:"data"});  
  ee.events['TEST'].enabled = true;  
  ee.pre_emit('TEST',{data:"data"});  

  eventCount.should.equal(2);
  
};

