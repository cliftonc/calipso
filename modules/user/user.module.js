var calipso = require("../../lib/calipso");      

exports = module.exports = {init: init, route: route, install:install, registerUser: registerUser};

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
      res.menu.admin.primary.push({name:'User',url:'/user',regexp:/user/});
      
      /**
       * Routes
       */            
      // var router = calipso.moduleRouter.Router();
      module.router.route(req,res,next);
      
}


function init(module,app,next) {      
  
  calipso.lib.step(
      function defineRoutes() {
        module.router.addRoute(/.*/,loginForm,{end:false,template:'login',block:'user.login'},this.parallel());              
        module.router.addRoute('POST /user/login',loginUser,null,this.parallel());
        module.router.addRoute('GET /user/logout',logoutUser,null,this.parallel());
        module.router.addRoute('GET /user/register',registerUserForm,{block:'content'},this.parallel());
        module.router.addRoute('POST /user/register',registerUser,null,this.parallel());
        module.router.addRoute('GET /user',myProfile,{template:'profile',block:'content'},this.parallel());
        module.router.addRoute('GET /user/profile/:username',userProfile,{template:'profile',block:'content'},this.parallel());
        module.router.addRoute('GET /user/profile/:username/edit',updateUserForm,{block:'content'},this.parallel());
        module.router.addRoute('POST /user/profile/:username',updateUserProfile,{block:'content'},this.parallel());
      },
      function done() {
               
        var Role = new calipso.lib.mongoose.Schema({
          name:{type: String, required: true, unique:true},
          isAdmin:{type: Boolean, required: true, default: false}
        });
        calipso.lib.mongoose.model('Role', Role);
        
        var User = new calipso.lib.mongoose.Schema({
          // Single default property
          username:{type: String, required: true, unique:true},
          password:{type: String, required: true},
          email:{type: String, required: true, unique:true},
          about:{type: String},
          role:[Role],
          isAdmin:{type: Boolean, required: true, default: true} // Convert to getter
        });
        calipso.lib.mongoose.model('User', User);                       
        next();
      }           
  )
  
 }

function loginForm(req,res,template,block,next) {      
             
    var form = {id:'login-form',cls:'login',title:'Login',type:'form',method:'POST',action:'/user/login',fields:[                                                                                                         
                   {label:'Username',name:'user[username]',type:'text',value:''},
                   {label:'Password',name:'user[password]',type:'password',value:''}                   
                ],
                buttons:[
                         {name:'submit',type:'submit',value:'Login'},
                         {name:'register',type:'button',link:'/user/register',value:'Register'}
                ]};
    
    calipso.form.render(form,null,function(form) {      
      calipso.theme.renderItem(req,res,template,block,{form:form});          
      next();
    });    
      
};

function registerUserForm(req,res,template,block,next) {      
         
  var userForm = {id:'FORM',title:'Register',type:'form',method:'POST',action:'/user/register',fields:[                                                                                                         
                 {label:'Username',name:'user[username]',type:'text',value:''},
                 {label:'Password',name:'user[password]',type:'password',value:''},
                 {label:'Email',name:'user[email]',type:'text',value:''},
                 {label:'About You',name:'user[about]',type:'textarea',value:''}
              ],
              buttons:[
                       {name:'submit',type:'submit',value:'Register'}
              ]};
  
  // Allow admins to register other admins
  if(req.session.user && req.session.user.isAdmin) {
    userForm.fields.push({label:'Admin',name:'user[isAdmin]',type:'select',value:'',options:['Yes','No']});
  }  
            
  calipso.form.render(userForm,null,function(form) {      
    calipso.theme.renderItem(req,res,form,block);          
    next();
  });
    
};

function updateUserProfile(req,res,template,block,next) {      
  
    calipso.form.process(req,function(form) {
    
    if(form) {             
      
            var username = req.moduleParams.username;                 
            var User = calipso.lib.mongoose.model('User');                              
            
            User.findOne({username:username}, function(err, u) {
            
              u.email = form.user.email;
              u.about = form.user.about;
              u.password = form.user.password;
              
              if(err) {
                req.flash('error','Could not find user: ' + err.message);
                if(res.statusCode != 302) {
                  res.redirect('/');  
                }
                next();
                return;
              }
              
              // Over ride admin
              u.isAdmin = form.user.isAdmin === 'Yes' ? true : false                                 
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
              
            });
        }
      });       
    
};

