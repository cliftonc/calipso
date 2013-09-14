/**
 * User management module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  roles = require('./user.roles'),
	sanitizer = require('sanitizer'),
  Query = require("mongoose").Query,
  everyauth = require("everyauth");

exports = module.exports = {
  init:init,
  route:route,
  install:install,
  userDisplay:userDisplay
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  var aPerm = calipso.permission.Helper.hasPermission("admin:user");

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Security', path:'admin/security', weight:5, url:'', description:'Users, Roles & Permissions ...', permit:aPerm, icon:"icon-locked-2" });
  res.menu.admin.addMenuItem(req, {name:'Users', path:'admin/security/users', weight:10, url:'/user/list', description:'Manage users ...', permit:aPerm, icon:"icon-users" });
  res.menu.admin.addMenuItem(req, {name:'Roles', path:'admin/security/roles', weight:15, url:'/admin/role/list', description:'Manage roles ...', permit:aPerm, icon:"icon-users" });
  res.menu.admin.addMenuItem(req, {name:'Logout', path:'admin/logout', weight:100, url:'/user/logout', description:'Logout', permit:aPerm, icon:"icon-upload-3" });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module
  calipso.e.addEvent('USER_CREATE');
  calipso.e.addEvent('USER_UPDATE');
  calipso.e.addEvent('USER_DELETE');
  calipso.e.addEvent('USER_LOCK');
  calipso.e.addEvent('USER_UNLOCK');
  calipso.e.addEvent('USER_LOGIN');
  calipso.e.addEvent('USER_LOGOUT');

  // Define permissions
  calipso.permission.Helper.addPermission("admin:user", "Users", true);
  calipso.permission.Helper.addPermission("admin:user:register", "Register other users.");

  calipso.lib.step(

    function defineRoutes() {
      module.router.addRoute(/.*/, setCookie, { end:false }, this.parallel());
      module.router.addRoute(/.*/, loginForm, { end:false, template:'login', block:'user.login' }, this.parallel());
      module.router.addRoute('GET /user/login', loginPage, { end:false, template:'loginPage', block:'content' }, this.parallel());
      module.router.addRoute('POST /user/login', loginUser, null, this.parallel());
      module.router.addRoute('GET /user/list', listUsers, {end:false, admin:true, template:'list', block:'content.user.list'}, this.parallel());
      module.router.addRoute('GET /admin/role/register', roleForm, {end:false, admin:true, block:'content'}, this.parallel());
      module.router.addRoute('GET /admin/role/list', listRoles, {end:false, admin:true, template:'list', block:'content.user.list'}, this.parallel());
      module.router.addRoute('GET /admin/roles/:role?', roleForm, {end:false, admin:true, block:'content'}, this.parallel());
      module.router.addRoute('POST /admin/roles/:role?', updateRole, {block:'content'}, this.parallel());
      module.router.addRoute('GET /admin/roles/:role/delete', deleteRole, {admin:true}, this.parallel());
      module.router.addRoute('GET /user/logout', logoutUser, null, this.parallel());
      module.router.addRoute('GET /user/register', registerUserForm, {block:'content'}, this.parallel());
      module.router.addRoute('POST /user/register', registerUser, null, this.parallel());
      module.router.addRoute('GET /user', myProfile, {template:'profile', block:'content'}, this.parallel());
      module.router.addRoute('GET /user/profile/:username', userProfile, {template:'profile', block:'content'}, this.parallel());
      module.router.addRoute('POST /user/profile/:username', updateUserProfile, {block:'content'}, this.parallel());
      module.router.addRoute('GET /user/profile/:username/edit', updateUserForm, {block:'content'}, this.parallel());
      module.router.addRoute('GET /user/profile/:username/lock', lockUser, {admin:true}, this.parallel());
      module.router.addRoute('GET /user/profile/:username/unlock', unlockUser, {admin:true}, this.parallel());
      module.router.addRoute('GET /user/profile/:username/delete', deleteUser, {admin:true}, this.parallel());

    },
    function done() {

      var User = new calipso.lib.mongoose.Schema({
        // Single default property
        username:{type:String, required:true, unique:true},
        fullname:{type:String, required:false},
        password:{type:String, required:false},
        hash:{type:String, required:true, "default":''},
        email:{type:String, required:true, unique:true},
        showName:{type:String, "default":'registered'},
        showEmail:{type:String, "default":'registered'},
        about:{type:String},
        language:{type:String, "default":'en'},
        roles:[String],
        locked:{type:Boolean, "default":false}
      });

      calipso.db.model('User', User);

      // Initialise roles
      roles.init(module, app, next);

    }
  )

}

