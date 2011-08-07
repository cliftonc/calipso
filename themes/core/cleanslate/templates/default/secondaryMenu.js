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
      options.getBlock('user.login',this.parallel());
      options.getBlock('search.form',this.parallel());
    },
    function done(err,userLogin,searchForm) {
      callback(err,{userLogin:userLogin,searchForm:searchForm});
    }
  );


};