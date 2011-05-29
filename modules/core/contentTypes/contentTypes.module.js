
/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var calipso = require("lib/calipso"), Query = require("mongoose").Query;

exports = module.exports = {
  init: init,
route: route,
install: install,
  about: {
    description: 'Core content management functions.',
    author: 'cliftonc',
    version: '0.1.1',
    home:'http://github.com/cliftonc/calipso'
  }};

/**
 * Router
 */
function route(req,res,module,app,next) {

      /**
       * Menu items
       */
      res.menu.admin.primary.push({name:req.t('Content Type'),url:'/content/type',regexp:/content\/type/});

      /**
       * Routing and Route Handler
       */
      module.router.route(req,res,next);

}

/**
 *Init
 */
function init(module,app,next) {

  if(!calipso.modules.content.initialised) {
    process.nextTick(function() { init(module,app,next); });
    return;
  }

  module.initialised = false;

  calipso.lib.step(
      function defineRoutes() {

        // Crud operations
        module.router.addRoute('GET /content/type',listContentType,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('GET /content/type/list.:format?',listContentType,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('POST /content/type/create',createContentType,{admin:true},this.parallel());
        module.router.addRoute('GET /content/type/new',createContentTypeForm,{admin:true,block:'content'},this.parallel());
        module.router.addRoute('GET /content/type/show/:id.:format?',showContentType,{template:'show',block:'content'},this.parallel());
        module.router.addRoute('GET /content/type/edit/:id',editContentTypeForm,{admin:true,block:'content'},this.parallel());
        module.router.addRoute('GET /content/type/delete/:id',deleteContentType,{admin:true},this.parallel());
        module.router.addRoute('POST /content/type/update/:id',updateContentType,{admin:true},this.parallel());

      },
      function done() {

        // Schemea
        var ContentType = new calipso.lib.mongoose.Schema({
          contentType:{type: String, required: true, unique: true, default:'default'},
          description:{type: String, required: true, default: 'Default Content Type'},
          layout:{type: String, required: true, default: 'default'},
          ispublic:{type: Boolean, required: true, default: true},
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now }
        });

        calipso.lib.mongoose.model('ContentType', ContentType);

        // Store the content types in an array for later use
        ContentType.post('save',function() {
          storeContentTypes(); // Store an array of their names in the theme
          updateContentAfterChange(); // Store an array of their names in the theme
        });

        storeContentTypes();

        module.initialised = true;

        next();

      }
  );
}

/**
 * Installation process - asynch
 * @returns
 */
function install(next) {

  // Create the default content types
  var ContentType = calipso.lib.mongoose.model('ContentType');

  calipso.lib.step(
      function createDefaults() {
          var c = new ContentType({contentType:'Article',
            description:'Standard page type used for most content.',
            layout:'default',
            ispublic:true
          });
          c.save(this.parallel());
          var c = new ContentType({contentType:'Block Content',
            description:'Content that is used to construct other pages in a page template via the getContent call, not visibile in the taxonomy or tag cloud.',
            layout:'default',
            ispublic:false
          });
          c.save(this.parallel());
      },
      function allDone(err) {
          if(err) {
            next(err)
          } else {
            calipso.log("Content types module installed ... ");
            next();
          }
      }
  )

}


/**
 * Content type create / edit form
 */
var contentTypeForm = {id:'FORM',title:'Form',type:'form',method:'POST',action:'/content/type',fields:[
        {label:'Content Type',name:'contentType[contentType]',type:'text'},
        {label:'Description',name:'contentType[description]',type:'text'},
        {label:'Layout',name:'contentType[layout]',type:'select',options:function() { return calipso.theme.getLayoutsArray() }},
        {label:'Is Public',name:'contentType[ispublic]',type:'select',options:["Yes","No"]}
     ],
     buttons:[
              {name:'submit',type:'submit',value:'Save Content Type'}
     ]};


/**
 * Create new content type
 */
function createContentType(req,res,template,block,next) {



  calipso.form.process(req,function(form) {

     if(form) {

      var ContentType = calipso.lib.mongoose.model('ContentType');

      var c = new ContentType(form.contentType);
      c.ispublic = form.contentType.contentType.ispublic === "Yes" ? true : false;

      var saved;

      c.save(function(err) {

        if(err) {
          req.flash('error',req.t('Could not save content type because {msg}.',{msg:err.message}));
          if(res.statusCode != 302) {
            res.redirect('/content/type/new');
          }
        } else {
          res.redirect('/content/type');
        }

        // If not already redirecting, then redirect
        next();

      });

     }
  });

}


/**
 * Create new content type
 */
function createContentTypeForm(req,res,template,block,next) {

  res.menu.admin.secondary.push({name:req.t('New Content Type'),parentUrl:'/content/type',url:'/content/type/new'});

  contentTypeForm.title = "Create Content Type";
  contentTypeForm.action = "/content/type/create";

  calipso.form.render(contentTypeForm,null,req,function(form) {
    calipso.theme.renderItem(req,res,form,block,{},next);
  });

}

/**
 * Edit content type
 */
function editContentTypeForm(req,res,template,block,next) {

  var ContentType = calipso.lib.mongoose.model('ContentType');
  var id = req.moduleParams.id;
  var item;

  res.menu.admin.secondary.push({name:req.t('New Content Type'),parentUrl:'/content/type',url:'/content/type/new'});
  res.menu.admin.secondary.push({name:req.t('Edit Content Type'),parentUrl:'/content/type' + id,url:'/content/type/edit/' + id});

  ContentType.findById(id, function(err, c) {

    if(err || c === null) {

      res.statusCode = 404;
      next();

    } else {

      contentTypeForm.title = "Edit Content Type";
      contentTypeForm.action = "/content/type/update/" + id;

      var values = {
          contentType: c
      }
      values.contentType.ispublic = c.ispublic ? "Yes" : "No";

      calipso.form.render(contentTypeForm,values,req,function(form) {
        calipso.theme.renderItem(req,res,form,block,{},next);
      });

    }

  });

}

/**
 * Update a content type
 */
function updateContentType(req,res,template,block,next) {


  calipso.form.process(req,function(form) {

    if(form) {

        var ContentType = calipso.lib.mongoose.model('ContentType');
        var id = req.moduleParams.id;

        ContentType.findById(id, function(err, c) {
          if (c) {

              c.contentType = form.contentType.contentType;
              c.description = form.contentType.description;
              c.layout = form.contentType.layout;
              c.ispublic = form.contentType.ispublic === "Yes" ? true : false;
              c.updated = new Date();

              c.save(function(err) {
                if(err) {
                  req.flash('error',req.t('Could not update content type because {msg}.',{msg:err.message}));
                  if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
                    res.redirect('/content/type/edit/' + req.moduleParams.id);
                  }
                } else {
                  res.redirect('/content/type/show/' + req.moduleParams.id);
                }
                next();
              });

          } else {
            req.flash('error',req.t('Could not locate that content type.'));
            res.redirect('/content/type');
            next();
          }
        });
    }

  });
}

