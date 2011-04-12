var  ncms = require("../../lib/ncms"), pager = "../../utils/pager.js";      

exports = module.exports = {init: init, route: route, titleAlias: titleAlias, jobs:{scheduledPublish:scheduledPublish}};

/**
 * Base content module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      
            
      /**
       * Menu items
       */
      res.menu.primary.push({name:'Content',url:'/content',regexp:/content/});
        
      /**
       * Routing and Route Handler
       */      
      module.router.route(req,res,next);
                                                                
}

function init(module,app,next) {    
  
  ncms.lib.step(
      function defineRoutes() {
        module.router.addRoute(/html$/,showAliasedContent,{templatePath:__dirname + '/templates/show.html'},this.parallel());
        module.router.addRoute('GET /',listContent,{templatePath:__dirname + '/templates/list.html'},this.parallel());
        module.router.addRoute('GET /:from-:to',listContent,{templatePath:__dirname + '/templates/list.html'},this.parallel());
        module.router.addRoute('GET /content',listContent,{templatePath:__dirname + '/templates/list.html'},this.parallel());            
        module.router.addRoute('POST /content',createContent,{admin:true},this.parallel());    
        module.router.addRoute('GET /content/new',createContentForm,{admin:true,templatePath:__dirname + '/templates/form.html'},this.parallel());  
        module.router.addRoute('GET /content/show/:id',showContentByID,{templatePath:__dirname + '/templates/show.html'},this.parallel());
        module.router.addRoute('GET /content/edit/:id',editContentForm,{admin:true,templatePath:__dirname + '/templates/form.html'},this.parallel());
        module.router.addRoute('GET /content/delete/:id',deleteContent,{admin:true},this.parallel());
        module.router.addRoute('POST /content/:id',updateContent,{admin:true},this.parallel());        
      },
      function done() {
        var Content = new ncms.lib.mongoose.Schema({
          // Single default property
          title:{type: String, required: true},
          teaser:{type: String, required: true},
          content:{type: String, required: true},
          status:{type: String, required: true, default:'draft'},
          alias:{type: String, required: true, unique: true},
          author:{type: String, required: true},
          tags:[String],
          created: { type: Date, default: Date.now },
          updated: { type: Date, default: Date.now },
        });

        ncms.lib.mongoose.model('Content', Content);    
        
        next();
      }        
  );        
}

/**
 * Module specific functions
 * 
 * @param req
 * @param res
 * @param next
 */
function createContent(req,res,next,template) {
                  
      var Content = ncms.lib.mongoose.model('Content');                  
      var c = new Content(req.body.content);
      c.alias = titleAlias(c.title);      
      c.tags = req.body.content.tags ? req.body.content.tags.split(",") : [];      
      c.author = req.session.user.username; 
      
      var saved;
           
      c.save(function(err) {    
        if(err) {
          req.flash('error','Could not save content: ' + err.message);
          if(res.statusCode != 302) {
            res.redirect('/content/new');  
          }                          
        } else {
          res.redirect('/content/show/' + c._id);
        }
        // If not already redirecting, then redirect
        next();
      });       
  
}

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

function createContentForm(req,res,next,template) {
  
  res.menu.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});         
  
  var item = {id:'FORM',title:'Form',type:'form',method:'POST',action:'/content',fields:[                                                                                                         
                 {label:'Title',name:'content[title]',type:'text',value:''},
                 {label:'Teaser',name:'content[teaser]',type:'text',value:''},
                 {label:'Content',name:'content[content]',type:'textarea',value:''},
                 {label:'Tags',name:'content[tags]',type:'text',value:''},
                 {label:'Status',name:'content[status]',type:'select',value:'',options:["draft","published"]}
              ]}
  
  res.blocks.body.push(item);
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
  }                      
  
  // res.blocks.html = [];
  // res.blocks.html.push(res.partial('pages/_form',{item:form}))
  
  next();
}

