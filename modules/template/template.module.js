var calipso = require("../../lib/calipso");      

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
       * Menu items
       */
      res.menu.primary.push({name:'Template',url:'/template',regexp:/template/});
      // res.menu.secondary.push({name:'Blah',parentUrl:'/template',url:'/template/blah'});         
  
      /**
       * Routes
       */      
      
      // var router = calipso.moduleRouter.Router();
      module.router.route(req,res,next);
      
};

function init(module,app,next) {      
  
    // Any pre-route config  
  calipso.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,allPages,{end:false, templatePath:__dirname + '/templates/template-all.html'},this.parallel());
        module.router.addRoute('GET /template',templatePage,{templatePath:__dirname + '/templates/template.html'},this.parallel());        
      },
      function done() {
        next();
      }        
  );
    
    
};

function templatePage(req,res,next,template) {      
  
    var myVariable = "Hello World";
    
    // Render json to blocks
    var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
    res.blocks.body.push(item);
    
    // Render template
    if(template) {
      res.renderedBlocks.body.push(calipso.lib.ejs.render(template,{locals:{variable:myVariable}}));
    }
    next();      
};

function allPages(req,res,next,template) {      
  
  var myVariable = "I will be on every page!";
  
  // Render json to blocks
  var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
  res.blocks.right.push(item);  
  
  if(template) {
    // render to the right
    res.renderedBlocks.right.push(calipso.lib.ejs.render(template,{locals:{variable:myVariable}}));
  }
  next();      
};