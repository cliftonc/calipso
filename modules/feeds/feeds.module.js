var ncms = require("../../lib/ncms"), rss = require('./lib/node-rss');;      

exports = module.exports = {init: init, route: route, jobs: {getFeed:getFeed}};

/**
 * Base feeds module
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
      // res.menu.primary.push({name:'Template',url:'/template',regexp:/template/});
      // res.menu.secondary.push({name:'Blah',parentUrl:'/template',url:'/template/blah'});         
  
      /**
       * Routes
       */      
      
      // var router = ncms.moduleRouter.Router();
      // module.router.route(req,res,next);
  
      next();
      
};

function init(module,app,next) {      
  
  next();  
    
};

function getFeed(args) {
  
  var url = args;
  if(!url) {
     return;
  }
  
  var Content = ncms.lib.mongoose.model('Content');                 
  
  var response = rss.parseURL(url, function(articles) {  
      for(i=0; i<articles.length; i++) {
          
        var c = new Content({
            title:articles[i].title,
            teaser:articles[i].description,
            content:articles[i].content ? articles[i].content : "No Content" 
        });
        
        c.alias = ncms.modules['content'].fn.titleAlias(c.title);      
        c.tags = [];      
        c.author = "feeds"; 
        
        // Asynch save
        c.save(function(err) {
          if(err) {
            console.log(err);
          }
        });
        
      }
  });
  
};