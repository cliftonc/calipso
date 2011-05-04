/**
 * Calipso is included in every module
 */
var calipso = require("../../lib/calipso");      

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {init: init, route: route};

/**
 * Template module
 */
function route(req,res,module,app,next) {      

      /** 
       * Menu items
       */
      res.menu.primary.push({name:'Media',url:'/media',regexp:/media/});
  
      /**
       * Routes
       */            
      module.router.route(req,res,next);
      
};

function init(module,app,next) {      
  
  // Any pre-route config  
  calipso.lib.step(
      function defineRoutes() {
        
        // Page
        module.router.addRoute('GET /media',mediaList,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('GET /media/gallery',galleryList,{template:'gallery',block:'content'},this.parallel());
        module.router.addRoute('GET /user/profile/:username',galleryList,{template:'gallery',block:'content'},this.parallel());
        
      },
      function done() {
        
        // Schema
        var Media = new calipso.lib.mongoose.Schema({          
          originalName:{type: String, required: true},
          mediaType:{type: String, required: true},          
          author:{type: String, required: true},
          ispublic:{type: Boolean, required: true, default: false},                    
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now }
        });

        calipso.lib.mongoose.model('Media', Media);   
                
        // Schema
        var MediaGallery = new calipso.lib.mongoose.Schema({          
          name:{type: String, required: true},
          description:{type: String, required: true},          
          author:{type: String, required: true},
          ispublic:{type: Boolean, required: true, default: false},                    
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now }
        });

        calipso.lib.mongoose.model('MediaGallery', MediaGallery);   
                
        // Any schema configuration goes here
        next();
        
      }        
  );
    
    
};

/**
 * Admininstrative list of media
 */
function mediaList(req,res,template,block,next) {   
  
    // Render the item via the template provided above
    calipso.theme.renderItem(req,res,template,block,{});        
    next();
    
};

/**
 * List of galleries - either all or just for a user
 */
function galleryList(req,res,template,block,next) {   
  
  // Render the item via the template provided above
  calipso.theme.renderItem(req,res,template,block,{});        
  next();
  
};