/**
 * Set a cookie with some user data
 * put some of the user information in a cookie so that most pages can be
 * personalized with javascript - a common strategy for aggressive page caching
 * TODO - fix a bug wherein the cookie gets set twice *if* on an admin page
 * TODO - make sure this is the appropriate place for setting this cookie
 * TODO - need to fix overall what modules do when an earlier one has already issued a 302 ...
 */
function setCookie(req, res, template, block, next) {

  if (res.statusCode != 302) {
    if (req.session.user) {
      if (!req.cookies.userData) {
        res.cookie('userData', JSON.stringify(req.session.user));
      }
    } else {
      res.clearCookie('userData');
    }
  }
  next();

}

/**
 * Helper function to get user details respecting their privacy selections
 * Returns object of:
 * {
 *   displayName: - formatted name to show - either their full name + username, or just username.
 *   displayEmail: - either their email address or empty.
 * }
 * This needs to be a synchronous call so it can be used in templates.
 */
function userDisplay(req, username, next) {

  var isAdmin = (req.session.user && req.session.user.isAdmin);
  var isUser = (req.session.user);
  var User = calipso.db.model('User');
  var responseData = {name:'', email:''};

  User.findOne({username:username}, function (err, u) {

    if (err || !u) {

      // Fail gracefully
      responseData.name = username + " [" + req.t("No longer active") + "]";

    } else {

      // Default display name
      responseData.name = u.username;
      if (isAdmin || (u.showName === 'registered' && isUser) || u.showName === 'public') {
        responseData.name = u.fullname || u.username;
      }

      // Default display name
      responseData.email = '';
      if (isAdmin || (u.showEmail === 'registered' && isUser) || u.showEmail === 'public') {
        responseData.email = u.email;
      }

    }
    next(null, responseData);

  });

}

function userFields() {
  var fields = calipso.auth.password ? [
    {label:'Username', name:'user[username]', type:'text', required:true, 'placeholder':"Your username"},
    {label:'Password', name:'user[password]', type:'password', required:true, 'placeholder':"Your password"}
  ] : [];
  if (calipso.auth.google) {
    fields.push({name:'google', text:'Use Google Login', type:'link', href:'/auth/google', cls:'googleicon'});
  }
  if (calipso.auth.twitter) {
    fields.push({name:'twitter', text:'Use Twitter Login', type:'link', href:'/auth/twitter', cls:'twittericon'});
  }
  if (calipso.auth.facebook) {
    fields.push({name:'facebook', text:'Use Facebook Login', type:'link', href:'/auth/facebook', cls:'facebookicon'});
  }
  return fields;
}

/**
 * Login form
 */
function loginForm(req, res, template, block, next) {
  var fields = userFields();
  var buttons = calipso.auth.password ?
    [
      {name:'submit', type:'submit', value:'Login'},
      {name:'register', type:'link', href:'/user/register', value:'Register'}
    ]
    :
    [
      {name:'submit', type:'submit', value:'Login'}
    ];

  var userForm = {
    id:'login-form', cls:'login', title:'Log In', type:'form', method:'POST', action:'/user/login',
    fields:fields,
    buttons:buttons
  };

  calipso.form.render(userForm, null, req, function (form) {
    calipso.theme.renderItem(req, res, template, block, {form:form}, next);
  });

}

/**
 * Login form
 */
function loginPage(req, res, template, block, next) {
  var fields = userFields();
  var userForm = {
    id:'login-form', cls:'login', title:'Log In', type:'form', method:'POST', action:'/user/login',
    fields:fields,
    buttons:[
      {name:'submit', type:'submit', value:'Login'}
    ]
  };

  calipso.form.render(userForm, null, req, function (form) {
    calipso.theme.renderItem(req, res, template, block, {form:form}, next);
  });

}

function roleForm(req, res, template, block, next) {

  res.layout = 'admin';
  var Role = calipso.db.model('Role');

  function finish(role) {
    // TODO : Use secitons!
    if (req.session.user.isAdmin && role && (role.name != 'Guest') && (role.name != 'Administrator') && (role.name != 'Contributor')) {
      res.menu.adminToolbar.addMenuItem({name:'Delete Role', path:'return', url:'/admin/roles/' + role._id + '/delete', description:'Delete role ...', security:[], icon:"icon-close"});
    }
    var roleForm = {
      id:'FORM', title:req.t('Register'), type:'form', method:'POST', action:'/admin/roles/' + (role && role._id ? role._id : ""),
      sections:[
        {
          id:'form-section-core',
          label:'The New Role',
          fields:[
            {label:'Role Name', name:'role[name]', type:'text', description:'Enter the name of the role.', required:true, placeholder:"Role Name"},
            {label:'Description', name:'role[description]', type:'text', description:'Enter the description of the role.', placeholder:"Enter a role description (optional)"},
            {label:'Is Default', name:'role[isDefault]', type:'checkbox', description:'Is this a default role?', required:true},
            {label:'Is Admin', name:'role[isAdmin]', type:'checkbox', description:'Is a user with this role an admin?', required:true}
          ]
        }
      ],
      buttons:[
        {name:'submit', type:'submit', value:'Register'}
      ]
    };

    calipso.form.render(roleForm, {role:role}, req, function (form) {
      calipso.theme.renderItem(req, res, form, block, {}, next);
    });
  }

  if (req.moduleParams.role) {
    Role.findOne({_id:req.moduleParams.role}, function (err, role) {
      finish(role);
    });
  } else {
    finish(null);
  }
};

