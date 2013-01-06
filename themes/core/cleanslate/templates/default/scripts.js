/**
 * Additional content section / block functions for scripts.
 */

var rootpath = process.cwd() + '/',
	path = require('path'),
	calipso = require(path.join(rootpath, 'lib/calipso'));

exports = module.exports = function (req, options, callback)
{

	/**
	 *  Get additional content for blocks in the template
	 */
	calipso.lib.step(
		function getContent()
		{
			options.getBlock(/^scripts.*/, this.parallel());
			options.getStyles(this.parallel());
			options.getScripts(this.parallel());
		},
		function done(err, scripts, styles, moduleScripts)
		{
			callback(err, {scripts: scripts, styles: styles, moduleScripts: moduleScripts});
		}
	);

};
