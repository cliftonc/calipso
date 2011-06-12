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
      options.getContent(req, "about-me", this.parallel());
      options.getBlock('user.login',this.parallel());
      options.getBlock('tagcloud',this.parallel());
    },
    function done(err, about, userLogin, tagcloud) {
      callback(err,{about:about,userLogin:userLogin, tagcloud:tagcloud});
    }
  );


};