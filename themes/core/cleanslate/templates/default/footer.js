/**
 * Additional content section / block functions for body.
 */

var calipso = require("lib/calipso");

exports = module.exports = function(req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(
    function getContent() {
      options.getBlock(/footer.*/, this.parallel());
    },
    function done(err, footer) {
      callback(err,{footer: footer});
    }
  );

};
