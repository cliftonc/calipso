
/**
 * Base taxonomy module to create menus
 */
var calipso = require("lib/calipso");

exports = module.exports = {
  init: init,
  route: route,
  about: {
    description: 'Simple taxonomy (menus based on categories) module, uses map reduce functions to create menu trees.',
    author: 'cliftonc',
    version: '0.1.1',
    home:'http://github.com/cliftonc/calipso'
  }
};

/**
 * Routes
 */
function route(req,res,module,app,next) {

  // Routes
  module.router.route(req,res,next);

};

/**
 *Init
 */
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
        
        // Register for events  
        calipso.e.post('CONTENT_CREATE',module.name,mapReduceTaxonomy);
        calipso.e.post('CONTENT_UPDATE',module.name,mapReduceTaxonomy);
        calipso.e.post('CONTENT_DELETE',module.name,mapReduceTaxonomy);

        next();
      }
  );

};

/**
 * Map reduce function
 */
function mapReduceTaxonomy(event,options,next) {

  // We need to check if we are already map reducing ...
  if(calipso.mr.taxonomy) {
    // TODO : CHECK IF THIS MISSES THINGS ...
    return next();    
  }
  calipso.mr.taxonomy = true;

  var mongoose = calipso.lib.mongoose;

  var taxMap = function() {

   if (!(this.taxonomy && this.taxonomy.split("/"))) {
      return;
   }

   // Not public or draft      
   if(!this.ispublic || this.status === "draft") return;

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
    return next();
  });

};

/**
 *Render menu
 */
function taxonomy(req,res,template,block,next) {

  // Generate the menu from the taxonomy
  var TaxonomyMenu = calipso.lib.mongoose.model('TaxonomyMenu');

  TaxonomyMenu.find({})
   .find(function (err, tax) {
      // Render the item into the response

      tax.forEach(function(item) {
          //TODO: This needs to be improved!        
          res.menu.primary.addMenuItem({name:item._id,path:item._id,url:'/section/' + item._id,description:'Link ...',security:[]});
      });
      next();
   });

};
