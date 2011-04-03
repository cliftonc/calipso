var ejs = require('ejs')
   , fs = require('fs');

/** 
 * Help file
 */
exports.execute = function(params,appPath) {
		 		
		if(params.length == 0) {
			var str = fs.readFileSync(__dirname + '/templates/help.ejs', 'utf8');	
		} else {
			var str = fs.readFileSync(__dirname + '/templates/' + params[0] + '.help.ejs', 'utf8');
		}		

		var scripts = [];
		
		fs.readdir(__dirname + '/', function(err, files){		    
		    
			if(err) {
				console.log(err);
			}
			
			files.forEach(function(file){
			   if(file.replace('.js','') != file) {
				   scripts.push(file.replace('.js',''));
			   }		       	
		    });			
						
			var ret = ejs.render(str, {
			  locals: {
			    params: params,
			    scripts: scripts
			  },open: "<?",close: "?>"			  
			});
			
			console.log(ret);
		
		});		  
		
		
};