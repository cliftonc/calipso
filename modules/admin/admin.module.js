var ncms = require("../../lib/ncms");      

exports = module.exports;
exports.load = load;

/**
 * Base content module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function load(req,res,router,app,next) {      
      
      /**
       * Menu items
       */      
      res.menu.primary.push({name:'Admin',url:'/admin',regexp:/admin/});
        
      /**
       * Routing and Route Handler
       */          
      // var router = ncms.moduleRouter.Router();
      
      ncms.lib.step(
          function addRoutes() {
            if(!router.configured) {              
              router.addRoute('GET /admin',showAdmin,{templatePath:__dirname + '/templates/admin.html',admin:true},this.parallel());
              router.addRoute('POST /admin/save',saveAdmin,null,this.parallel());
              
              // TODO: Disable these routes once you have installed 
              router.addRoute('GET /admin/install',install,{templatePath:__dirname + '/templates/install.html'},this.parallel());  
              router.addRoute('POST /admin/install',installSave,null,this.parallel());
              
            }            
            initialiseModule(app,req,res,this.parallel());
          },
          function done() {              
            router.configured = true;  
            router.route(req,res,next);
          }
      );      
                                                                
}

function initialiseModule(app,req,res,next) {  
    
    // Admin schemas are defined in Configuration.js
    res.themes = [];
        
    ncms.lib.fs.readdir(app.path + '/themes',function(err,folders) {
       folders.forEach(function(name){
         res.themes.push({name:name,selected: app.set('config').theme === name ? true : false}); 
       });
      next();      
    });
    

}

function install(req,res,next,template) {      
    
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template));
  }   
  next();
                      
};


function installSave(req,res,next,template) {      
    
  // Fix to an admin
  req.body.user.isAdmin = 'yes';
  
  var user = require("../user/user.module");
  user.registerUser(req,res,function() { 
      req.flash('info','New administrative user created, you can now login as this user and begin using NCMS!');
      next();
    },template);  
                      
};

function showAdmin(req,res,next,template) {      
  
  // Re-retrieve our object
  var AppConfig = ncms.lib.mongoose.model('AppConfig');    
  
  AppConfig.findOne({}, function(err,config) {    
                
          var item = {id:config._id,type:'config',meta:config.toObject()};                
          res.blocks.body.push(item);               
          if(template) {
            res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item,modules:ncms.modules,themes:res.themes}}));
          }                
          next();
          
  });
                      
};

function saveAdmin(req,res,next,template) {
                    
  
  // Re-retrieve our object
  var AppConfig = ncms.lib.mongoose.model('AppConfig');    
  
  AppConfig.findOne({}, function(err,config) {    
    
    if(config.theme != req.body.config.theme) {
      req.flash('info','You need to restart NCMS to see the theme changes (live restart todo!).')
    }
    
    config.theme = req.body.config.theme;
    config.cache = req.body.config.cache;
    config.modules = moduleFormtToArray(res,req.body.config.modules);
    
    if (config) {      
                
        config.save(function(err) {
          if(err) {
            req.flash('error','Could not update config: ' + err.message);
            if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
              res.redirect('/admin');
            }
          } else {
            res.reloadConfig = true;
            res.reloadConfigOptions = config;
            res.redirect('/admin');
          }
          next();         
        });
        
    } else {
      req.flash('error','Could not locate admin!');
      res.redirect('/admin');
      next();
    }
  });
  
}

function moduleFormtToArray(res,modules) {
  
  var arrayModules = [];
  
  for(var module in ncms.modules) {                     
      var enabled = modules[module] === 'on' ? true : false;
      arrayModules.push({name:module,enabled:enabled});           
  }
  
  return arrayModules;
  
}