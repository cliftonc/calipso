/**
 * User management module
 */
var calipso = require("lib/calipso");

exports = module.exports = {
  init: init,
  route: route,
  install:install,
  about: {
    description: 'User management module.',
    author: 'cliftonc',
    version: '0.2.1',
    home:'http://github.com/cliftonc/calipso'
  }
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Menu
  res.menu.admin.primary.push({name:req.t('User'), url:'/user', regexp:/user/});

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

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
        language:{type: String, default:'en'},
        roles:[String],
        isAdmin:{type: Boolean, required: true, default: true} // Convert to getter
      });
      calipso.lib.mongoose.model('User', User);
      next();
    }
  )

}

/**
 * Loginm form
 */
function loginForm(req, res, template, block, next) {

  var userForm = {
    id:'login-form',cls:'login',title:'Log In',type:'form',method:'POST',action:'/user/login',
    fields:[
      {label:'Username', name:'user[username]', type:'text'},
      {label:'Password', name:'user[password]', type:'password'}
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Login'},
      {name:'register', type:'button', link:'/user/register', value:'Register'}
    ]
  };

  calipso.form.render(userForm, null, req, function(form) {
    calipso.theme.renderItem(req, res, template, block, {form:form},next);
    // next();
  });

};


/**
 * Register form
 */
function registerUserForm(req, res, template, block, next) {

  var userForm = {
    id:'FORM',title:req.t('Register'),type:'form',method:'POST',action:'/user/register',
    fields: [
      {label:'Username', name:'user[username]', type:'text'},
      {label:'Password', name:'user[password]', type:'password'},
      {label:'Email', name:'user[email]', type:'text'},
      {label:'Language', name:'user[language]', type:'select', options:req.languages}, // TODO : Select based on available
      {label:'About You', name:'user[about]', type:'textarea'}
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Register'}
    ]
  };

  // Allow admins to register other admins
  if(req.session.user && req.session.user.isAdmin) {
    userForm.fields.push(
      {label:'Admin', name:'user[isAdmin]', type:'select', options:['Yes','No']}
    );
  }

  calipso.form.render(userForm, null, req, function(form) {
    calipso.theme.renderItem(req, res, form, block, next);
  });

};

/**
 * Update user
 */
function updateUserProfile(req, res, template, block, next) {

  calipso.form.process(req,function(form) {
    if(form) {

      var username = req.moduleParams.username;
      var User = calipso.lib.mongoose.model('User');

      User.findOne({username:username}, function(err, u) {

        u.email = form.user.email;
        u.language = form.user.language;
        u.about = form.user.about;
        u.password = calipso.lib.crypto.encrypt(form.user.password,calipso.config.cryptoKey);

        if(err) {
          req.flash('error',req.t('Could not find user because {msg}.',{msg:err.message}));
          if(res.statusCode != 302) {
            res.redirect('/');
          }
          next();
          return;
        }

        // Override admin
        u.isAdmin = form.user.isAdmin === 'Yes';
        u.save(function(err) {
          if(err) {
            req.flash('error',req.t('Could not save user because {msg}.',{msg:err.message}));
            if(res.statusCode != 302) {
              res.redirect('/');
            }
          } else {

            // Update session details
            req.session.user = {username:u.username, isAdmin:u.isAdmin, id:u._id, language:u.language};
            req.session.save(function(err) {
              if(err) {
                calipso.error("Error saving session: " + err);
              }
            });
            res.redirect('/user/profile/' + u.username);

          }
          // If not already redirecting, then redirect
          next();
        });

      });
    }
  });

};


/**
 * Update user form
 */
