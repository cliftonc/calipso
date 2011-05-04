var calipso = require("../../lib/calipso"), Query = require("mongoose").Query, utils = require('connect').utils, merge = utils.merge;   

exports = module.exports = {init: init, route: route, titleAlias: titleAlias, jobs:{scheduledPublish:scheduledPublish}};

/**
 * Base content module
 * This is the core module that provides the basic content management
 * functions. 
 */

/**
 * Standard module route function.
 */
function route(req,res,module,app,next) {      
            
      /**
       * Menu items
       */
      res.menu.admin.primary.push({name:'Content',url:'/content',regexp:/content/});
        
      /**
       * Routing and Route Handler
       */      
      module.router.route(req,res,next);
                                                                
}


/**
 * Module initiation
 */
function init(module,app,next) {    
   
  // There are dependencies, so we need to track if this is initialised
  module.initialised = false;
  
  calipso.lib.step(
      function defineRoutes() {
                
        // Default routes
        module.router.addRoute('GET /',homePage,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('GET /tag/:tag',listContent,{template:'list',block:'content'},this.parallel());
        module.router.addRoute('GET /section/:t1?/:t2?/:t3?/:t4?',listContent,{template:'list',block:'content'},this.parallel());        
                
        // Alias for SEO friendly pages, match to prefix excluding content pages
        module.router.addRoute(/^((?!content).*)html$/,showAliasedContent,{template:'show',block:'content'},this.parallel());
        module.router.addRoute(/^((?!content).*)json$/,showAliasedContent,{template:'show',block:'content'},this.parallel());
        
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
                  
                  var text = "Click to create: " +
                  "<a title='Click to create ...' href='/content/new?" +
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
                    text = "<span title='Double click to edit content block ...' class='content-block' id='" + content._id + "'>" +
                      content.content + "</span>"           
                  } else {
                    text = content.content;        
                  }
                         
                  next(null,text);
                  
                }
            });           
            
          }
          
        }        
                        
        // Default Content Schema
        var Content = new calipso.lib.mongoose.Schema({
          title:{type: String, required: true, default: ''},
          teaser:{type: String, required: true, default: ''},
          taxonomy:{type: String, default:'pages'},
          content:{type: String, required: true},
          status:{type: String, required: true, default:'draft'},
          alias:{type: String, required: true, unique: true},
          author:{type: String, required: true},
          tags:[String],
          published: { type: Date },
          scheduled: { type: Date },
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now },
          meta:{
            contentType:{type: String},            
            layout:{type: String},
            ispublic:{type: Boolean}            
          }
        });

        calipso.lib.mongoose.model('Content', Content);    
                              
        module.initialised = true;

        next();
        
      }        
  );        
}

/**
 * Module specific functions follow from this point
 */

/**
 * Local default for the content create / edit form
 */