/**
 * Register form
 */
function registerUserForm(req, res, template, block, next) {

  res.layout = 'admin';

  // TODO : Use secitons!
  var userForm = {
    id:'FORM', title:req.t('Register'), type:'form', method:'POST', action:'/user/register',
    sections:[
      {
        id:'form-section-core',
        label:'Your Details',
        fields:[
          {label:'Username', name:'user[username]', type:'text', description:'Enter the username you would like to use on this site.', required:true, placeholder:"Username"},
          {label:'Full Name', name:'user[fullname]', type:'text', description:'Enter your actual name.  You can control the privacy settings of this.', required:true, placeholder:"Full Name"},
          {label:'Email', name:'user[email]', type:'email', description:'Enter your email address, you can control the privacy settings of this.', required:true, placeholder:"someone@gmail.com"},
          {label:'Language', name:'user[language]', type:'select', options:req.languages, description:'Select your default language.', required:true},
          // TODO : Select based on available
          {label:'About You', name:'user[about]', type:'textarea', description:'Write something about yourself.  This will appear on your profile page.', required:true, placeholder:"Description of me"},
          {label:'New Password', name:'user[new_password]', type:'password', description:'Enter a password, the stronger the better.', required:true, placeholder:"Password"},
          {label:'Repeat Password', name:'user[repeat_password]', type:'password', description:'Repeat as always.', required:true, placeholder:"Repeat Password"},
          {label:'Show Full Name', name:'user[showName]', type:'select', required:true, options:[
            {label:'Never', value:'never'},
            {label:'Registered Users Only', value:'registered'},
            {label:'Public', value:'public'}
          ], description:'Decide how your profile displays your full name.'},
          {label:'Show Email', name:'user[showEmail]', type:'select', options:[
            {label:'Never', value:'never'},
            {label:'Registered Users Only', value:'registered'},
            {label:'Public', value:'public'}
          ], description:'Decide how your profile displays your email.', required:true}
        ]
      }
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Register'}
    ]
  };

  // Allow admins to register other admins
  if (req.session.user && req.session.user.isAdmin) {

    // Role checkboxes
    var roleFields = [];
    calipso.data.roleArray.forEach(function (role) {
      roleFields.push(
        {label:role, name:'user[roles][' + role + ']', type:'checkbox', checked:false}
      );
    });

    userForm.sections[0].fields.push({
      type:'fieldset',
      name:'roles_fieldset', // shouldn't need a name ...
      legend:'User Roles',
      fields:roleFields
    });

  }

  calipso.form.render(userForm, null, req, function (form) {
    calipso.theme.renderItem(req, res, form, block, {}, next);
  });

}

/**
 * Update user form
 */
