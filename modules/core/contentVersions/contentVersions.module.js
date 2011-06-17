
/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var calipso = require('lib/calipso'), 
    Query = require('mongoose').Query,
    diff = require('utils/jsdiff');

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
        module.router.addRoute('GET /content/show/:id',showContent,{admin:true},this.parallel());
        module.router.addRoute('GET /content/show/:id/versions',listVersions,{admin:true,template:'list',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/version/:version',showVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/diff/:a',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/diff/:a/:b',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());

      },
      function done() {
        
        // Schemea
        var ContentVersion = new calipso.lib.mongoose.Schema({
          contentId:{type: String}
        });

        calipso.lib.mongoose.model('ContentVersion', ContentVersion);
        
        // Content post save hook to capture versions
        var Content = calipso.lib.mongoose.model('Content');
        Content.schema.post('save',function() {
           saveVersion(this);
        });

        // Form alteration
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
          {label:'Version?',name:'content[version]',type:'select',options:["No","Yes"],noValue:true,description:'This change creates a new version of the content.'},
          {label:'Comment',name:'content[comment]',type:'textarea',noValue:true,description:'Describe the reason for this version.'},          
         ]
}

/**
 * Show content menu 
 */
function showContent(req,res,template,block,next) {
  var id = req.moduleParams.id;
  res.menu.adminToolbar.addMenuItem({name:'Versions',path:'versions',url:'/content/show/' + id + '/versions',description:'Show versions ...',security:[]});
  next();
}

/**
 * Save version
 */
function saveVersion(content) {
    
    if(content.get("version") === "No")  {
      return;
    }    
    
    var ContentVersion = calipso.lib.mongoose.model('ContentVersion');
    
    // Create version and map fiels
    var version = new ContentVersion();    
    calipso.form.mapFields(content.doc,version);
    version.contentId = content._id;
    
    version.save(function(err) {
      if(err) {
        calipso.error(err);
      }
    });
    
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

//    res.send(req.moduleParams.a + " " + req.moduleParams.b);

    var a = req.moduleParams.a;
    var b = req.moduleParams.b;

      var ContentVersion = calipso.lib.mongoose.model('ContentVersion');

    
    ContentVersion.findById(a,function(err,versionA) {
        
        if(!err) {
          ContentVersion.findById(b,function(err,versionB) {
              if(!err) {              
                res.send(diff.diffString(versionA.get("content"),versionB.get("content")));
              } else {
                calipso.error(err);
                next();
              }
          });          
        } else {
          calipso.error(err);
           next();
        }
        
    });


}

/**
 * SHow list of versions
 */
function listVersions(req,res,template,block,next) {

      var id = req.moduleParams.id;      
  
      // Re-retrieve our object
      var ContentVersion = calipso.lib.mongoose.model('ContentVersion');
      
      res.menu.adminToolbar.addMenuItem({name:'Diff',path:'diff',description:'Diff versions ...',security:[]});
      res.menu.adminToolbar.addMenuItem({name:'Return',path:'return',url:'/content/show/' + id,description:'Show content ...',security:[]});

      var format = req.moduleParams.format ? req.moduleParams.format : 'html';

      var query = new Query({contentId:id});      

      // Initialise the block based on our content
      ContentVersion.find(query)
        .sort('updated', -1)
        .find(function (err, versions) {
            
              // Render the item into the response
              if(format === 'html') {
                calipso.theme.renderItem(req,res,template,block,{versions:versions},next);
              }

              if(format === 'json') {
                res.format = format;
                res.send(versions.map(function(u) {
                  return u.toObject();
                }));
                next();
              }

      });

      
}
