var ncms = require("../../lib/ncms"), cron = require('cron');      

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
      res.menu.primary.push({name:'Scheduler',url:'/admin/scheduler',regexp:/admin\/scheduler/});
      // res.menu.secondary.push({name:'Blah',parentUrl:'/template',url:'/template/blah'});         
  
      /**
       * Routes
       */      
      
      // var router = ncms.moduleRouter.Router();
      
      module.router.route(req,res,next);
      
};

function init(ncms,module,app,next) {      

    //
  
  ncms.lib.step(
      function defineRoutes() {
        module.router.addRoute('GET /admin/scheduler',schedulerAdmin,{templatePath:__dirname + '/templates/admin.html'},this.parallel());
      },
      function done() {
        
        // Any pre-route config          
        module.cron = new cron.CronJob('* * * * * *', function(){
            ncms.lib.sys.puts('You will see this message every second');
        });
        
        next();          
      }        
  );
  
};

function schedulerAdmin(req,res,next,template) {      
  
    var myVariable = "Hello World";
    
    // Render json to blocks
    var item = {id:"NA",type:'content',meta:{variable:myVariable}};                
    res.blocks.body.push(item);
    
    // Render template
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{variable:myVariable}}));
    }
    next();      
};