function editContentForm(req,res,next,template) {
  
  
  var Content = ncms.lib.mongoose.model('Content');
  var id = req.moduleParams.id;          
  var item;
  
  res.menu.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
  res.menu.secondary.push({name:'Edit Content',parentUrl:'/content/' + id,url:'/content/edit/' + id});
   
  Content.findById(id, function(err, c) {
    
    if(err || c === null) {
      item = {id:'ERROR',title:"Not Found!",type:'content',content:"Sorry, I couldn't find that content!"};      
    } else {      
      
      item = {id:c._id,title:c.title,type:'form',method:'POST',action:'/content/' + id,fields:[                                                                         
           {label:'Title',name:'content[title]',type:'text',value:c.title},
           {label:'Teaser',name:'content[teaser]',type:'text',value:c.teaser},
           {label:'Content',name:'content[content]',type:'textarea',value:c.content},
           {label:'Tags',name:'content[tags]',type:'text',value:c.tags.join(",")},
           {label:'Status',name:'content[status]',type:'select',value:c.status,options:["draft","published"]}
           ]};
        // res.blocks.body.push({id:c._id,title:c.title,type:'content',content:c.content});
        
    }           
    
    res.blocks.body.push(item);
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
    }                    
    next();   
    
  });
  
}

function updateContent(req,res,next,template) {
      
  var Content = ncms.lib.mongoose.model('Content');
  var id = req.moduleParams.id;          
  
  Content.findById(id, function(err, c) {    
    if (c) {      
        
        c.title = req.body.content.title;
        c.content = req.body.content.content;
        c.teaser = req.body.content.teaser;
        c.status = req.body.content.status;
        c.updated = new Date();    
        c.author = req.session.user.username;
        c.alias = titleAlias(c.title);
        c.tags = req.body.content.tags ? req.body.content.tags.replace(/[\s]+/g, "").split(",") : [];
        
        c.save(function(err) {
          if(err) {
            req.flash('error','Could not update content: ' + err.message);
            if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
              res.redirect('/content/edit/' + req.moduleParams.id);
            }
          } else {            
            res.redirect('/content/show/' + req.moduleParams.id);
          }
          next();         
        });
        
    } else {
      req.flash('error','Could not locate content!');
      res.redirect('/content');
      next();
    }
  });
  
}


function showAliasedContent(req,res,next,template) {  
  
  var Content = ncms.lib.mongoose.model('Content');

  var alias = req.url
                  .replace(/^\//, "")
                  .replace(/.html$/, "")     

  
  Content.findOne({alias:alias},function (err, content) {
            
      showContent(req,res,next,template,err,content);     
      next();
      
  });
  
}

function showContent(req,res,next,template,err,content) {
    
  var item;
  if(err || content === null) {
    item = {id:'ERROR',type:'content',meta:{title:"Not Found!",content:"Sorry, I couldn't find that content!"}};    
  } else {      
    res.menu.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
    res.menu.secondary.push({name:'Edit Content',parentUrl:'/content/' + content.id, url:'/content/edit/' + content.id});
    res.menu.secondary.push({name:'Delete Content',parentUrl:'/content/' + content.id, url:'/content/delete/' + content.id});
    
    item = {id:content._id,type:'content',meta:content.toObject()};                
  }           
  res.blocks.body.push(item);
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
  }                
  
  next();
  
}

function showContentByID(req,res,next,template) {

  var Content = ncms.lib.mongoose.model('Content');
  var id = req.moduleParams.id;          
  
  Content.findById(id, function(err, content) {   
    showContent(req,res,next,template,err,content);    
  });

}

function listContent(req,res,next,template) {      
  
      // Re-retrieve our object
      var Content = ncms.lib.mongoose.model('Content');      
      
      res.menu.secondary.push({name:'New Content',parentUrl:'/content',url:'/content/new'});      
            
      var from = req.moduleParams.from ? parseInt(req.moduleParams.from) - 1 : 0;
      var to = req.moduleParams.to ? parseInt(req.moduleParams.to) : 10;
            
      var query = {};
      
      if(req.session.user && req.session.user.isAdmin) {
        // Show all
      } else {
        // Published only if not admin
        query.status = 'published';
      }
      
      Content.count(query, function (err, count) {
        
        var total = count;  
        var pagerHtml = ncms.lib.pager.render(from,to,total,"");
              
        Content.find(query)
          .sort('created', -1)
          .skip(from).limit(to)          
          .find(function (err, contents) {
                
                contents.forEach(function(c) {                  
                  var item = {id:c._id,type:'content',meta:c.toObject()};                
                  res.blocks.body.push(item);               
                  if(template) {
                    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
                  }                
                });    
                
                res.renderedBlocks.body.push(pagerHtml);
                
                next();
        });
        
        
    });              
};



function deleteContent(req,res,next,template,err) {
  
  var Content = ncms.lib.mongoose.model('Content');        
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

// Example job
function scheduledPublish(args) {
  ncms.info("Scheduled publish: " + args);
}