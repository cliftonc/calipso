/**
 * Base content module
 * This is the core module that provides the basic content management
 * functions.
 */
var calipso = require("lib/calipso"), Query = require("mongoose").Query, utils = require('connect').utils, merge = utils.merge;

exports = module.exports = {
  init: init,
  route: route,
  titleAlias: titleAlias,
  jobs:{scheduledPublish:scheduledPublish},
  contentForm:contentForm
};

/**
 * Standard module route function.
 */
function route(req,res,module,app,next) {

      /**
       * Menu items
       */
      res.menu.admin.addMenuItem({name:'Content Management',path:'cms',url:'/content',description:'Manage content ...',security:[]});
      res.menu.admin.addMenuItem({name:'Content',path:'cms/content',url:'/content',description:'Manage content ...',security:[]});                  
      
      /**
       * Routing and Route Handler
       */
      module.router.route(req,res,next);

}


/**
 * Module initiation
 */
function init(module,app,next) {

  // Register events for the Content Module
  calipso.e.addEvent('CONTENT_CREATE');
  calipso.e.addEvent('CONTENT_UPDATE');
  calipso.e.addEvent('CONTENT_DELETE');
  calipso.e.addEvent('CONTENT_CREATE_FORM');
  calipso.e.addEvent('CONTENT_UPDATE_FORM');
  
  // There are dependencies, so we need to track if this is initialised
  module.initialised = false;

  calipso.lib.step(
      function defineRoutes() {

        // Default routes
        module.router.addRoute('GET /',homePage,{template:'list',block:'content'},this.parallel());
        
        // TODO
        module.router.addRoute('GET /tag/:tag.:format?',listContent,{template:'list',block:'content'},this.parallel());        
        module.router.addRoute('GET /section/:t1?/:t2?/:t3?/:t4?.:format?',listContent,{template:'list',block:'content'},this.parallel());

        // Alias for SEO friendly pages, match to prefix excluding content pages
        module.router.addRoute(/^((?!content).*)\.html/,showAliasedContent,{template:'show',block:'content'},this.parallel());
        module.router.addRoute(/^((?!content).*)\.json/,showAliasedContent,{template:'show',block:'content'},this.parallel());

        // Admin operations
        module.router.addRoute('GET /content',listContent,{admin:true,template:'listAdmin',block:'content'},this.parallel());
        module.router.addRoute('GET /content/list.:format?',listContent,{admin:true,template:'listAdmin',block:'content'},this.parallel());
        module.router.addRoute('POST /content',createContent,{admin:true},this.parallel());
        module.router.addRoute('GET /content/new',createContentForm,{admin:true,block:'content'},this.parallel());
        module.router.addRoute('GET /content/show/:id.:format?',showContentByID,{admin:true,template:'show',block:'content'},this.parallel());
        module.router.addRoute('GET /content/edit/:id',editContentForm,{admin:true,block:'content'},this.parallel());
        module.router.addRoute('GET /content/delete/:id',deleteContent,{admin:true},this.parallel());
        module.router.addRoute('POST /content/:id',updateContent,{admin:true},this.parallel());

      },
      function done() {

        // Add dynamic helpers
        calipso.dynamicHelpers.getContent = function() {

          return function(req,alias,next) {

            var Content = calipso.lib.mongoose.model('Content');

            Content.findOne({alias:alias},function (err, content) {
                if(err || !content) {

                  var text = req.t("Click to create") + ": " +
                  " <a title='" + req.t("Click to create") + " ...' href='/content/new?" +
                  "type=Block%20Content" +
                  "&alias=" + alias +
                  "&teaser=Content%20for%20" + alias +
                  "&returnTo=" + req.url +
                  "'>" + alias +"</a>";

                  // Don't throw error, just pass back failure.
                  next(null,text);

                } else {

                  var text;
                  if(req.session && req.session.user && req.session.user.isAdmin) {
                    text = "<span title='" + req.t("Double click to edit content block ...") + "' class='content-block' id='" + content._id + "'>" +
                      content.content + "</span>"
                  } else {
                    text = content.content;
                  }

                  next(null,text);

                }
            });

          }

        }

        // Get content list helper
        calipso.dynamicHelpers.getContentList = function() {
          return getContentList;
        }

        // Default Content Schema
        var Content = new calipso.lib.mongoose.Schema({
          title:{type: String, required: true, default: ''},
          teaser:{type: String, required: false, default: ''},
          taxonomy:{type: String, default:''},
          content:{type: String, required: false, default:''},
          status:{type: String, required: false, default:'draft'},
          alias:{type: String, required: true},
          author:{type: String, required: true},
          etag:{type: String, default:''},
          tags:[String],
          published: { type: Date },
          scheduled: { type: Date },
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now },
          contentType:{type: String},  // Copy from content type          
          layout:{type: String},       // Copy from content type
          ispublic:{type: Boolean}    // Copy from content type        
        });

        // Set post hook to enable simple etag generation
        Content.pre('save', function (next) {
          this.etag = calipso.lib.crypto.etag(this.title + this.teaser + this.content);
          next();
        });

        calipso.lib.mongoose.model('Content', Content);

        module.initialised = true;

        next();

      }
  );
}

