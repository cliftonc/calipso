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
          options.getContent("about-me",this.parallel());                    
        },
        function done(err,about) {            
          callback({about:about.teaser});
        }
      )
            
      
}