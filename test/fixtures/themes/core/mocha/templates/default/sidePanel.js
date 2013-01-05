/**
 * Additional content section / block functions for body.
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  step = require('step'),
  calipso = require(path.join(rootpath, (process.env.CALIPSO_COV ? 'lib-cov' : 'lib'), 'calipso'));

exports = module.exports = function (req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  step(
    function getContent() {
      options.getBlock(/^side.*/, this.parallel());
    },
    function done(err, side) {
      callback(err, {side:side});
    }
  );


};