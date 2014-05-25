/**
 * Additional content section / block functions for body.
 */

var calipso, rootpath = process.cwd() + '/', path = require('path');
try {
  calipso = require(path.join(rootpath, 'lib/calipso'));
}
catch (e) {
  calipso = require('../../../../lib/calipso');
}
if (calipso.wrapRequire) {
  require = calipso.wrapRequire(require);
}

exports = module.exports = function (req, options, callback)
{

	/**
	 *  Get additional content for blocks in the template
	 */
	calipso.lib.step(
		function getContent()
		{
			options.getContent(req, 'about-me', this.parallel());
			options.getBlock('tagcloud', this.parallel());
			options.getBlock(/^side.*/, this.parallel());
		},
		function done(err, about, tagcloud, side)
		{
			callback(err, {about: about, tagcloud: tagcloud, side: side});
		}
	);

};