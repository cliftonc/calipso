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
 exports['I can create pre and post event emitters and emit an event, with no asynchronous callback'] = function() {
    
  var ee = new event.CalipsoEventEmitter();
  var eventCount = 0;  

  ee.addEvent('TEST');
  
  ee.pre('TEST','myPreListener',function(event,data) {
      eventCount++;      
  });      
  
  ee.post('TEST','myPostListener',function(event,data) {
      eventCount++;      
  });    
  
  ee.pre_emit('TEST',{data:"data"});
  ee.post_emit('TEST',{data:"data"});
  
  eventCount.should.equal(2);
  
};

exports['I can create a pre and post event emitters and emit an event, with an asynchronous callback'] = function() {
    
  var ee = new event.CalipsoEventEmitter();
  var eventCount = 0;  

  ee.addEvent('TEST');
  
  ee.pre('TEST','myPreListener',function(event,data,next) {
      eventCount++;
      data.newData = "Pre Hello World";      
      next(data);
  });    
  
  ee.post('TEST','myPostListener',function(event,data,next) {
      eventCount++;
      data.newData = "Post Hello World";      
      next(data);
  });    
  
  ee.pre_emit('TEST',{data:"data"},function(data) {
      data.newData.should.equal("Pre Hello World");
  });
  
  ee.post_emit('TEST',{data:"data"},function(data) {
      data.newData.should.equal("Post Hello World");
  });
  
  eventCount.should.equal(2);
  
};


exports['I can create a custom events'] = function() {
    
  var ee = new event.CalipsoEventEmitter();
  var eventCount = 0;  

  ee.addEvent('TEST');
  
  ee.custom('TEST','START','myListener',function(event,data,next) {
      eventCount++;
      data.start = "Started";      
      next(data);
  });    
  
  ee.custom('TEST','FINISH','myListener',function(event,data,next) {
      eventCount++;
      data.finish = "Finished";      
      next(data);
  });    
  
  ee.custom_emit('TEST','START',{data:"data"},function(data) {
      data.start.should.equal("Started");
  });
  
  ee.custom_emit('TEST','FINISH',{data:"data"},function(data) {
      data.finish.should.equal("Finished");
  });
  
  eventCount.should.equal(2);
  
};
