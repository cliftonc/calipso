var ncms = require("../../lib/ncms");      

exports = module.exports = {init: init, route: route};

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
      res.menu.primary.push({name:'Admin',url:'/admin',regexp:/admin/});
        
      /**
       * Routing and Route Handler
       */                  
      module.router.route(req,res,next);
                                                                
}

function init(ncms,module,app,next) {      
  
  ncms.lib.step(
      function defineRoutes() {
        
        module.router.addRoute('GET /admin',showAdmin,{templatePath:__dirname + '/templates/admin.html',admin:true},this.parallel());
        module.router.addRoute('GET /admin/reload',reloadAdmin,{templatePath:__dirname + '/templates/reload.html',admin:true},this.parallel());
        module.router.addRoute('POST /admin/save',saveAdmin,{admin:true},this.parallel());        
        
        // TODO: Disable these routes once you have installed 
        module.router.addRoute('GET /admin/install',install,{templatePath:__dirname + '/templates/install.html'},this.parallel());  
        module.router.addRoute('POST /admin/install',installSave,null,this.parallel());
      },
      function done() {
        
        ncms.data.themes = [];        
        ncms.lib.fs.readdir(app.path + '/themes',function(err,folders) {
           folders.forEach(function(name){
             ncms.data.themes.push({name:name,selected: app.set('config').theme === name ? true : false}); 
           });
           next();
        });
        
      }        
  );
    
    // Admin schemas are defined in Configuration.js
    

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
            res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item,modules:ncms.modules,themes:ncms.data.themes}}));
          }                
          next();
          
  });
                      
};

function reloadAdmin(req,res,next,template) {  
  
  res.reloadConfig = true;    
    
  var item = {id:'0',type:'config',meta:{reload:true}};      
  res.blocks.body.push(item);
  
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
  }                
  next();

  
}

function saveAdmin(req,res,next,template) {
                      
  // Re-retrieve our object
  var AppConfig = ncms.lib.mongoose.model('AppConfig');    
  
  AppConfig.findOne({}, function(err,c) {    
      
    if (!err && c) {
      
        if(c.theme != req.body.config.theme) {
          req.flash('info','You need to restart NCMS to see the theme changes (live restart todo!).')
        }
        
        c.theme = req.body.config.theme;
        c.cache = req.body.config.cache;
        c.modules = moduleFormatToArray(res,req.body.config.modules);
      
        c.save(function(err) {                              
          if(err) {
            req.flash('error','Could not update config: ' + err.message);
            if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
              res.redirect('/admin');
            }
          } else {
            ncms.config = c; // TODO : This wont work on multiple edits
            res.redirect('/admin/reload');
          }
          next();         
        });
        
    } else {
      
      req.flash('error','Could not locate configuration!');
      res.redirect('/admin');
      next();
      
    }
    
  });
  
}

function moduleFormatToArray(res,modules) {
  
  var arrayModules = [];
  
  for(var module in ncms.modules) {                     
      var enabled = modules[module] === 'on' ? true : false;
      arrayModules.push({name:module,enabled:enabled});           
  }
  
  return arrayModules;
  
}