function updateUserForm(req, res, template, block, next) {

  res.layout = 'admin';

  var isAdmin = (req.session.user && req.session.user.isAdmin);
  var User = calipso.db.model('User');
  var username = req.moduleParams.username;
  var roleSection = 3; // Update if changing sections
  var passwordSection = 1; // Update if changing sections

  if (isAdmin) {
    res.menu.adminToolbar.addMenuItem(req, {name:'Return', path:'return', url:'/user/profile/' + username, description:'Show user ...', security:[], icon:"icon-undo"});
  }

  var userForm = {
    id:'FORM', title:'Update Profile', type:'form', method:'POST', tabs:true, action:'/user/profile/' + username,
    sections:[
      {
        id:'form-section-core',
        label:'Profile',
        fields:[
          {label:'Username', name:'user[username]', type:'text', readonly:!isAdmin},
          {label:'Full Name', name:'user[fullname]', type:'text'},
          {label:'Email', name:'user[email]', type:'email'},
          {label:'Language', name:'user[language]', type:'select', options:req.languages},
          // TODO : Select based on available
          {label:'About You', name:'user[about]', type:'textarea'}
        ]
      },
      {
        id:'form-section-about',
        label:'Password',
        fields:[
          {label:'Old Password', name:'user[old_password]', type:'password', description:req.t('Leave blank if not changing password.')},
          {label:'New Password', name:'user[new_password]', type:'password'},
          {label:'Repeat Password', name:'user[repeat_password]', type:'password'}
        ]
      },
      {
        id:'form-section-privacy',
        label:'Privacy',
        fields:[
          {label:'Show Full Name', name:'user[showName]', type:'select', options:[
            {label:'Never', value:'never'},
            {label:'Registered Users Only', value:'registered'},
            {label:'Public', value:'public'}
          ]},
          {label:'Show Email', name:'user[showEmail]', type:'select', options:[
            {label:'Never', value:'never'},
            {label:'Registered Users Only', value:'registered'},
            {label:'Public', value:'public'}
          ]}
        ]
      },
      {
        id:'form-section-roles',
        label:'Roles',
        fields:[]
      }
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Save Profile'}
    ]
  };

  // Quickly check that the user is an admin or it is their account
  if (req.session.user && (req.session.user.isAdmin || req.session.user.username === username)) {
    // We're ok
  } else {
    req.flash('error', req.t('You are not authorised to perform that action.'));
    res.redirect('/');
    return;
  }

  User.findOne({username:username}, function (err, u) {

    // Allow admins to register other admins
    if (req.session.user && req.session.user.isAdmin) {

      // Role checkboxes
      var roleFields = [];
      calipso.data.roleArray.forEach(function (role) {
        roleFields.push(
          {label:role, name:'user[roleList][' + role + ']', type:'checkbox', description:calipso.data.roles[role].description, checked:calipso.lib._.contains(u.roles, role)}
        );
      });

      userForm.sections[roleSection].fields.push({
        type:'fieldset',
        name:'roles_fieldset', // shouldn't need a name ...
        legend:'User Roles',
        fields:roleFields
      });

    } else {
      // remove the section
      delete userForm.sections[roleSection];
    }
    if (u.hash === 'external:auth') {
      delete userForm.sections[passwordSection];
    }

    var values = {user:u};

    calipso.form.render(userForm, values, req, function (form) {
      calipso.theme.renderItem(req, res, form, block, {}, next);
    });

  });

}

/**
 * Lock a user account
 */
function lockUser(req, res, template, block, next) {

  var User = calipso.db.model('User');
  var username = req.moduleParams.username;

  User.findOne({username:username}, function (err, u) {

    if (err || !u) {
      req.flash('error', req.t('There was an error unlocking that user account.'));
      res.redirect('/user/list');
      return;
    }

    u.locked = true;
    calipso.e.pre_emit('USER_LOCK', u);
    u.save(function (err) {
      if (err) {
        req.flash('error', req.t('There was an error unlocking that user account.'));
      } else {
        calipso.e.post_emit('USER_LOCK', u);
        req.flash('info', req.t('Account locked.'));
      }
      res.redirect('/user/profile/' + username);
    });

  });

}

/**
 * Unlock a user account
 */
function unlockUser(req, res, template, block, next) {

  var User = calipso.db.model('User');
  var username = req.moduleParams.username;

  User.findOne({username:username}, function (err, u) {

    if (err || !u) {
      req.flash('error', req.t('There was an error unlocking that user account.'));
      res.redirect('/user/list');
      return;
    }

    u.locked = false;
    calipso.e.pre_emit('USER_UNLOCK', u);
    u.save(function (err) {
      if (err) {
        req.flash('error', req.t('There was an error unlocking that user account.'));
      } else {
        calipso.e.post_emit('USER_UNLOCK', u);
        req.flash('info', req.t('Account unlocked.'));
      }
      res.redirect('/user/profile/' + username);
    });

  });

}

function updateRole(req, res, template, block, next) {
  calipso.form.process(req, function (form) {
    if (form) {
      var role = req.moduleParams.role;
      var Role = calipso.db.model('Role');

      // Quickly check that the user is an admin or it is their account
      if (req.session.user && req.session.user.isAdmin) {
        // We're ok
      } else {
        req.flash('error', req.t('You are not authorised to perform that action.'));
        res.redirect('/');
        return;
      }

      Role.findOne({_id:role}, function (err, role) {
        var role = null;
        if (err || !role) {
          role = new Role(form.role);
        } else {
          role.name = form.role.name;
          role.isDefault = form.role.isDefault;
          role.isAdmin = form.role.isAdmin;
          role.description = form.role.description;
        }
        if (role.name === 'Administrator' || role.name === 'Contributor' || role.name === 'Guest') {
          req.flash('error', req.t('You cannot edit the default calipso roles.'));
          res.redirect('/admin/role/list');
          return;
        }
        if (role.name === 'Administrator' || role.name === 'Contributor' || role.name === 'Guest') {
          req.flash('error', req.t('You cannot name any new roles identical to the default calipso roles.'));
          return roleForm(req, res, template, block, next);
        }
        role.save(function (err) {
          if (err) {
            req.flash('error', req.t('There was an error {err}', {err:err}));
          }

        })
        res.redirect('/admin/role/list');
      });
    } else {
      res.redirect('/admin/role/list');
    }
  });
}

