/**
 * Base tag cloud module to create a cloud block
 */

var calipso = require("lib/calipso");

exports = module.exports = {
  init: init, 
  route: route
};

/**
 *Router
 */
function route(req,res,module,app,next) {

      // Route
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
        module.router.addRoute(/.*/,tagCloud,{end:false,template:'tagcloud',block:'tagcloud'},this.parallel());
      },
      function done() {

        // Define our tag clouds
        var Tag = new calipso.lib.mongoose.Schema({
          // Tag name is in _ID from MR
          "_id":{type:String},
          "value":{type: Number}
        });

        calipso.lib.mongoose.model('Tag', Tag);

        // Register for events  
        calipso.e.post('CONTENT_CREATE',module.name,mapReduceTagCloud);
        calipso.e.post('CONTENT_UPDATE',module.name,mapReduceTagCloud);
        calipso.e.post('CONTENT_DELETE',module.name,mapReduceTagCloud);
        
        next();
      }
  );

};

/**
 * Map reduce that creates a tag cloud in mongo
 */
function mapReduceTagCloud(event,options,next) {

  // We need to check if we are already map reducing ...
  if(calipso.mr.tagcloud) {

    // TODO : CHECK IF THIS MISSES THINGS ...    
    return next();

  }
  calipso.mr.tagcloud = true;

  var mongoose = calipso.lib.mongoose;

  var tagMap = function() {
    if (!this.tags || !this.ispublic || this.status === "draft") {
      return;
    }
   for (index in this.tags) {
     emit(this.tags[index], 1);
   }
  }

  var tagReduce = function(previous, current) {
    var count = 0;
    for (index in current) {
      count += current[index];
    }
    return count;
  };

  var command = {
      mapreduce: "contents", // what are we acting on
      map: tagMap.toString(), //must be a string
      reduce: tagReduce.toString(), // must be a string
      out: 'tags' // what collection are we outputting to? mongo 1.7.4 + is different see http://www.mongodb.org/display/DOCS/MapReduce#MapReduce-Outputoptions
  };

  mongoose.connection.db.executeDbCommand(command, function(err, dbres)
  {
    // Reset
    calipso.mr.tagcloud = false;
    if (err) {
      // Do Something!!
      calipso.error(err);
    }
    return next();

  });

  
  
 };

/**
 * Render the tag cloud
 */
function tagCloud(req,res,template,block,next) {

  var Tag = calipso.lib.mongoose.model('Tag');

  Tag.find({})
   .find(function (err, tags) {
      // Render the item into the response
      calipso.theme.renderItem(req,res,template,block,{tags:tags},next);
      
   });



};