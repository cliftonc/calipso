/**
 * Additional content section / block functions for body.
 */

var rootpath = process.cwd() + '/',
	path = require('path'),
	calipso = require(path.join(rootpath, 'lib/calipso'));

// todo - add an admin option for a config setting:
//        [either:]
//        a) output username for logged-in user serverside
//        b) output username for logged-in user to cookie, have clientside js display it.

exports = module.exports = function (req, options, callback)
{

	/**
	 *  Get additional content for blocks in the template
	 */
	calipso.lib.step(
		function getContent()
		{
			//options.getBlock('user.login',this.parallel());
			options.getBlock('search.form', this.parallel());
		},
		function done(err, userLogin, searchForm)
		{
			callback(err, {/*userLogin:userLogin,*/searchForm: searchForm});
		}
	);

};