/**
 * Update user
 */
function updateUserProfile(req, res, template, block, next) {
  // Updating a profile through forms can set the username to 'false'
  // Use moduleParams until this is patched.
  var uname = !req.session.user.isAdmin ? req.moduleParams.username : null;

  calipso.form.process(req, function (form) {
    if (form) {

      var username = req.moduleParams.username;
      var User = calipso.db.model('User');

      // Quickly check that the user is an admin or it is their account
      if (req.session.user && (req.session.user.isAdmin || req.session.user.username === username)) {
        // We're ok
      } else {
        req.flash('error', req.t('You are not authorised to perform that action.'));
        res.redirect('/');
        return;
      }

      // Get the password values and remove from form
      // This ensures they are never stored
      var new_password = form.user.new_password;
      delete form.user.new_password;
      var repeat_password = form.user.repeat_password;
      delete form.user.repeat_password;
      var old_password = form.user.old_password;
      delete form.user.old_password;

      User.findOne({username:username}, function (err, u) {
        if (err) {
          req.flash('error', req.t('Could not find user because {msg}.', {msg:err.message}));
          if (res.statusCode != 302) {
            res.redirect('/');
            return;
          }
          next();
          return;
        }

        u.fullname = form.user.fullname;
        u.username = uname || form.user.username;
        u.email = form.user.email;
        u.language = form.user.language;
        u.about = form.user.about;
        u.showName = form.user.showName;
        u.showEmail = form.user.showEmail;

        // Update user roles and admin flag
        if (req.session.user && req.session.user.isAdmin) {
          var newRoles = [];
          u.isAdmin = false; // TO-DO Replace
          for (var role in
            form.user.roleList) {
            if (form.user.roleList[role]) {
              newRoles.push(role);
            }
          }
          u.roles = newRoles;
        }

        // Check to see if we are changing the password
        if (old_password) {

          // Check to see if old password is valid
          calipso.lib.crypto.check(old_password, u.hash, function (err, ok) {
            if (u.hash != '' && !ok) {
              req.flash('error', req.t('Your old password was invalid.'));
              res.redirect('back');
              return;
            }

            // Check to see if new passwords match
            if (new_password != repeat_password) {
              req.flash('error', req.t('Your new passwords do not match.'));
              res.redirect('back');
              return;
            }

            // Check to see if new passwords are blank
            if (new_password === '') {
              req.flash('error', req.t('Your password cannot be blank.'));
              res.redirect('back');
              return;
            }

            u.password = ''; // Temporary for migration to hash, remove later
            // Create the hash
            calipso.lib.crypto.hash(new_password, calipso.config.get('session:secret'), function (err, hash) {
              if (err) {
                req.flash('error', req.t('Could not hash password because {msg}.', {msg:err.message}));
                if (res.statusCode != 302) {
                  res.redirect('/');
                  return;
                }
                next();
                return;
              }
              u.hash = hash;
              saveUser();
            });
          });
        } else {
          saveUser();
        }
        function saveUser() {
          calipso.e.pre_emit('USER_UPDATE', u);
          u.save(function (err) {
            if (err) {

              req.flash('error', req.t('Could not save user because {msg}.', {msg:err.message}));
              if (res.statusCode != 302) {
                // Redirect to old page
                res.redirect('/user/profile/' + username + '/edit');
                return;
              }

            } else {

              calipso.e.post_emit('USER_UPDATE', u);

              // Update session details if your account
              if (req.session.user && (req.session.user.username === username)) {
                // Allows for name change
                createUserSession(req, res, u, function (err) {
                  if (err) {
                    calipso.error("Error saving session: " + err);
                  }
                });
              }

              // Redirect to new page
              res.redirect('/user/profile/' + u.username);
              return;

            }
            // If not already redirecting, then redirect
            next();
          });
        }
      });
    }
  });

}

/**
 * Login
 */
