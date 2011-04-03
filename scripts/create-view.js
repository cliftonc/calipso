var  ejs = require('ejs')
   , fs = require('fs')
   , path = require('path')
   , inflection = require('../lib/inflection');


/** 
 * Script to create a default view, requires the model to exist
 */
exports.execute = function(params,appPath) {
		 
	if(params.length == 0 ) {
		console.log("You must specifiy a model name to generate the views against!");
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
	
	var viewFolder = appPath + "/views/" + controllerName.toLowerCase();
	
	var viewIndexTemplate = __dirname + '/templates/create-view.template.index.ejs';
	var viewEditTemplate = __dirname + '/templates/create-view.template.edit.ejs';
	var viewShowTemplate = __dirname + '/templates/create-view.template.show.ejs';
		
	// Check if the model exists
	var fileCheck = path.existsSync(modelFile);
	if(!fileCheck) {		
		console.log("The model you have specified doesn't exist!");
		console.log("You need to create the model first.");
		console.log("e.g. script create-model " + modelName);
		return;		
	}

	// Check if the view exists
	var fileCheck = path.existsSync(viewFolder);
	if(fileCheck) {		
		if(params[1] != "force") {
			console.log("The views folder already exists for this model!");
			console.log("Add an additional paramater of 'force' to over write the views.");
			console.log("e.g. script create-view " + modelName + " force");
			return;
		}
	} else {
		fs.mkdirSync(viewFolder,'755');
	}	
	
	// Read the template
	var tmpIndex = fs.readFileSync(viewIndexTemplate, 'utf8');
	var tmpEdit = fs.readFileSync(viewEditTemplate, 'utf8');
	var tmpShow = fs.readFileSync(viewShowTemplate, 'utf8');
	
	// Render the views
	var retIndex = ejs.render(tmpIndex, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	var retEdit = ejs.render(tmpEdit, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	var retShow = ejs.render(tmpShow, { locals: { modelName:modelName, controllerName:controllerName },open: "<?",close: "?>" });
	
	// Write the file
	fs.writeFileSync(viewFolder + "/index.html", retIndex,'utf8');
	fs.writeFileSync(viewFolder + "/edit.html", retEdit,'utf8');
	fs.writeFileSync(viewFolder + "/show.html", retShow,'utf8');	
	
	console.log('Views ' + modelName + ' created in views/' + modelName.toLowerCase());
	
	
};