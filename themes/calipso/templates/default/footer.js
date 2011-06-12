/**
 * Additional content section / block functions for body.
 */

var calipso = require("../../../../lib/calipso");

exports = module.exports = function(req, options, callback) {
  
  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(
    function getContent() {
      options.getContent(req, "footer-about-calipso", this.parallel());
      options.getContent(req, "footer-links", this.parallel());
      options.getContent(req, "footer-right", this.parallel());
    },
    function done(err, left, center, right) {
      callback(err,{left:left, center:center, right:right});
    }
  );
  
};