function loginUser(req, res, template, block, next) {

  calipso.form.process(req, function (form) {
    if (form) {

      var User = calipso.db.model('User');
      var username = form.user.username;
      var found = false;

      User.findOne({username:username}, function (err, user) {
        if (user) {
          calipso.lib.crypto.check(form.user.password, user.hash, finish);
        } else {
          finish(null, false);
        }
        function finish(err, ok) {
          if (user && !user.locked && ok) {
            found = true;
            calipso.e.post_emit('USER_LOGIN', user);
            createUserSession(req, res, user, function (err) {
              if (err) {
                calipso.error("Error saving session: " + err);
              }
            });
          }

          if (!found) {
            req.flash('error', req.t('You may have entered an incorrect username or password, please try again.  If you still cant login after a number of tries your account may be locked, please contact the site administrator.'));
          }

          if (res.statusCode != 302) {
            res.redirect(calipso.config.get('server:loginPath') || 'back');
            return;
          }
          next();
          return;
        }
      });
    }
  });

}

/**
 * Helper function to check if the user is an admin
 */
function isUserAdmin(user) {
  // Set admin
  var isAdmin = false;
  user.roles.forEach(function (role) {
    if (calipso.data.roles[role] && calipso.data.roles[role].isAdmin) {
      isAdmin = true;
    }
  });
  return isAdmin;
}

/**
 * Create session object for logged in user
 */
function createUserSession(req, res, user, next) {
  var isAdmin = isUserAdmin(user);
  // Create session
  req.session.user = {username:user.username, isAdmin:isAdmin, id:user._id, language:user.language, roles:user.roles};
  req.session.save(function (err) {
    next(err);
  });
}

calipso.lib.user = {createUserSession:createUserSession};

/**
 * Logout
 */
function logoutUser(req, res, template, block, next) {
  var returnTo = req.moduleParams.returnto || null;
  if (req.session && req.session.user) {

    var User = calipso.db.model('User');
    if (req.logout) {
      req.logout();
    }
    User.findOne({username:req.session.user.username}, function (err, u) {

      req.session.user = null;
      req.session.save(function (err) {
        // Check for error
        calipso.e.post_emit('USER_LOGOUT', u);
        if (res.statusCode != 302) {
          res.redirect(returnTo || 'back');
          return;
        }
        next();

      });

    });

  } else {
    // Fail quietly
    res.redirect(returnTo || 'back');
  }

}

/**
 * Register
 */
function registerUser(req, res, template, block, next) {

  calipso.form.process(req, function (form) {

    if (form) {

      var User = calipso.db.model('User');

      // Get the password values and remove from form
      // This ensures they are never stored
      var new_password = form.user.new_password;
      delete form.user.new_password;
      var repeat_password = form.user.repeat_password;
      delete form.user.repeat_password;

      var u = new User(form.user);

      // Over ride admin
      if (req.session.user && req.session.user.isAdmin) {

        var newRoles = [];
        u.isAdmin = false; // TO-DO Replace
        for (var role in
          form.user.roles) {
          if (form.user.roles[role] === 'on') {
            newRoles.push(role);
            if (calipso.data.roles[role].isAdmin) {
              u.isAdmin = true;
            }
          }
        }
        u.roles = newRoles;

      } else {

        u.roles = ['Guest']; // Todo - need to make sure guest role can't be deleted?

      }

      //TODO : Add form validation and email confirmation

      // Check to see if new passwords match
      if (new_password != repeat_password) {
        req.flash('error', req.t('Your passwords do not match.'));
        res.redirect('back');
        return;
      }

      // Check to see if new passwords are blank
      if (new_password === '') {
        req.flash('error', req.t('Your password cannot be blank.'));
        res.redirect('back');
        return;
      }

      // Create the hash
      calipso.lib.crypto.hash(new_password, calipso.config.get('session:secret'), function (err, hash) {
        if (err) {
          req.flash('error', req.t('Could not hash user password because {msg}.', {msg:msg}));
          if (res.statusCode != 302 && !res.noRedirect) {
            res.redirect('back');
            return;
          }
          next(err);
        }
        u.hash = hash;
        saveUser();
      });

      function saveUser() {
        calipso.e.pre_emit('USER_CREATE', u);
        u.save(function (err) {

          if (err) {
            var msg = err.message;
            if (err.code === 11000) {
              msg = "a user has already registered with that email";
            }
            req.flash('error', req.t('Could not save user because {msg}.', {msg:msg}));
            if (res.statusCode != 302 && !res.noRedirect) {
              res.redirect('back');
              return;
            }
          } else {
            calipso.e.post_emit('USER_CREATE', u);
            if (!res.noRedirect) {
              req.flash('info', req.t('Profile created, you can now login using this account.'));
              res.redirect('/user/profile/' + u.username);
              return;
            }
          }

          // If not already redirecting, then redirect
          next(err);

        });
      }
    }

  });

}

