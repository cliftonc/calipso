/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    fs = require('fs'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    exec = require('child_process').exec,
    Event = require('./helpers/require')('core/Event');

describe('Events', function(){

  before(function(){
    // 
  });

  describe('General Events', function(){
    
    it('I can create pre and post event emitters and emit an event, with no asynchronous callback', function(done){ 
       
      var ee = new Event.CalipsoEventEmitter();
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

      done();
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

    it('', function(){    
      
    });

  }); 

  after(function() {
    
  })

});