/**
 * Local default for the content create / edit form
 */
function contentForm() {
      return {id:'content-form',title:'Create Content ...',type:'form',method:'POST',action:'/content',tabs:true,
          sections:[{
            id:'form-section-content',
            label:'Content',
            fields:[
                    {label:'Title',name:'content[title]',type:'text',description:'Title to appear for this piece of content.'},
                    {label:'Permanent URL / Alias',name:'content[alias]',type:'text',description:'Permanent url (no spaces or invalid html characters), if left blank is generated from title.'},
                    {label:'Type',name:'content[contentType]',type:'select',options:function() { return calipso.data.contentTypes },description:'Select the type, this impacts custom fields and page display.'},
                    {label:'Teaser',name:'content[teaser]',type:'textarea',description:'Enter some short text that describes the content, appears in lists.'},
                    {label:'Content',name:'content[content]',type:'textarea',description:'Enter the full content text.'}
                   ]
          },{
            id:'form-section-category',
            label:'Categorisation',
            fields:[
                    {label:'Taxonomy',name:'content[taxonomy]',type:'text',description:'Enter the menu heirarchy, e.g. "welcome/about"'},
                    {label:'Tags',name:'content[tags]',type:'text',description:'Enter comma delimited tags to help manage this content.'},
                   ]
          },{
            id:'form-section-status',
            label:'Status',
            fields:[
                    {label:'Status',name:'content[status]',type:'select',options:["draft","scheduled","published"],description:'Select the status (published is visible to all public).'},
                    {label:'Published',name:'content[published]',type:'datetime',description:'Date to appear as published.'},
                    {label:'Scheduled',name:'content[scheduled]',type:'datetime',description:'Date to be published (if scheduled).'},
                   ]
          }
          ],
          fields:[
            {label:'',name:'returnTo',type:'hidden'}
          ],
          buttons:[
               {name:'submit',type:'submit',value:'Save Content'}
          ]};
}

/**
 * Default home page, only specify the layout.
 */
function homePage(req,res,template,block,next) {
    res.layout = "home";
    next();
}

/**
 * Create content - processed after create form submission.
 */
function createContent(req,res,template,block,next) {

  calipso.form.process(req,function(form) {

    if(form) {

          var Content = calipso.lib.mongoose.model('Content');
          var ContentType = calipso.lib.mongoose.model('ContentType');


          var c = new Content(form.content);

          c.alias = c.alias ? c.alias : titleAlias(c.title);
          c.tags = form.content.tags ? form.content.tags.split(",") : [];
          c.author = req.session.user.username;

          var returnTo = form.returnTo ? form.returnTo : "";

          // Get content type
          ContentType.findOne({contentType:form.content.contentType}, function(err, contentType) {


              if(err || !contentType) {

                calipso.debug(err);
                req.flash('error',req.t('Could not create content as I was unable to locate content type {type}.',{type:form.content.contentType}));
                res.redirect('/content');
                next();

              } else {

                // Copy over content type data - in meta as this is
                // not mastered here
                c.contentType = contentType.contentType;
                c.layout = contentType.layout;
                c.ispublic = contentType.ispublic;

                // Emit event pre-save, this DOES NOT Allow you to change
                // The content item (yet).
                calipso.e.pre_emit('CONTENT_CREATE',c,function(c) {
                
                  c.save(function(err) {
                    if(err) {
                      calipso.debug(err);
                      req.flash('error',req.t('Could not save content because {msg}.',{msg:err.message}));
                      if(res.statusCode != 302) {
                          res.redirect('/content/new');
                      }
                      next();
                    } else {
                      req.flash('info',req.t('Content saved.'));
                      
                      // Raise CONTENT_CREATE event
                      calipso.e.post_emit('CONTENT_CREATE',c,function(c) {
                          
                        if(returnTo) {
                          res.redirect(returnTo);
                        } else {
                          res.redirect('/content/show/' + c._id);
                        }
                        next();
                      });
                      
                    }
                    
                  });
                  
                });
              }

          });
      }

  });

}

