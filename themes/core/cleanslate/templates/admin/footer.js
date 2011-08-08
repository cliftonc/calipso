/**
 * Additional content section / block functions for body.
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso'));

exports = module.exports = function(req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  calipso.lib.step(
    function getContent() {
      options.getContent(req, "footer-about-calipso", this.parallel());
      options.getContent(req, "footer-links", this.parallel());
      options.getContent(req, "footer-right", this.parallel());
      options.getBlock("dev.tools", this.parallel());
    },
    function done(err, left, center, right, dev) {
      callback(err,{left:left, center:center, right:right, dev: dev});
    }
  );

};
