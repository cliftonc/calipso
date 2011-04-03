/** 
 * Script to create a model, controller and views
 */
exports.execute = function(params,appPath) {
		 
	if(params.length == 0 ) {
		console.log("You must specifiy a model name to generate all of the assets for!");
		return;
	}
	
	var modelScript = require('./create-model');	
	var controllerScript = require('./create-controller');
	var viewScript = require('./create-view');
	var testScript = require('./create-test');
	
	modelScript.execute(params,appPath);
	controllerScript.execute(params,appPath);
	viewScript.execute(params,appPath);
	testScript.execute(params,appPath);
	
};