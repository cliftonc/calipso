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
      options.getBlock('scripts.richforms.datepicker',this.parallel());
      options.getBlock('scripts.richforms.markitup',this.parallel());
      options.getBlock('scripts.pusher',this.parallel());
      options.getBlock('scripts.ga',this.parallel());

    },
    function done(err, datepicker, markitup, pusher, ga) {
      callback({datepicker:datepicker, markitup:markitup, pusher:pusher, ga:ga});
    }
  );


};
