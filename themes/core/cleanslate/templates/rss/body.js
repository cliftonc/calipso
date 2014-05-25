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
			options.getBlock(/content.*/, this.parallel());
		}, function done(err, content)
		{
			callback(err, {
				content: content
			});
		});

};
