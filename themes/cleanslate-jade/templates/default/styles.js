/**
 * Additional content section / block functions for scripts.
 */

var calipso = require("../../../../lib/calipso");

exports = module.exports = function(req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(
    function getContent() {
      options.getBlock(/styles.*/,this.parallel());
    },
    function done(err, styles) {
      callback(err,{styles:styles});
    }
  );


};