/**
 * Enable creation of the title alias based on the title.
 * TODO : Turn into a setter??
 * @param title
 * @returns
 */
function titleAlias(title) {
  return title
    .toLowerCase() // change everything to lowercase
    .replace(/^\s+|\s+$/g, "") // trim leading and trailing spaces
    .replace(/[_|\s]+/g, "-") // change all spaces and underscores to a hyphen
    .replace(/[^a-z\u0400-\u04FF0-9-]+/g, "") // remove all non-cyrillic, non-numeric characters except the hyphen
    .replace(/[-]+/g, "-") // replace multiple instances of the hyphen with a single instance
    .replace(/^-+|-+$/g, "") // trim leading and trailing hyphens
    .replace(/[-]+/g, "-")
}

/**
 * Create the form based on the fields defined in the content type
 * Enable switching of title etc. from create to edit
 */
function getForm(req,action,title,contentType,next) {

  // Create the form
  var form = exports.contentForm(); // Use exports as other modules may alter the form function
  form.action = action;
  form.title = title;

  // Get content type
  var ContentType = calipso.lib.mongoose.model('ContentType');

  ContentType.findOne({contentType:contentType}, function(err, ct) {

    // Add any fields
    if(!err && ct && ct.get("fields")) { // FIX as this added later, get is 'safer' if not existing in document

      var fields = [];

      try {
        var fields = JSON.parse(ct.fields)
      } catch(ex) {
        // Issue with our fields
        req.flash("error",req.t("The content type you are editing has invalid fields defined, please check the content type configuration."));
      }

      // Process any additional fields
      form = calipso.form.processFields(form,fields);

    }

    next(form);

  });

}

/**
 * Create Content Form
 * Create and render the 'New Content' page.
 * This allows some defaults to be passed through (e.g. from missing blocks).
 */
function createContentForm(req,res,template,block,next) {

  // Allow defaults to be passed in
  if(req.moduleParams.type) { 
    
    // we have had one passed in, use it and continue    
    createContentFormByType(req,res,template,block,next);
    
  } else {    
    
    var alias = req.moduleParams.alias ? req.moduleParams.alias : "";
    var teaser = req.moduleParams.teaser ? req.moduleParams.teaser : "";
    var taxonomy = req.moduleParams.taxonomy ? req.moduleParams.taxonomy : "";  
    var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";  
    var type = "Article";         // Hard coded default TODO fix      
    
    // Create the form
    var form = {id:'content-type-form',title:'Create Content ...',type:'form',method:'GET',action:'/content/new',tabs:true,
          fields:[
            {label:'Type',name:'type',type:'select',options:function() { return calipso.data.contentTypes },description:'Select the type of content you want to create ...'},
            {label:'',name:'alias',type:'hidden'},
            {label:'',name:'teaser',type:'hidden'},
            {label:'',name:'taxonomy',type:'hidden'},            
            {label:'',name:'returnTo',type:'hidden'}
          ],
          buttons:[
               {name:'submit',type:'submit',value:'Next'}
          ]};

    
    // Default values
    var values = {
        content: {
          contentType:type,
        },
        alias:alias,
        teaser:teaser,
        taxonomy:taxonomy
    }
    
    res.layout = 'admin';
    
    calipso.form.render(form,values,req,function(form) {
      calipso.theme.renderItem(req,res,form,block,{},next);
    });
    
  }
  
}

/**
 * Create Content Form
 * Create and render the 'New Content' page.
 * This allows some defaults to be passed through (e.g. from missing blocks).
 */
function createContentFormByType(req,res,template,block,next) {
  
  var type = req.moduleParams.type ? req.moduleParams.type : "Article";         // Hard coded default TODO fix
  
  // Allow defaults to be passed in
  var alias = req.moduleParams.alias ? req.moduleParams.alias : "";
  var teaser = req.moduleParams.teaser ? req.moduleParams.teaser : "";
  var taxonomy = req.moduleParams.taxonomy ? req.moduleParams.taxonomy : "";  
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";  
  
  // Create the form
  getForm(req,"/content",req.t("Create Content ..."),type,function(form) {

    // Default values
    var values = {
        content: {
          title:alias,  // Default the title to the alias
          alias:alias,
          teaser:teaser,
          contentType:type,
          taxonomy:taxonomy,
          returnTo: returnTo
        }
    }

    res.layout = 'admin';
    
    calipso.e.pre_emit('CONTENT_CREATE_FORM',form,function(form) {
      calipso.form.render(form,values,req,function(form) {        
          calipso.theme.renderItem(req,res,form,block,{},next);          
      });
    });
  });

}


