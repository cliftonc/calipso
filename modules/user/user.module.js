var ncms = require("../../lib/ncms");      

exports = module.exports = {init: init, route: route, registerUser: registerUser};

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
      res.menu.primary.push({name:'User',url:'/user',regexp:/user/});
      
      /**
       * Routes
       */            
      // var router = ncms.moduleRouter.Router();
      module.router.route(req,res,next);
      
}


function init(module,app,next) {      
  
  ncms.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,loginForm,{end:false,templatePath:__dirname + '/templates/login.html'},this.parallel());              
        module.router.addRoute('POST /user/login',loginUser,null,this.parallel());
        module.router.addRoute('GET /user/logout',logoutUser,null,this.parallel());
        module.router.addRoute('GET /user/register',registerUserForm,{templatePath:__dirname + '/templates/register.html'},this.parallel());
        module.router.addRoute('POST /user/register',registerUser,null,this.parallel());
        module.router.addRoute('GET /user',myProfile,{templatePath:__dirname + '/templates/profile.html'},this.parallel());
        module.router.addRoute('GET /user/profile/:username',userProfile,{templatePath:__dirname + '/templates/profile.html'},this.parallel());
      },
      function done() {
                
        var User = new ncms.lib.mongoose.Schema({
          // Single default property
          username:{type: String, required: true, unique:true},
          password:{type: String, required: true},
          isAdmin:{type: Boolean, required: true, default: true}
        });
        ncms.lib.mongoose.model('User', User);    
        next();
      }           
  )
  
 }

function loginForm(req,res,next,template) {      
             
    var item = {id:'FORM',title:'Login',type:'form',method:'POST',action:'/user/login',fields:[                                                                                                         
                   {label:'Username',name:'user[username]',type:'text',value:''},
                   {label:'Password',name:'user[password]',type:'password',value:''}                   
                ]}
    
    res.blocks.right.push(item);
    if(template) {
      res.renderedBlocks.right.push(ncms.lib.ejs.render(template,{locals:{item:item,request:req}}));
    }                    
    
    next();
      
};


function registerUserForm(req,res,next,template) {      
  
  var item = {id:'FORM',title:'Register',type:'form',method:'POST',action:'/user/register',fields:[                                                                                                         
                 {label:'Username',name:'user[username]',type:'text',value:''},
                 {label:'Password',name:'user[password]',type:'password',value:''},
                 {label:'Admin',name:'user[isAdmin]',type:'select',value:'',options:['yes','no']} // CLEARLY DISABLE THIS IN THE REAL WORLD!!!
              ]}
  
  res.blocks.body.push(item);
  if(template) {
    res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
  }                    
  
  next();
    
};

function loginUser(req,res,next,template) {

  var User = ncms.lib.mongoose.model('User');
  
  var username = req.body.user.username;
  var password = req.body.user.password;
  
  var found = false;
  
  User.findOne({username:username, password:password},function (err, user) {                
        if(user) {
          found = true;         
          req.session.user = {username: user.username, isAdmin: user.isAdmin, id: user._id};
          req.session.save(function(err) {
            if(err) {
              ncms.error("Error saving session: " + err);  
            }            
          });
        }
        if(!found) {
          req.flash('error','You may have entered an incorrect username or password!');         
        }
        
        if(res.statusCode != 302) {
          res.redirect('back');
        }
        next();
        return;
        
  });
  
  
}

function logoutUser(req,res,next,template) {

   req.session.user = null;
   req.session.save(function(err) {
              // Check for error
   });
   if(res.statusCode != 302) {
      res.redirect('back');
    }    
    next();  
  
}

function registerUser(req,res,next,template) {
  
  var User = ncms.lib.mongoose.model('User');                  
  var u = new User(req.body.user);
  
  // Over ride admin
  u.isAdmin = req.body.user.isAdmin === 'yes' ? true : false     
  
  var saved;      
       
  u.save(function(err) {    
    if(err) {
      req.flash('error','Could not save user: ' + err.message);
      if(res.statusCode != 302) {
        res.redirect('/');  
      }                          
    } else {
      res.redirect('/user/profile/' + u.username);
    }
    // If not already redirecting, then redirect
    next();
  });       

}


function myProfile(req,res,next,template) {
  
  if(req.session.user) {
    req.moduleParams.username = req.session.user.username;
    userProfile(req,res,next,template);
  } else {    
    req.flash('error','You need to login to view your created profile!');
    res.redirect('/');
  }  
}

function userProfile(req,res,next,template) {

  var User = ncms.lib.mongoose.model('User');
  var username = req.moduleParams.username;          
  
  User.findOne({username:username}, function(err, u) {
    var item;
    if(err || u === null) {
      item = {id:'ERROR',type:'content',meta: {title:"Not Found!",content:"Sorry, I couldn't find that user!"}};      
    } else {      
      item = {id:u._id,type:'user',meta:u.toObject()};                
    }           
    res.blocks.body.push(item);
    if(template) {
      res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
    }                
    next();   
    
  });

}

function listUsers(req,res,next,template) {      
  
  // Re-retrieve our object
  var User = ncms.lib.mongoose.model('User');      
    
  User.find({})
    .find(function (err, contents) {
          contents.forEach(function(u) {
            
            var item = {id:u._id,type:'user',meta:c.toObject()};                
            res.blocks.body.push(item);               
            if(template) {
              res.renderedBlocks.body.push(ncms.lib.ejs.render(template,{locals:{item:item}}));
            }                
          });              
          next();
  });
            
};