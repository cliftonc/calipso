/**
 * Media management module
 */
var calipso = require("lib/calipso");

exports = module.exports = {
  init: init, 
  route: route
};

/**
 * Router
 */
function route(req,res,module,app,next) {

      // Menu
      res.menu.admin.addMenuItem({name:'Media Management',path:'cms/media',url:'/media',description:'Manage media ...',security:[]});
      
      res.menu.primary.addMenuItem({name:'Media Gallery',path:'media/gallery',url:'/media/gallery',description:'Gallery ...',security:[]});

      // Routes
      module.router.route(req,res,next);

};

/**
 * Init
 */
function init(module,app,next) {

  // Any pre-route config
  calipso.lib.step(
      function defineRoutes() {

        // Page
        module.router.addRoute('GET /media',mediaList,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('GET /media/gallery',galleryList,{template:'gallery',block:'content'},this.parallel());
        module.router.addRoute('GET /user/profile/:username',galleryList,{template:'gallery',block:'user.gallery'},this.parallel());

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
    calipso.theme.renderItem(req,res,template,block,{},next);

};

/**
 * List of galleries - either all or just for a user
 */
function galleryList(req,res,template,block,next) {

  // Render the item via the template provided above
  calipso.theme.renderItem(req,res,template,block,{},next);

};
