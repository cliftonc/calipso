
/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var calipso = require('lib/calipso'), 
    Query = require('mongoose').Query,
    diff = require('./support/jsdiff');

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
        module.router.addRoute('GET /content/show/:id/versions/diff/:a',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/versions/diff/:a/:b',diffVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/version/:version',showVersion,{admin:true,template:'show',block:'content.version'},this.parallel());
        module.router.addRoute('GET /content/show/:id/version/:version/revert',revertVersion,{admin:true},this.parallel());

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
          {label:'New Version?',name:'content[version]',type:'select',options:["No","Yes"],noValue:true,description:'This change marks the content as a new version.'},
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
    
    var ContentVersion = calipso.lib.mongoose.model('ContentVersion');
    
    // Create version and map fiels
    var version = new ContentVersion();    
    calipso.form.mapFields(content.doc,version);
    version.contentId = content._id;
    
    version.save(function(err) {
      if(err) {
        calipso.error(err);
      }
      if(version.get("version")) {
        // TODO - enable notification / event?
      }
    });
    
}




/**
 * Show version
 */
function showVersion(req,res,template,block,next) {

    var contentId = req.moduleParams.id;  
    var id = req.moduleParams.version;
    var format = req.moduleParams.format || 'html';

    var ContentVersion = calipso.lib.mongoose.model('ContentVersion');
    
    res.menu.adminToolbar.addMenuItem({name:'Return',path:'return',url:'/content/show/' + contentId + '/versions',description:'Show content ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'Revert',path:'revert',url:'/content/show/' + contentId + '/version/' + id + '/revert',description:'Revert to this version of content ...',security:[]});    
        
    ContentVersion.findById(id,function(err,version) {
        
        if(err && !version) {
          calipso.err(err);
          next();
          return;
        }
        
        if(format === 'html') {
          calipso.theme.renderItem(req,res,template,block,{version:version},next);
        }

        if(format === 'json') {
          res.format = format;
          res.send(version.map(function(u) {
            return u.toObject();
          }));
          next();
        }

  
    });

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
                // TODO : Use a proper HTML diff parser ... this only works for non-HTML
                var diffOutput = diff.diffString(versionB.get("teaser"),versionA.get("teaser"));                
                res.send(diffOutput);
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

/**
 * Revert version
 */
function revertVersion(req,res,template,block,next) {

    var contentId = req.moduleParams.id;  
    var id = req.moduleParams.version;
    var format = req.moduleParams.format || 'html';

    
    var Content = calipso.lib.mongoose.model('Content');    
    var ContentVersion = calipso.lib.mongoose.model('ContentVersion');
    
    ContentVersion.findById(id,function(err,version) {
        
        if(err && !version) {
          calipso.err(err);
          next();
          return;
        }
                
        // Copy over
        Content.findById(contentId,function(err,content) {
            
            if(err && !content) {
              calipso.err(err)
              next();
              return;
            }
          
           calipso.form.mapFields(version.doc,content);
           content.author = req.session.user.username;
           content.set("comment",'Reverted to version: ' + id);
           content.updated = new Date();
           content.set("version",'Yes');
           
           content.save(function(err) {
             res.redirect('/content/show/' + contentId);
             next();
           });
            
        });
        
  
    });

}

