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
      options.getBlock('search.form',this.parallel());
    },
    function done(err,searchForm) {
      callback(err,{searchForm:searchForm});
    }
  );


};