/**
 * Edit Content Form
 * Edit an existing piece of content.
 */
function editContentForm(req,res,template,block,next) {

  var Content = calipso.lib.mongoose.model('Content');
  var id = req.moduleParams.id;
  var item;

  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  res.menu.adminToolbar.addMenuItem({name:'List',weight:1,path:'list',url:'/content/',description:'List all ...',security:[]});        
  res.menu.adminToolbar.addMenuItem({name:'View',weight:2,path:'show',url:'/content/show/' + id,description:'Show current ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Edit',weight:3,path:'edit',url:'/content/edit/' + id,description:'Edit content ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Delete',weight:4,path:'delete',url:'/content/delete/' + id,description:'Delete content ...',security:[]});


  Content.findById(id, function(err, c) {

    if(err || c === null) {

      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      next();

    } else {

      // Create the form
      getForm(req,"/content/" + id,req.t("Edit Content ..."),c.contentType,function(form) {

        // Default values
        var values = {content: c};

        // Fix for content type being held in meta field
        // TODO this has a bad smell
        values.contentType = values.content.contentType;
        values.returnTo = returnTo;

        res.layout = 'admin';

        // Test!
        calipso.e.pre_emit('CONTENT_UPDATE_FORM',form,function(form) {
          calipso.form.render(form,values,req,function(form) {
            calipso.theme.renderItem(req,res,form,block,{},next);
          });
        });

      });

    }

  });

}

/**
 * Update Content - from form submission
 */
function updateContent(req,res,template,block,next) {

   calipso.form.process(req,function(form) {

      if(form) {

        var Content = calipso.lib.mongoose.model('Content');
        var ContentType = calipso.lib.mongoose.model('ContentType');

        var returnTo = form.returnTo ? form.returnTo : "";
        var id = req.moduleParams.id;

        Content.findById(id, function(err, c) {
          if (c) {

              // Default mapper
              calipso.form.mapFields(form.content,c);
                                       
              // Fields that are mapped specifically
              c.updated = new Date();
              c.alias = form.content.alias ? form.content.alias : titleAlias(c.title);
              c.tags = form.content.tags ? form.content.tags.replace(/[\s]+/g, "").split(",") : [];
              
              // Get content type
              ContentType.findOne({contentType:form.content.contentType}, function(err, contentType) {

                  if(err || !contentType) {
                    req.flash('error',req.t('Could not save content as I was unable to locate content type {type}.',{type:form.content.contentType}));
                    res.redirect('/content');
                    next();
                  } else {

                    // Copy over content type data
                    c.contentType = contentType.contentType;
                    c.layout = contentType.layout;
                    c.ispublic = contentType.ispublic;

                    // Emit pre event
                    // This does not allow you to change the content
                    calipso.e.pre_emit('CONTENT_CREATE',c,function(c) {                    
                        
                      c.save(function(err) {
                        if(err) {
                          
                          var errorMsg = '';
                          if(err.errors) {
                            for(var error in err.errors) {
                              errorMessage = error + " " + err.errors[error] + '\r\n';
                            }
                          } else {
                            errorMessage = err.message;
                          }
                          req.flash('error',req.t('Could not update content because {msg}',{msg:errorMessage}));
                          if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
                            res.redirect('back');
                          }
                          next();
                          
                        } else {
                           
                          req.flash('info',req.t('Content saved.'));
                          
                          // Raise CONTENT_CREATE event
                          calipso.e.post_emit('CONTENT_UPDATE',c,function(c) {
                            if(returnTo) {
                              res.redirect(returnTo);
                            } else {
                              // us the reference to the originally id deifned by req.moduleParams.id
                              res.redirect('/content/show/' + id);
                            }
                            next();
                          });
                          
                        }                        
  
                      });
                      
                    });               
                    
                  }

              });

          } else {
            req.flash('error',req.t('Could not locate content, it may have been deleted by another user or there has been an error.'));
            res.redirect('/content');
            next();
          }
        });

      }

    });

}

