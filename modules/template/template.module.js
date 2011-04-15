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
      res.menu.admin.primary.push({name:'Template',url:'/template',regexp:/template/});
      // res.menu.admin.secondary.push({name:'Blah',parentUrl:'/template',url:'/template/blah'});         
  
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
        module.router.addRoute(/.*/,allPages,{end:false, template:'template-all',block:'right'},this.parallel());
        module.router.addRoute('GET /template',templatePage,{template:'template',block:'content'},this.parallel());        
      },
      function done() {
        next();
      }        
  );
    
    
};

function templatePage(req,res,template,block,next) {      
  
    var myVariable = "Hello World";
    
    // Render json to blocks
    var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
    calipso.theme.renderItem(req,res,template,block,{item:item});                     

    next();      
};

function allPages(req,res,template,block,next) {      
  
  var myVariable = "I will be on every page!";
  
  // Render json to blocks
  var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
  
  calipso.theme.renderItem(req,res,template,block,{item:item});                     
  
  next();      
};