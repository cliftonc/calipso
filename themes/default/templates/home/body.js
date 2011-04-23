/**
 * Additional content section / block functions for body.
 */

var calipso = require("../../../../lib/calipso");

exports = module.exports = function(req,options,callback) {
      
      /**
       *  Get additional content for blocks in the template
       */  
      calipso.lib.step(
        function getContent() {
          options.getContent(req,"welcome-text",this.parallel());
          options.getContent(req,"home-about-calipso",this.parallel());
          options.getContent(req,"home-quickstart",this.parallel());
          options.getContent(req,"home-guide",this.parallel());
        },
        function done(err,welcome,about,quickstart,guide) {            
          callback({welcome:welcome,about:about,quickstart:quickstart,guide:guide});
        }
      )
            
      
}