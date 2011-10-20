/**
 * Additional content section / block functions for body.
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  step = require('step'),
  calipso = require(path.join(rootpath, 'lib/calipso'));

exports = module.exports = function(req, options, callback) {

  /**
   *  Get additional content for blocks in the template
   */
  step(
    function getContent() {
      options.getContent(req, 'about-me', this.parallel());
      options.getBlock('tagcloud',this.parallel());
      options.getBlock(/^side.*/,this.parallel());      
    },
    function done(err, about,tagcloud,side) {
      callback(err,{about:about,tagcloud:tagcloud, side:side});
    }
  );


};