/**
 * My profile (shortcut to profile)
 */
function myProfile(req, res, template, block, next) {
  if (req.session.user) {
    req.moduleParams.username = req.session.user.username;
    userProfile(req, res, template, block, next);
  } else {
    req.flash('error', req.t('You need to login to view your created profile.'));
    res.redirect('/');
  }
}

/**
 * View user profile
 */
function userProfile(req, res, template, block, next) {

  var User = calipso.db.model('User');
  var username = req.moduleParams.username;

  User.findOne({username:username}, function (err, u) {

    if (err || !u) {
      req.flash('error', req.t('Could not locate user: {user}', {user:username}));
      res.redirect('/');
      return;
    }

		// Sanitize user object
		var prop;
		for (var prop in u) {
			if (typeof u[prop] === 'string') {
				u[prop] = sanitizer.sanitize(u[prop]);
			}
		}

    if (req.session.user && req.session.user.isAdmin) {
      res.menu.adminToolbar.addMenuItem(req, {name:'List', weight:2, path:'list', url:'/user/list', description:'List users ...', security:[], icon:"icon-list-3"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Edit', weight:1, path:'edit', url:'/user/profile/' + username + '/edit', description:'Edit user details ...', security:[], icon:"icon-pencil-2"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Delete', weight:3, path:'delete', url:'/user/profile/' + username + '/delete', description:'Delete account ...', security:[], icon:"icon-close"});

      if (u.locked) {
        res.menu.adminToolbar.addMenuItem(req, {name:'Unlock', weight:4, path:'unlock', url:'/user/profile/' + username + '/unlock', description:'Unlock account ...', security:[], icon:"icon-unlocked"});
      } else {
        res.menu.adminToolbar.addMenuItem(req, {name:'Lock', weight:5, path:'lock', url:'/user/profile/' + username + '/lock', description:'Lock account ...', security:[], icon:"icon-locked"});
      }
    }

    userDisplay(req, username, function (err, display) {
      calipso.theme.renderItem(req, res, template, block, {item:u, display:display}, next);
    });

  });

}

function deleteRole(req, res, template, block, next) {
  var Role = calipso.db.model('Role');
  Role.findOne({_id:req.moduleParams.role}, function (err, r) {
    Role.remove({_id:r._id}, function (err) {
      if (err) {
        req.flash('info', req.t('Unable to delete the role because {mst}', {msg:err.message}));
        res.redirect("/admin/role/list");
        return;
      } else {
        req.flash('info', req.t("The role has now been deleted."));
        res.redirect('/admin/role/list');
        return;
      }
      next();
    });
  });
}
/**
 * Delete user
 */
function deleteUser(req, res, template, block, next) {

  var User = calipso.db.model('User');
  var username = req.moduleParams.username;

  User.findOne({username:username}, function (err, u) {

    // Raise USER_DELETE event
    calipso.e.pre_emit('USER_DELETE', u);

    User.remove({_id:u._id}, function (err) {
      if (err) {
        req.flash('info', req.t('Unable to delete the user because {msg}', {msg:err.message}));
        res.redirect("/user/list");
        return;
      } else {
        calipso.e.post_emit('USER_DELETE', u);
        req.flash('info', req.t('The user has now been deleted.'));
        res.redirect("/user/list");
        return;
      }
      next();
    });

  });
}

/**
 * Helper function for link to user
 */
function userLink(req, user) {
  return calipso.link.render({id:user._id, title:req.t('View {user}', {user:user.username}), label:user.username, url:'/user/profile/' + user.username});
}

function roleLink(req, role) {
  if (role.name === 'Guest' || role.name === 'Administrator' || role.name === 'Contributor') {
    return role.name;
  }
  return calipso.link.render({id:role._id, title:req.t('View {role}', {role:role.name}), label:role.name, url:'/admin/roles/' + role._id});
}

/**
 * List all content types
 */