function updateUserForm(req, res, template, block, next) {

  var User = calipso.lib.mongoose.model('User');
  var username = req.moduleParams.username;

  var userForm = {
    id:'FORM',title:'Update Profile',type:'form',method:'POST',action:'/user/profile/' + username,
    fields:[
      {label:'Username', name:'user[username]', type:'text', readonly:true},
      {label:'Password', name:'user[password]', type:'password'},
      {label:'Email', name:'user[email]', type:'text'},
      {label:'Language', name:'user[language]', type:'select', options:req.languages}, // TODO : Select based on available
      {label:'About You', name:'user[about]', type:'textarea'}
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Save Profile'}
    ]
  };

  // Quickly check that the user is an admin or it is their account
  if(req.session.user && (req.session.user.isAdmin || req.session.user.username === username)) {
    // We're ok
  } else {
    res.statusCode = 404;
    next();
    return
  }

  User.findOne({username:username}, function(err, u) {

    // Allow admins to register other admins
    if(req.session.user && req.session.user.isAdmin) {
      userForm.fields.push(
        {label:'Admin', name:'user[isAdmin]', type:'select', options:['Yes','No']}
      );
    }

    var values = {user:u};
    values.user.password = calipso.lib.crypto.decrypt(values.user.password,calipso.config.cryptoKey);
    values.user.isAdmin = values.user.isAdmin ? "Yes" : "No";

    calipso.form.render(userForm,values,req,function(form) {
      calipso.theme.renderItem(req, res, form, block, {}, next);
    });

  });

};

/**
 * Login
 */
function loginUser(req, res, template, block, next) {

  calipso.form.process(req, function(form) {
    if(form) {

      var User = calipso.lib.mongoose.model('User');
      var username = form.user.username;
      var password = calipso.lib.crypto.encrypt(form.user.password,calipso.config.cryptoKey);
      var found = false;

      User.findOne({username:username, password:password},function (err, user) {
        if(user) {
          found = true;
          req.session.user = {username:user.username, isAdmin:user.isAdmin, id:user._id, language:user.language};
          req.session.save(function(err) {
            if(err) {
              calipso.error("Error saving session: " + err);
            }
          });
        }
        if(!found) {
          req.flash('error',req.t('You may have entered an incorrect username or password, please try again.'));
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

/**
 * Logout
 */
function logoutUser(req, res, template, block, next) {

  req.session.user = null;
  req.session.save(function(err) {
    // Check for error
  });
  if(res.statusCode != 302) {
    res.redirect('back');
  }
  next();

}

/**
 * Register
 */
function registerUser(req, res, template, block, next) {

  calipso.form.process(req, function(form) {

    if(form) {

      var User = calipso.lib.mongoose.model('User');
      var u = new User(form.user);
      u.password = calipso.lib.crypto.encrypt(u.password,calipso.config.cryptoKey);

      // Over ride admin
      if(req.session.user && req.session.user.isAdmin) {
        u.isAdmin = form.user.isAdmin === 'Yes' ? true : false
      } else {
        u.isAdmin = false;
      }

      var saved;

      u.save(function(err) {

        if(err) {
          req.flash('error',req.t('Could not save user because {msg}.',{msg:err.message}));
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

/**
 * My profile (shortcut to profile)
 */
function myProfile(req, res, template, block, next) {
  if(req.session.user) {
    req.moduleParams.username = req.session.user.username;
    userProfile(req, res, template, block, next);
  } else {
    req.flash('error',req.t('You need to login to view your created profile.'));
    res.redirect('/');
  }
}

/**
 * View user profile
 */
function userProfile(req, res, template, block, next) {

  var User = calipso.lib.mongoose.model('User');
  var username = req.moduleParams.username;

  User.findOne({username:username}, function(err, u) {

    var item;

    if(err || u === null) {
      item = {id:'ERROR', type:'content', meta: {title:"Not Found!", content:"Sorry, I couldn't find that user!"}};
    } else {
      item = {id:u._id, type:'user', meta:u.toObject()};
    }

    calipso.theme.renderItem(req, res, template, block, {item:item}, next);

    //next();

  });

}

/**
 * Installation process - asynch
 */
function install(next) {

  // Create the default content types
  var Role = calipso.lib.mongoose.model('Role');
  var User = calipso.lib.mongoose.model('User');

  calipso.lib.step(

    function createDefaults() {

      // Create default roles
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

      // Create administrative user
      var admin = new User({
        username:'admin',
        password:calipso.lib.crypto.encrypt('password',calipso.config.cryptoKey),
        email:'admin@example.com',
        roles:['Administrator']
      });
      admin.save(this.parallel());

    },
    function allDone(err) {
      if(err) {
        calipso.log(err);
        next(err)
      } else {
        calipso.log("User module installed ... ");
        next();
      }
    }
  )

}
