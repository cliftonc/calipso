var ncms = require("../../lib/ncms");      

exports = module.exports = {init: init, route: route};

/**
 * Base news module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      

      
  
      /**
       * Routes
       */   
     module.router.route(req,res,next);
      
};


function init(module,app,next) {       
    
  ncms.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,breakingNews,{end:false, templatePath:__dirname + '/templates/breaking.html'},this.parallel());
      },
      function done() {
        next();
      }        
  );
                  
};

function breakingNews(req,res,next,template) {      
  
    // Create a new news block
    res.blocks.news = [];
    var Content = ncms.lib.mongoose.model('Content');
    
    Content.find({tags:'breaking'})
      .sort('created', -1)
      .skip(0).limit(5)          
      .find(function (err, contents) {
            contents.forEach(function(c) {              
              var item = {id:c._id,type:'content',meta:c.toObject()};                
              res.blocks.news.push(item);                                            
            });
            if(template) {
              res.renderedBlocks.right.push(ncms.lib.ejs.render(template,{locals:{news:res.blocks.news}}));
            }
            next();
    });
      
};