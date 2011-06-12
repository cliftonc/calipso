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
    options.getBlock(/content.*/, this.parallel());
  }, function done(err, content) {
    callback(err,{
	content:content
    });
  });

}
