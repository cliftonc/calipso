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
  
    // Any pre-route config  
  calipso.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,taxonomy,{end:false},this.parallel());
      },
      function done() {
        
        // Add a post save hook to content
        var Content = calipso.lib.mongoose.model('Content');
        
        Content.schema.post('save',function() { 
            mrTaxonomy();
        });
        
        next();        
      }        
  );    
    
};

function mrTaxonomy() {
  calipso.debug("TAXONOMY MR");
};

function taxonomy(req,res,template,block,next) {     
  
  // Generate the menu from the taxonomy  
  res.menu.primary.push({name:'Content',url:'/content',regexp:/content/});
  
  next();      
  
};