/**
 * Show content type
 */
function showContentType(req,res,template,block,next,err,content,format) {

  var item;

  var ContentType = calipso.lib.mongoose.model('ContentType');
  var id = req.moduleParams.id;
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';

  ContentType.findById(id, function(err, content) {

    if(err || content === null) {
      item = {id:'ERROR',type:'content',meta:{title:"Not Found!",content:"Sorry, I couldn't find that content type!"}};
    } else {

      res.menu.admin.secondary.push({name:req.t('New Content Type'),parentUrl:'/content/type',url:'/content/type/new'});
      res.menu.admin.secondary.push({name:req.t('Edit Content Type'),parentUrl:'/content/type' + content.id, url:'/content/type/edit/' + content.id});
      res.menu.admin.secondary.push({name:req.t('Delete Content Type'),parentUrl:'/content/type' + content.id, url:'/content/type/delete/' + content.id});

      item = {id:content._id,type:'content',meta:content.toObject()};

    }

    // Set the page layout to the content type
    if(format === "html") {
      calipso.theme.renderItem(req,res,template,block,{item:item},next);
    }

    if(format === "json") {
      res.format = format;
      res.send(content.toObject());
      next();
    }


  });


}

/**
 * List all content types
 */
function listContentType(req,res,template,block,next) {

      // Re-retrieve our object
      var ContentType = calipso.lib.mongoose.model('ContentType');

      res.menu.admin.secondary.push({name:req.t('New Content Type'),parentUrl:'/content/type',url:'/content/type/new'});

      var format = req.moduleParams.format ? req.moduleParams.format : 'html';

      var query = new Query();

      // Initialise the block based on our content
      ContentType.count(query, function (err, count) {

        var total = count;

        ContentType.find(query)
          .sort('contentType', 1)
          .find(function (err, contents) {

                // Render the item into the response
                if(format === 'html') {
                  calipso.theme.renderItem(req,res,template,block,{items:contents},next);
                }

                if(format === 'json') {
                  res.format = format;
                  res.send(contents.map(function(u) {
                    return u.toObject();
                  }));
                  next();
                }

        });


    });
};

/**
 * Delete a content type
 * TODO - deal with referential integrity
 */
function deleteContentType(req,res,template,block,next) {

  var ContentType = calipso.lib.mongoose.model('ContentType');
  var id = req.moduleParams.id;

  ContentType.remove({_id:id}, function(err) {
    if(err) {
      req.flash('info',req.t('Unable to delete the content type because {msg}.',{msg:err.message}));
      res.redirect("/content/type");
    } else {
      req.flash('info',req.t('The content type has now been deleted.'));
      res.redirect("/content/type");
    }
    next();
  });

}

/**
 * Store content types in calipso.data cache
 */
function storeContentTypes() {

    var ContentType = calipso.lib.mongoose.model('ContentType');

    ContentType.find({},function (err, types) {
        if(err || !types) {
          // Don't throw error, just pass back failure.
          calipso.error(err);
        }
        delete calipso.data.contentTypes;
        calipso.data.contentTypes = [];
        types.forEach(function(type) {
          calipso.data.contentTypes.push(type.contentType);
        });

    });

}

/**
 * Hook to update content after change
 * TODO
 */
function updateContentAfterChange() {

  // TODO
  // Referential integrity update


}
