/**
 * Additional content section / block functions for body.
 */

var calipso = require("../../../../lib/calipso");

exports = module.exports = function(options,callback) {
      
      /**
       *  Get additional content for blocks in the template
       */  
      calipso.lib.step(
        function getContent() {
          options.getContent("welcome-text",this.parallel());                    
        },
        function done(err,welcome) {            
          callback({welcome:welcome.content});
        }
      )
            
      
}