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
      options.getBlock(/^content.*/, this.parallel());
      options.getBlock(/^admin.*/,this.parallel());
      options.getBlock('scripts.disqus',this.parallel());
    },
    function done(err, content, admin, disqus) {
      callback(err,{content:content,admin:admin,disqus: disqus});
    }
  );


};