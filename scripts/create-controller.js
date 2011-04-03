var ejs = require('ejs')
   , fs = require('fs')
   , path = require('path')
   , inflection = require('../lib/inflection');

/** 
 * Script to create a default controller, requires the model to exist
 */
exports.execute = function(params,appPath) {
		 
	if(params.length == 0 ) {
		console.log("You must specifiy a model name to generate the controller against!");
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
	
	var controllerFile = appPath + "/controllers/" + controllerName + 'Controller.js'
	var controllerTemplate = __dirname + '/templates/create-controller.template.ejs';
		
	// Check if the model exists
	var fileCheck = path.existsSync(modelFile);
	if(!fileCheck) {		
		console.log("The model you have specified doesn't exist!");
		console.log("You need to create the model first.");
		console.log("e.g. script create-model " + modelName);
		return;		
	}

	// Check if the controller exists
	var fileCheck = path.existsSync(controllerFile);
	if(fileCheck) {		
		if(params[1] != "force") {
			console.log("The controller already exists!");
			console.log("Add an additional paramater of 'force' to over write the controller.");
			console.log("e.g. script create-controller " + modelName + " force");
			return;
		}
	}

	
	// Read the template
	var str = fs.readFileSync(controllerTemplate, 'utf8');		
	
	// Render the model
	var ret = ejs.render(str, {
	  locals: {		
	    controllerName:controllerName,
	    modelName:modelName
	  },open: "<?",close: "?>"
	});
	
	// Write the file
	fs.writeFileSync(controllerFile, ret,'utf8');
	
	console.log('Controller for model ' + modelName + ' created in controllers/' + controllerName + 'Controller.js');
	
	
};