function listUsers(req, res, template, block, next) {

  // Re-retrieve our object
  var User = calipso.db.model('User');

  res.menu.adminToolbar.addMenuItem(req, {name:'Register New User', path:'new', url:'/user/register', description:'Register new user ...', security:[], icon:"icon-user"});

  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var from = req.moduleParams.from ? parseInt(req.moduleParams.from) - 1 : 0;
  var limit = req.moduleParams.limit ? parseInt(req.moduleParams.limit) : 5;
  var sortBy = req.moduleParams.sortBy;

  var query = new Query();

  // Initialise the block based on our content
  User.count(query, function (err, count) {

    var total = count;

    var qry = User.find(query).skip(from).limit(limit);

    // Add sort
    qry = calipso.table.sortQuery(qry, sortBy);

    qry.find(function (err, users) {

      // Render the item into the response
      if (format === 'html') {

        var table = {
          id:'user-list', sort:true, cls:'table-admin',
          columns:[
            {name:'_id', sort:'username', label:'User', fn:userLink},
            {name:'fullname', label:'Full Name'},
            {name:'roles', label:'Roles', sortable:false},
            {name:'email', label:'Email', fn:function (req, row) {
              return calipso.link.render({label:row.email, url:'mailto:' + row.email});
            }}
          ],
          data:users,
          view:{
            pager:true,
            from:from,
            limit:limit,
            total:total,
            url:req.url,
            sort:calipso.table.parseSort(sortBy)
          }
        };

        var tableHtml = calipso.table.render(req, table);

        calipso.theme.renderItem(req, res, tableHtml, block, null, next);

      }

      if (format === 'json') {
        res.format = format;
        res.send(users.map(function (u) {
          return u.toObject();
        }));
        next();
      }

    });

  });
};

/**
 * List all content types
 */
function listRoles(req, res, template, block, next) {

  // Re-retrieve our object
  var Role = calipso.db.model('Role'),
    aPerm = calipso.permission.Helper.hasPermission("admin:role");
  res.menu.adminToolbar.addMenuItem(req,{name:'Register New Role', path:'new', url:'/admin/role/register', description:'Register new role ...', security:[], permit:aPerm, icon:"icon-neutral"});

  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var from = req.moduleParams.from ? parseInt(req.moduleParams.from) - 1 : 0;
  var limit = req.moduleParams.limit ? parseInt(req.moduleParams.limit) : 5;
  var sortBy = req.moduleParams.sortBy;

  var query = new Query();

  // Initialise the block based on our content
  Role.count(query, function (err, count) {

    var total = count;

    var qry = Role.find(query).skip(from).limit(limit);

    // Add sort
    qry = calipso.table.sortQuery(qry, sortBy);

    qry.find(function (err, roles) {

      // Render the item into the response
      if (format === 'html') {

        var table = {
          id:'user-list', sort:true, cls:'table-admin',
          columns:[
            {name:'_id', sort:'name', label:'Role', fn:roleLink},
            {name:'description', label:'Description'},
            {name:'isAdmin', label:'Is Admin'},
            {name:'isDefault', label:'Is Default'}
          ],
          data:roles,
          view:{
            pager:true,
            from:from,
            limit:limit,
            total:total,
            url:req.url,
            sort:calipso.table.parseSort(sortBy)
          }
        };

        var tableHtml = calipso.table.render(req, table);

        calipso.theme.renderItem(req, res, tableHtml, block, null, next);

      }

      if (format === 'json') {
        res.format = format;
        res.send(roles.map(function (u) {
          return u.toObject();
        }));
        next();
      }

    });

  });
};

/**
 * Installation process - asynch
 */
function install(next) {

  // Create the default content types
  var User = calipso.db.model('User');

  calipso.lib.step(

    function createDefaults() {

      var self = this;

      // Create administrative user
      if (calipso.data.adminUser) {

        var adminUser = calipso.data.adminUser;

        // Create a new user
        User.findOne({username:adminUser.username}, function (err, admin) {
          if (admin) {
            admin.fullname = adminUser.fullname;
//            admin.email = adminUser.email; // This is dangerous if trying to reset the password
// Since e-mail has a unique index if the user happens to type the wrong e-mail during a reinstall
// this update will fail and they won't be able to login.
            admin.language = adminUser.language;
            if (!admin.roles) {
              admin.roles = ['Administrator'];
            } else if (admin.roles.indexOf('Administrator') === -1) {
              admin.roles.push('Administrator');
            }
          } else {
            admin = new User({
              username:adminUser.username,
              fullname:adminUser.fullname,
              email:adminUser.email,
              language:adminUser.language,
              about:'',
              roles:['Administrator']
            });
          }
          calipso.lib.crypto.hash(adminUser.password, calipso.config.get('session:secret'), function (err, hash) {
            if (err) {
              console.log(err);
              return self(err);
            }
            admin.hash = hash;
            admin.save(function (err) {
              if (err) console.log(err);
              self(err);
            });
          });
        });
        // Delete this now to ensure it isn't hanging around;
        delete calipso.data.adminUser;

      } else {
        // Fatal error
        self(new Error("No administrative user details provided through login process!"));
      }

    },
    function allDone(err) {
      if (err) {
        calipso.error("User module failed installation " + err.message);
        next();
      } else {
        calipso.info("User module installed ... ");
        roles.install(next);
      }
    }
  )

}
