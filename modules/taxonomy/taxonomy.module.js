var calipso = require("../../lib/calipso");      

exports = module.exports = {init: init, route: route};


/**
 * Base taxonomy module to create menus
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      
     
      /**
       * Routes
       */            
      module.router.route(req,res,next);
      
};

function init(module,app,next) {      
  
  if(!calipso.modules.content.initialised) {
    process.nextTick(function() { init(module,app,next); });
    return;
  }
  
    // Any pre-route config  
  calipso.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,taxonomy,{end:false},this.parallel());
      },
      function done() {
        
        // Define our taxonomy
        var TaxonomyMenu = new calipso.lib.mongoose.Schema({
          // Tag name is in _ID from MR 
          "_id":{type:String},
          "value":{type: Number}
        });

        calipso.lib.mongoose.model('TaxonomyMenu', TaxonomyMenu);  
        
        
        // Add a post save hook to content
        
        var Content = calipso.lib.mongoose.model('Content');                
        Content.schema.post('save',function() { 
          mapReduceTaxonomy();
        });
        
        next();        
      }        
  );    
    
};


function mapReduceTaxonomy() {

  // We need to check if we are already map reducing ...
  if(calipso.mr.taxonomy) {
    // TODO : CHECK IF THIS MISSES THINGS ...    
    return;
  } 
  calipso.mr.taxonomy = true;
  
  var mongoose = calipso.lib.mongoose;
  
  var taxMap = function() { 
    if (!(this.taxonomy && this.taxonomy.split("/"))) { 
      return; 
    } 
   var taxArr = this.taxonomy.split("/");
   for (index in taxArr) {          
     var currentTax = "";
     for(i=0;i<=index;i++) {
       if(i>0) {
         currentTax += "/";
       }
       currentTax += taxArr[i];
     }
     emit(currentTax,  parseInt(index)); 
   } 
  }
  
  var taxReduce = function(previous, current) { 
    var count = 0; 
    for (index in current) { 
      count = current[index]; 
    } 
    return count; 
  }; 
   
  var command = { 
      mapreduce: "contents", // what are we acting on 
      map: taxMap.toString(), //must be a string 
      reduce: taxReduce.toString(), // must be a string 
      out: 'taxonomymenus' // what collection are we outputting to? mongo 1.7.4 + is different see http://www.mongodb.org/display/DOCS/MapReduce#MapReduce-Outputoptions 
  };

  mongoose.connection.db.executeDbCommand(command, function(err, dbres) 
  { 
    // Reset
    calipso.mr.taxonomy = false;
    if (err) { 
      // Do Something!!
      calipso.error(err);
    }        
  });
  
};

function taxonomy(req,res,template,block,next) {     
  
  // Generate the menu from the taxonomy  
  var TaxonomyMenu = calipso.lib.mongoose.model('TaxonomyMenu');      

  TaxonomyMenu.find({})
   .find(function (err, tax) {       
      // Render the item into the response
      // calipso.theme.renderItem(req,res,template,block,{tags:tags});
     
      tax.forEach(function(item) {
                
            res.menu.primary.push({name:item._id,url:'/section/' + item._id,regexp:/content/});  
                        
      });
      next();      
   });
  
};

//Disable - same as reload
function disable() {
  reload();
}

// Reload
function reload() {

  var Content = calipso.lib.mongoose.model('Content');                
  calipso.log(sys.inspect(Content.schema,true,10,true));
    
}