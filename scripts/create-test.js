var  ejs = require('ejs')
   , fs = require('fs')
   , path = require('path')
   , inflection = require('../lib/inflection');


/** 
 * Script to create a default test scripts, requires the model to exist
 */
exports.execute = function(params,appPath) {
		 
	if(params.length == 0 ) {
		console.log("You must specifiy a model name to generate the tests against!");
		return;
	}
	
	/**
	 * Create the model based on a singular (e.g. people becomes person, users becomes user)
	 */
	var modelName = params[0].singularize();	
	if(modelName != params[0]) {
		console.log("Using model name as singular not plural: " + modelName);	
	}
	
	// Capitalise
	modelName = modelName.capitalize();	
	
	var modelFile = appPath + "/models/" + modelName + '.js'
	
	var controllerName = modelName.pluralize();
	
	var testFolder = appPath + "/tests/";
	
	var unitTemplate = __dirname + '/templates/create-test.template.unit.ejs';
	var integrationTemplate = __dirname + '/templates/create-test.template.integration.ejs';
	var functionalTemplate = __dirname + '/templates/create-test.template.functional.ejs';
		
	// Check if the model exists
	var fileCheck = path.existsSync(modelFile);
	if(!fileCheck) {		
		console.log("The model you have specified doesn't exist!");
		console.log("You need to create the model first.");
		console.log("e.g. script create-model " + modelName);
		return;		
	}

	// Check if the unit test exists 
	var fileCheck = path.existsSync(testFolder + "/unit/" + modelName + '.js');
	if(fileCheck) {		
		if(params[1] != "force") {
			console.log("Tests appear to already exist for this model!");
			console.log("Add an additional paramater of 'force' to over write the tests.");
			console.log("e.g. script create-test " + modelName + " force");
			return;
		}
	}
	
	// Read the template
	var tmpUnit = fs.readFileSync(unitTemplate, 'utf8');
	var tmpIntegration = fs.readFileSync(integrationTemplate, 'utf8');
	var tmpFunctional = fs.readFileSync(functionalTemplate, 'utf8');
	
	// Render the views
	var retUnit = ejs.render(tmpUnit, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	var retIntegration = ejs.render(tmpIntegration, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	var retFunctional = ejs.render(tmpFunctional, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	
	// Write the file
	fs.writeFileSync(testFolder + "/unit/" + modelName + '.js', retUnit,'utf8');
	fs.writeFileSync(testFolder + "/integration/" + controllerName + 'Controller.js', retIntegration,'utf8');
	fs.writeFileSync(testFolder + "/functional/" + modelName + '.js', retFunctional,'utf8');	
	
	console.log('Tests for ' + modelName + ' created in tests.');

	
};