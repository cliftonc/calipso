var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    router = require('../../lib/router').Router(),
    Step = require('step'),
    ejs = require('ejs'),
    ObjectId = Schema.ObjectId;      

exports = module.exports;
exports.load = load;

/**
 * Base news module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function load(req,res,app,next) {      
      
      /** 
       * Menu items
       */
      res.menu.primary.push({name:'Template',url:'/template',regexp:/template/});
      // res.menu.secondary.push({name:'Blah',parentUrl:'/template',url:'/template/blah'});         
  
      /**
       * Routes
       */      
      Step(
          function addRoutes() {
            if(!router.configured) {              
              router.addRoute(/.*/,allPages,{end:false, templatePath:__dirname + '/templates/template-all.html'},this.parallel());
              router.addRoute('GET /template',templatePage,{templatePath:__dirname + '/templates/template.html'},this.parallel());            
            }
            initialiseModule(this.parallel());
          },
          function done() {              
            router.configured = true;  
            router.route(req,res,next);
          }
      );                                                                                   
      
};

function initialiseModule(next,counter) {
    // Any pre-route config
    next();          
};

function templatePage(req,res,next,template) {      
  
    var myVariable = "Hello World";
    
    // Render json to blocks
    var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
    res.blocks.body.push(item);
    
    // Render template
    if(template) {
      res.renderedBlocks.body.push(ejs.render(template,{locals:{variable:myVariable}}));
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
    res.renderedBlocks.right.push(ejs.render(template,{locals:{variable:myVariable}}));
  }
  next();      
};