var contentForm = {id:'content-form',title:'Create Content ...',type:'form',method:'POST',action:'/content',tabs:false,
          sections:[{
            id:'form-section-content',
            label:'Content',            
            fields:[                                                                                                         
                    {label:'Title',name:'content[title]',type:'text',instruct:'Title to appear for this piece of content.'},
                    {label:'Permanent URL / Alias',name:'content[alias]',type:'text',instruct:'Permanent url (no spaces or invalid html characters), if left blank is generated from title.'},
                    {label:'Type',name:'content[contentType]',type:'select',options:function() { return calipso.data.contentTypes },instruct:'Select the type, this impacts custom fields and page display.'},
                    {label:'Teaser',name:'content[teaser]',type:'textarea',instruct:'Enter some short text that describes the content, appears in lists.'},
                    {label:'Content',name:'content[content]',type:'textarea',instruct:'Enter the full content text.'}                                  
                   ]  
          },{
            id:'form-section-category',
            label:'Categorisation',            
            fields:[                                                                                                         
                    {label:'Taxonomy',name:'content[taxonomy]',type:'text',instruct:'Enter the menu heirarchy, e.g. "welcome/about"'},
                    {label:'Tags',name:'content[tags]',type:'text',instruct:'Enter comma delimited tags to help manage this content.'},
                   ]  
          },{
            id:'form-section-status',
            label:'Status',            
            fields:[                                                                                                         
                    {label:'Status',name:'content[status]',type:'select',options:["draft","scheduled","published"],instruct:'Select the status (published is visible to all public).'},
                    {label:'Published',name:'content[published]',type:'datetime',instruct:'TODO: Date to appear as published.'},
                    {label:'Scheduled',name:'content[scheduled]',type:'datetime',instruct:'TODO: Date to be published (if scheduled).'},
                   ]  
          }
          ],
          fields:[
            {label:'',name:'returnTo',type:'hidden'}
          ],
          buttons:[
               {name:'submit',type:'submit',value:'Save Content'}
          ]};

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
                req.flash('error','Could not locate content type: ' + form.content.contentType);
                res.redirect('/content');
                next();     
                
              } else {
                
                // Copy over content type data - in meta as this is 
                // not mastered here
                c.meta.contentType = contentType.contentType;
                c.meta.layout = contentType.layout;
                c.meta.ispublic = contentType.ispublic;            
                
                c.save(function(err) {    
                  if(err) {
                    calipso.debug(err);
                    req.flash('error','Could not save content: ' + err.message);
                    if(res.statusCode != 302) {
                        res.redirect('/content/new');                  
                    }                          
                  } else {
                    req.flash('info','Content saved successfully!');
                    if(returnTo) {
                      res.redirect(returnTo);
                    } else {
                      res.redirect('/content/show/' + c._id);  
                    }                
                  }
                  // If not already redirecting, then redirect
                  next();
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
 * Create Content Form
 * Create and render the 'New Content' page. 
 * This allows some defaults to be passed through (e.g. from missing blocks).
 */
function createContentForm(req,res,template,block,next) {
  
  res.menu.admin.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});             
  
  // Allow defaults to be passed in
  var alias = req.moduleParams.alias ? req.moduleParams.alias : "";
  var teaser = req.moduleParams.teaser ? req.moduleParams.teaser : "";
  var taxonomy = req.moduleParams.taxonomy ? req.moduleParams.taxonomy : "";
  var type = req.moduleParams.type ? req.moduleParams.type : "";
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";
  
  // Create the form
  var form = contentForm;
  form.action = "/content";
  form.title = "Create Content ...";
  
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
  
  // Test!
  calipso.form.render(form,values,function(form) {
    calipso.theme.renderItem(req,res,form,block);                         
    next();
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
  
  res.menu.admin.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
  res.menu.admin.secondary.push({name:'Edit Content',parentUrl:'/content/' + id,url:'/content/edit/' + id});
   
  Content.findById(id, function(err, c) {
    
    if(err || c === null) {
      
      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      next();
    
    } else {          
          
      // Create the form
      var form = contentForm;
      form.title = "Edit Content ...";
      form.action = "/content/" + id;
      
      // Default values
      var values = {content: c};
      
      // Fix for content type being held in meta field
      values.content.contentType = values.content.meta.contentType;
      values.returnTo = returnTo;
      
      // Test!
      calipso.form.render(form,values,function(form) {
        calipso.theme.renderItem(req,res,form,block);                     
        next();
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
              
              // TODO : Find a better mapper              
              c.title = form.content.title;
              c.teaser = form.content.teaser;
              c.content = form.content.content;
              c.status = form.content.status;
              c.taxonomy = form.content.taxonomy;
              c.updated = new Date();    
              c.author = req.session.user.username;
              c.alias = form.content.alias ? form.content.alias : titleAlias(c.title);
              c.tags = form.content.tags ? form.content.tags.replace(/[\s]+/g, "").split(",") : [];
                            
              c.published = form.content.published;
              c.scheduled = form.content.scheduled;
              
              // Get content type        
              ContentType.findOne({contentType:form.content.contentType}, function(err, contentType) {
                    
                  if(err || !contentType) {
                    req.flash('error','Could not locate content type: ' + form.content.contentType);
                    res.redirect('/content');
                    next();              
                  } else {

                    // Copy over content type data              
                    c.meta.contentType = contentType.contentType;
                    c.meta.layout = contentType.layout;
                    c.meta.ispublic = contentType.ispublic;
                            
                    c.save(function(err) {
                      if(err) {
                        req.flash('error','Could not update content: ' + err.message);
                        if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
                          res.redirect('/content/edit/' + req.moduleParams.id);
                        }
                      } else {
                        req.flash('info','Content saved successfully!');
                        if(returnTo) {
                          res.redirect(returnTo);
                        } else {                    
                          res.redirect('/content/show/' + req.moduleParams.id);
                        }
                      }
                      next();
                               
                    });
                      
                  }
                        
              });
              
          } else {
            req.flash('error','Could not locate content!');
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
  

  var format = req.url.match(/\.json$/) ? "json" : "html";
  
  var alias = req.url
                  .replace(/^\//, "")
                  .replace(/\.html$/, "")
                  .replace(/\.json$/, "")

  var Content = calipso.lib.mongoose.model('Content');
  
  Content.findOne({alias:alias},function (err, content) {
            
      if(err || !content) {
        
        if(req.session.user && req.session.user.isAdmin) {
          res.redirect("/content/new?alias=" + alias + 
                       "&type=Article")
        } else {
          res.statusCode = 404;
        }
        
      } else {
        
        showContent(req,res,template,block,next,err,content,format);
        
      }
      next();
      
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
    showContent(req,res,template,block,next,err,content,format);    
  });

}

/***
 * Show content - called by ID or Alias functions preceeding 
 */
function showContent(req,res,template,block,next,err,content,format) {
    
  var item;
 
  if(err || !content) {
    
    item = {id:'ERROR',type:'content',meta:{title:"Not Found!",content:"Sorry, I couldn't find that content!"}};
    
  } else {      
    
    res.menu.admin.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
    res.menu.admin.secondary.push({name:'Edit Content',parentUrl:'/content/' + content.id, url:'/content/edit/' + content.id});
    res.menu.admin.secondary.push({name:'Delete Content',parentUrl:'/content/' + content.id, url:'/content/delete/' + content.id});
    
    item = {id:content._id,type:'content',meta:content.toObject()};
    
  }           

  // Set the page layout to the content type
  if(format === "html") {
    if(content) {
      res.layout = content.meta.layout ? content.meta.layout : "default";  
    }      
    calipso.theme.renderItem(req,res,template,block,{item:item});      
  }
  
  if(format === "json") {
    res.format = format;
    res.send(content.toObject());
  }
  
  next();
  
}

/**
 * Show a list of content - admin
 */
function listContent(req,res,template,block,next) {      
  
      // Re-retrieve our object
      var Content = calipso.lib.mongoose.model('Content');      
      
      res.menu.admin.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
                  
      var from = req.moduleParams.from ? parseInt(req.moduleParams.from) - 1 : 0;
      var limit = req.moduleParams.limit ? parseInt(req.moduleParams.limit) : 30;
      var tag = req.moduleParams.tag ? req.moduleParams.tag : ''; 
      var format = req.moduleParams.format ? req.moduleParams.format : 'html'; 
      
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
        query.where('tags',tag);        
      }

      // Taxonomy tags
      var taxonomy = "";
      if(t1) {
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
      
      // Initialise the block based on our content      
      Content.count(query, function (err, count) {
        
        var total = count;  
        var pagerHtml = calipso.lib.pager.render(from,limit,total,"");
              
        Content.find(query)
          .sort('published', -1)
          .sort('updated', -1)
          .skip(from).limit(limit)          
          .find(function (err, contents) {            
            
                // Render the item into the response
                if(format === 'html') {
                  calipso.theme.renderItem(req,res,template,block,{contents:contents});  
                }                  
                                  
                if(format === 'json') {
                  res.format = format;
                  res.send(contents.map(function(u) {
                    return u.toObject();
                  }));
                }
                
               if(format === 'html') {
                 calipso.theme.renderItem(req,res,pagerHtml,block);
               }
                
               next();
        });
        
        
    });              
};


/**
 * Delete content
 */
function deleteContent(req,res,template,block,next) {
  
  var Content = calipso.lib.mongoose.model('Content');        
  var id = req.moduleParams.id;
  
  Content.remove({_id:id}, function(err) {
    if(err) {      
      req.flash("info","Unable to delete the content because " + err.message);
      res.redirect("/");
    } else {
      req.flash("info","The content has now been deleted.");      
      res.redirect("/");      
    }
    next();
  });
   
}

/**
 * Job to publish content that is scheduled
 */
function scheduledPublish(args) {
  calipso.info("Scheduled publish: " + args);
}