function updateUserForm(req,res,template,block,next) {      
    
  var User = calipso.lib.mongoose.model('User');
  var username = req.moduleParams.username;          
  
  var userForm = {id:'FORM',title:'Update Profile',type:'form',method:'POST',action:'/user/profile/' + username,fields:[                                                                                                         
                 {label:'Username',name:'user[username]',type:'text',readonly:true,value:''},
                 {label:'Password',name:'user[password]',type:'password',value:''},
                 {label:'Email',name:'user[email]',type:'text',value:''},
                 {label:'About You',name:'user[about]',type:'textarea',value:''}
              ],
              buttons:[
                       {name:'submit',type:'submit',value:'Save Profile'}
              ]};
  
  // Quickly check that the user is an admin or it is their account
  if((req.session.user && req.session.user.isAdmin) || (req.session.user && req.session.user.username === username)) {
    // We're ok
  } else {    
    res.statusCode = 404;
    next();
    return
  } 
  
  User.findOne({username:username}, function(err, u) {

    // Allow admins to register other admins
    if(req.session.user && req.session.user.isAdmin) {
      userForm.fields.push({label:'Admin',name:'user[isAdmin]',type:'select',value:'',options:['Yes','No']});
    }  
              
    var values = {user:u};
    values.user.isAdmin = values.user.isAdmin ? "Yes" : "No"
    
    calipso.form.render(userForm,values,function(form) {      
      calipso.theme.renderItem(req,res,form,block);          
      next();
    });
    
  });
  
};


function loginUser(req,res,template,block,next) {
  
 calipso.form.process(req,function(form) {
    
    if(form) {             
       
        var User = calipso.lib.mongoose.model('User');
        
        var username = form.user.username;
        var password = form.user.password;
        
        var found = false;
        
        User.findOne({username:username, password:password},function (err, user) {                
              if(user) {
                found = true;         
                req.session.user = {username: user.username, isAdmin: user.isAdmin, id: user._id};
                req.session.save(function(err) {
                  if(err) {
                    calipso.error("Error saving session: " + err);  
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
    });   
  
}

function logoutUser(req,res,template,block,next) {

   req.session.user = null;
   req.session.save(function(err) {
              // Check for error
   });
   if(res.statusCode != 302) {
      res.redirect('back');
    }    
    next();  
  
}

function registerUser(req,res,template,block,next) {  
 
 calipso.form.process(req,function(form) {
    
    if(form) {             
   
            var User = calipso.lib.mongoose.model('User');                  
            var u = new User(form.user);
            
            // Over ride admin
            u.isAdmin = form.user.isAdmin === 'Yes' ? true : false
            
            // Check to see if passed through 
            if(req.registerAdmin) u.isAdmin = true;        
            var saved;      
                 
            u.save(function(err) {    
              
              if(err) {
                req.flash('error','Could not save user: ' + err.message);                             
                if(res.statusCode != 302 && !res.noRedirect) {
                  res.redirect('/');  
                }                
              } else {
                if(!res.noRedirect) {
                  res.redirect('/user/profile/' + u.username);
                }
              }           
              
              // If not already redirecting, then redirect
              next(err);
            });       
  
        }
      });       
      
}


function myProfile(req,res,template,block,next) {
  
  if(req.session.user) {
    req.moduleParams.username = req.session.user.username;
    userProfile(req,res,template,block,next);
  } else {    
    req.flash('error','You need to login to view your created profile!');
    res.redirect('/');
  }  
}

function userProfile(req,res,template,block,next) {

  var User = calipso.lib.mongoose.model('User');
  var username = req.moduleParams.username;          
  
  User.findOne({username:username}, function(err, u) {
    var item;
    if(err || u === null) {
      item = {id:'ERROR',type:'content',meta: {title:"Not Found!",content:"Sorry, I couldn't find that user!"}};      
    } else {      
      item = {id:u._id,type:'user',meta:u.toObject()};                
    }           
    
    calipso.theme.renderItem(req,res,template,block,{item:item});
    
    next();   
    
  });

}

function listUsers(req,res,template,block,next) {      
  
  // Re-retrieve our object
  var User = calipso.lib.mongoose.model('User');      
    
  User.find({})
    .find(function (err, contents) {
          contents.forEach(function(u) {
            
            var item = {id:u._id,type:'user',meta:c.toObject()};                
            res.blocks.body.push(item);               
            if(template) {
              calipso.theme.renderItem(req,res,template,block,{item:item});
            }                
          });              
          next();
  });
            
};


/**
 * Installation process - asynch
 * @returns
 */
function install(next) {
  
  // Create the default content types
  var Role = calipso.lib.mongoose.model('Role');          
  var User = calipso.lib.mongoose.model('User');          
  
  calipso.lib.step(
      
      function createDefaults() {
                    
          /**
           * Default roles
           */
          var r = new Role({
            name:'Guest',
            isAdmin:false
          });               
          r.save(this.parallel());
          
          var r = new Role({
            name:'Contributor',
            isAdmin:false
          });               
          r.save(this.parallel());
      
          var r = new Role({
            name:'Administrator',
            isAdmin:true
          });               
          r.save(this.parallel());
      },
      function createUser() {
        /**
         * Default user
         */
        var admin = new User({
          username:'admin',
          password:'password',
          email:'admin@example.com'            
        });               
        admin.role.push(r);
        admin.save(this);          
      },
      function allDone(err) {
          if(err) {
            next(err)
          } else {
            calipso.log("User module installed ... ");
            next();  
          }             
      }
  )   
      
}