/**
 * Locate content based on its alias
 */
function showAliasedContent(req,res,template,block,next) {

  var format = req.url.match(/\.json/g) ? "json" : "html";

  var alias = req.url
                  .replace(/^\//, "")
                  .replace(/\.html/, "")
                  .replace(/\.json/, "")
                  .replace(/(\?.*)$/, "")

  var Content = calipso.lib.mongoose.model('Content');

  Content.findOne({alias:alias},function (err, content) {

      if(err || !content) {
        // Create content if it doesn't exist
        if(req.session.user && req.session.user.isAdmin) {
          res.redirect("/content/new?alias=" + alias + "&type=Article") // TODO - make this configurable
        } else {
          res.statusCode = 404;
        }
        next();

      } else {
       
        calipso.modules.user.fn.userDisplay(req,content.author,function(err, userDetails) {    
          if(err) {
            next(err);
          } else {
            // Add the user display details to content
            content.set('displayAuthor',userDetails);
            showContent(req,res,template,block,next,err,content,format);
          }      
        });        

      }

  });

}

/**
 * Show content based on its ID
 */
function showContentByID(req,res,template,block,next) {

  var Content = calipso.lib.mongoose.model('Content');
  var id = req.moduleParams.id;
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';

  Content.findById(id, function(err, content) {
      
    // Error locating content
    if(err) {
      res.statusCode = 500;
      errorMessage = err.message;
      next();
      return;
    }
    
    // Content found
    if(content) {
      
      calipso.modules.user.fn.userDisplay(req,content.author,function(err, userDetails) {    
          if(err) {
            next(err);
          } else {
            // Add the user display details to content
            content.set('displayAuthor',userDetails);
            showContent(req,res,template,block,next,err,content,format);
          }
      
      });
      
    } else {      
      // Show a 404
      res.statusCode = 404;      
      next();
      
    }
    
  });

}

/***
 * Show content - called by ID or Alias functions preceeding
 */
function showContent(req,res,template,block,next,err,content,format) {

  var item;

  if(err || !content) {

    item = {title:"Not Found!",content:"Sorry, I couldn't find that content!"};

  } else {
    
    res.menu.adminToolbar.addMenuItem({name:'Create',weight:3,path:'new',url:'/content/new',description:'Create content ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'List',weight:1,path:'list',url:'/content/',description:'List all ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'View',weight:2,path:'show',url:'/content/show/' + content.id,description:'Show current ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'Edit',weight:4,path:'edit',url:'/content/edit/' + content.id,description:'Edit content ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'Delete',weight:5,path:'delete',url:'/content/delete/' + content.id,description:'Delete content ...',security:[]});

    
    item = content.toObject();

  }

  // Set the page layout to the content type
  if(format === "html") {
    if(content) {
      res.layout = content.layout ? content.layout : "default";
    }
    calipso.theme.renderItem(req,res,template,block,{item:item},next);
  }

  if(format === "json") {
    res.format = format;
    res.send(content.toObject());
    next();
  }


}

/**
 * Show a list of content - admin
 */
function listContent(req,res,template,block,next) {

      // Re-retrieve our object
      var Content = calipso.lib.mongoose.model('Content');

      res.menu.adminToolbar.addMenuItem({name:'Create',weight:1,path:'new',url:'/content/new',description:'Create content ...',security:[]});
      
      var tag = req.moduleParams.tag ? req.moduleParams.tag : '';
      var format = req.moduleParams.format ? req.moduleParams.format : 'html';
      var sortBy = req.moduleParams.sortBy;

      // TODO : Make this more flexible ...
      var t1 = req.moduleParams.t1 ? req.moduleParams.t1 : '';
      var t2 = req.moduleParams.t2 ? req.moduleParams.t2 : '';
      var t3 = req.moduleParams.t3 ? req.moduleParams.t3 : '';
      var t4 = req.moduleParams.t4 ? req.moduleParams.t4 : '';

      var query = new Query();

      if(req.session.user && req.session.user.isAdmin) {
        // Show all
      } else {
        // Published only if not admin
        query.where('status','published');
      }

      if(tag) {
        res.layout = tag + "Landing" // Enable landing page layout to be created for a tag;
        query.where('tags',tag);
      }

      // Taxonomy tags
      var taxonomy = "";
      if(t1) {
        res.layout = t1 + "Landing" // Enable landing page layout to be created for a t1 level;
        taxonomy += t1;
        if(t2) {          
          taxonomy += "/" + t2;
          if(t3) {
            taxonomy += "/" + t3;
            if(t4) {
              taxonomy += "/" + t4;
            }
          }
        }
      }

      if(taxonomy) {
        query.where('taxonomy',new RegExp(taxonomy));
      }

    // Get the content list
    getContentList(query,{req:req,res:res,template:template,block:block,format:format,sortBy:sortBy},next);

};


/**
 * Helper function for link to user
 */ 
function contentLink(req,content) {      
  return calipso.link.render({id:content._id,title:req.t('View {content}',{content:content.title}),label:content.title,url:'/content/show/' + content._id});  
}

/**
 * Take a query and parameters, return or render content lists
 * This has been refactored so it can be called as a helper (e.g. views)
 * From a theme
 */
function getContentList(query,out,next) {

      var Content = calipso.lib.mongoose.model('Content');
      var pager = out.hasOwnProperty('pager') ? out.pager : true;

      // If pager is enabled, ignore any override in from
      var from;
      if(pager) {
        from = out.req.moduleParams.from ? parseInt(out.req.moduleParams.from) - 1 : 0;
      } else {
        var from = out.from ? out.from - 1 : 0;
      }

      var limit = out.limit ? out.limit : (out.req.moduleParams.limit ? parseInt(out.req.moduleParams.limit) : 20);

      // Initialise the block based on our content
      Content.count(query, function (err, count) {

        var total = count;

        var pagerHtml = "";
        if(pager) {
          pagerHtml = calipso.lib.pager.render(from,limit,total,out.req.url);
        }

        var qry = Content.find(query).skip(from).limit(limit);  
          
        // Add sort
        qry = calipso.table.sortQuery(qry,out.sortBy);
        
        qry.find(function (err, contents) {

                if(out && out.res) {

                  // Render the item into the response
                  if(out.format === 'html') {
                                                
                    var table = {id:'content-list',sort:true,cls:'table-admin',
                        columns:[{name:'_id',sort:'title',label:'Title',fn:contentLink},                              
                                {name:'contentType',label:'Type'},
                                {name:'status',label:'Status'},
                                {name:'published',label:'Published'}
                        ],
                        data:contents,
                        view:{
                          pager:true,
                          from:from,
                          limit:limit,
                          total:total,
                          url:out.req.url,                        
                          sort:calipso.table.parseSort(out.sortBy)
                        }
                    };
                    
                    var tableHtml = calipso.table.render(table,out.req);
                    
                    //calipso.theme.renderItem(out.req,out.res,out.template,out.block,{contents:contents, pager: pagerHtml},next);                    
                    calipso.theme.renderItem(out.req,out.res,tableHtml,out.block,null,next);
                    
                  }

                  if(out.format === 'json') {
                    out.res.format = out.format;
                    out.res.end(contents.map(function(u) {
                      return u.toObject();
                    }));
                    //next();
                  }
                  
                  // This really needs to be pluggable
                  // WIP!
                  if(out.format === 'rss') {
                    // Override the template
                    out.res.layout = "rss";                    
                    var newTemplate = calipso.modules["content"].templates["rss"];
                    if(newTemplate) {                                          
                      calipso.theme.renderItem(out.req,out.res,newTemplate,out.block,{contents:contents},next);
                    } else {
                      res.statusCode = 404;
                      next();                     
                    }
                  }

               } else {
                  // We are being called as a helper, hence return raw data & the pager.
                  var output = {
                      contents:contents,
                      pager:pagerHtml
                  }
                  next(null,output);
               }

        });

    });
};

/**
 * Delete content
 */
function deleteContent(req,res,template,block,next) {

  var Content = calipso.lib.mongoose.model('Content');
  var id = req.moduleParams.id;
  
  Content.findById(id, function(err, c) {
      
    // Raise CONTENT_CREATE event
    calipso.e.pre_emit('CONTENT_DELETE',c);
    
    Content.remove({_id:id}, function(err) {
      if(err) {
        req.flash('info',req.t('Unable to delete the content because {msg}',{msg:err.message}));
        res.redirect("/");
      } else {
        calipso.e.post_emit('CONTENT_DELETE',c); 
        req.flash('info',req.t('The content has now been deleted.'));
        res.redirect("/");
      }
      next();
    });

  });
}

/**
 * Job to publish content that is scheduled
 */
function scheduledPublish(args, next) {
  calipso.info("Scheduled publish: " + args);
  next();
}