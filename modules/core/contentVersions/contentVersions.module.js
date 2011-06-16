
/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var calipso = require("lib/calipso"), Query = require("mongoose").Query;

exports = module.exports = {
  init: init,
  route: route,  
  about: {
    description: 'Provides versioning hooks and forms to enable storage and retrieval of different versions of content.',
    author: 'cliftonc',
    version: '0.2.0',
    home:'http://github.com/cliftonc/calipso'
  },
  depends:["content"]
};

/**
 * Router
 */
function route(req,res,module,app,next) {
      
      /**
       * Routing and Route Handler
       */
      module.router.route(req,res,next);

}

/**
 *Init
 */
function init(module,app,next) {

  calipso.lib.step(
      function defineRoutes() {

        // Crud operations
        module.router.addRoute('GET /content/show/:id/versions',listVersions,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/version/:version',showVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/diff/:a',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/diff/:a/:b',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());

      },
      function done() {
        
        // Schemea
        var ContentVersion = new calipso.lib.mongoose.Schema({
          contentId:{type: String},
          version: {type: Number},
          author: {type: String},
          comment: {type: String},
          created: {type: Date, default: Date.now},
          updated: {type: Date, default: Date.now}          
        });

        calipso.lib.mongoose.model('ContentVersion', ContentVersion);

        var Content = calipso.lib.mongoose.model('Content');
        
        // Content pre-save hook
        Content.schema.post('save',function() {

        });

        // Apply the alteration to the content form
        calipso.modules.content.fn.originalContentForm = calipso.modules.content.fn.contentForm;
        calipso.modules.content.fn.contentForm = function() {            
          var form = calipso.modules.content.fn.originalContentForm();
          form.sections.push(contentVersionFormSection);          
          return form;
        }
       
        next();

      }
  );
}

/**
 * Section to add to content form
 */
var contentVersionFormSection = {
  id:'form-section-content-version',
  label:'Versioning',
  fields:[
          {label:'Version?',name:'content[version]',type:'select',options:["No","Yes"],description:'This change creates a new version of the content.'},
          {label:'Comment',name:'content[comment]',type:'textarea',description:'Describe the reason for this version.'},          
         ]
}

/**
 * Show version
 */
function showVersion(req,res,template,block,next) {

    res.send(req.moduleParams.version);

}

/**
 * Show diff between versions
 */
function diffVersion(req,res,template,block,next) {

    res.send(req.moduleParams.a + " " + req.moduleParams.b);

}

/**
 * SHow list of versions
 */
function listVersions(req,res,template,block,next) {

    res.send(req.moduleParams.id);

}
