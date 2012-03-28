/*!
 * Projects module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query,
  url = require('url'),
  fs = require('fs'),
  blocks = require(path.join(rootpath, 'lib/Blocks'));

exports = module.exports = {
  init: init,
  route: route
};

/*
 * Router
 */
function route(req, res, module, app, next) {

  // Menu items
  res.menu.primary.addMenuItem({name:'Projects',path:'prjs',url:'/projects',description:'Project management...',security:[]});
  res.menu.primary.addMenuItem({name:'Create Project',path:'prjs/newProject',url:'/projects/new',description:'Create a new project ...',security:[]});
  res.menu.primary.addMenuItem({name:'View Projects',path:'prjs/viewProjects',url:'/projects',description:'View current projects ...',security:[]});

  // Routing and Route Handler
  module.router.route(req, res, next);
}

/*
 * Initialisation
 */
function init(module, app, next) {

  calipso.e.addEvent('PROJECT_CREATE',{enabled:true,hookio:true});
  // Projects routes
  calipso.lib.step(

  function defineRoutes() {

    // Projects dashboard
    module.router.addRoute('GET /projects', showProjects, {
      template: 'projects',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('GET /project/:name', showProjectByName, {
      template: 'project',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());
   
    module.router.addRoute('GET /projects/new', newProject, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('POST /projects/new', createProject, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());

  }, function done() {
     var Project = new calipso.lib.mongoose.Schema({
        name:{type: String, required: true, "default": ''},
        permissions:{type: String, required: true, "default":'Contributor'},
        description:{type: String, required: false, "default": ''},
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now }
      });

      /* Set post hook to enable simple etag generation
      Asset.pre('save', function (next) {
        this.etag = calipso.lib.crypto.etag(this.title + this.description + this.bucket + this.key);
        next();
      });
      */

      calipso.lib.mongoose.model('Project', Project);

    next();

  });

}
function showProjects(req, res, template, block, next) {
  var Project = calipso.lib.mongoose.model('Project');
  var format = req.moduleParams.format || 'html';
  var query = new Query();

  Project.count(query, function (err, count) {
    var total = count;
    Project.find(query).find(function (err, contents) {
      if(format === 'html') {
        calipso.theme.renderItem(req, res, template, block, {projects:contents}, next);
      } else if(format === 'json') {
        res.format = format;
        res.send(contents.map(function(u) {
          return u.toObject();
        }));
        next();
      }
    });
  });
}
function showProjectByName(req, res, template, block, next) {
  var Project = calipso.lib.mongoose.model('Project');
  var name = req.moduleParams.name;
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  Project.find({name:name}).run( function(err, p) {
    if(err || p === null || !p.length) {
      res.statusCode = 404;
      next();
    } else {
      calipso.theme.renderItem(req, res, template, block, {name:name},next);
    }
  });
}
function newProject(req, res, template, block, next) {
  var name = req.moduleParams.name ? req.moduleParams.name : "";
  var permissions = req.moduleParams.permissions ? req.moduleParams.permissions : "";
  var form = {
    id:'content-type-form',
    title:'Add new project ...',
    type:'form',
    method:'POST',
    action:'/projects/new',
    tabs:false,
    fields:[
      {
        label:'Name',
        name:'name',
        type:'text',
        description:'The name of your project ...'
      },
      {
        label:'Permissions',
        name:'permissions',
        type:'select',
        options:function() { return calipso.data.roleArray },
        description:'Who can access this project? ...'
      }
    ],
    buttons:[
      {
        name:'submit',
        type:'submit',
        value:'Add Project'
      }
    ]
  };


  // Default values
  var values = {
    content: {
      contentType:"Project"
    },
    name:name,
    permissions:permissions
  }

  calipso.form.render(form, values, req, function(form) {
    calipso.theme.renderItem(req,res,form,block,{},next);
  });
}
function createProject(req, res, template, block, next) {
  calipso.form.process(req, function(form) {
    if (form) {
      var Project = calipso.lib.mongoose.model('Project');
      var p = new Project(form);
      var returnTo = form.returnTo ? form.returnTo : "";
      Project.find({name:form.name}).run( function(err, checkP) {
        if(err || checkP === null) {
          req.flash('error',req.t('Something went wrong. Does this mean anything? #{err}'));
          next();
        } else if (!checkP.length) {
          calipso.e.pre_emit('PROJECT_CREATE',p,function(p) {
            p.save(function(err) {
              if(err) {
                calipso.debug(err);
                req.flash('error',req.t('Could not create project because {msg}.',{msg:err.message}));
                if(res.statusCode != 302) {
                  res.redirect('/projects/new?type='+form.content.contentType);
                }
                next();
              } else {
                req.flash('info',req.t('Project saved.'));
                calipso.e.post_emit('PROJECT_CREATE',p,function(p) {
                  if(returnTo) {
                    res.redirect(returnTo);
                  } else {
                    res.redirect('/project/' + p.name);
                  }
                  next();
                });
              }
            });
          });
        } else {
          req.flash('error',req.t('Sorry! A project with that name already exists'));
          next();
        }
      });
    } else {
      req.flash('info',req.t('Where did the form go?'));
      next();
    }
  });
}