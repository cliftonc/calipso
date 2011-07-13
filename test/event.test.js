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
exports['I can create an event emitter'] = function() {
    
  var ee = new event.CalipsoEventEmitter();
  var eventCount = 0;  

  ee.addEvent('TEST');
  ee.addEvent('TEST2');
  
  ee.pre('TEST','bob1',function(data,next) {
      eventCount++;
      data.bob1 = "My Data";
      next(data);
  });  
  
  ee.post('TEST','bob1',function(data,next) {
      eventCount++;
      data.bob1 = "Changed Data";
      next(data);
  });
    
  ee.pre('TEST2','bob1',function(data,next) {
      eventCount++;
      data.blah = "Mixin?";
      next(data);
  });  
  
  ee.pre('TEST','bob2',function(data,next) {
      eventCount++;      
      data.bob2 = "My Data";
      next(data);
  });
  
  ee.pre_emit('TEST2',{data:"data"},function(data) {     
     data.blah.should.equal("Mixin?");
  });
    
  ee.post_emit('TEST',{data:"data"},function(data) {     
     data.bob1.should.equal("Changed Data");
  });
  
  ee.pre_emit('TEST',{data:"data"},function(data) {
      
     data.bob1.should.equal("My Data");
     data.bob2.should.equal("My Data");     
     
    ee.post_emit('TEST',data,function(data2) {       
       data2.bob1.should.equal("Changed Data");     
    });  
     
  });  
  
  eventCount.should.equal(5);
  
};

