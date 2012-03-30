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
  res.menu.admin.addMenuItem({name:'Projects',path:'prjs',url:'/projects',description:'Project management...',security:[]});
  res.menu.admin.addMenuItem({name:'Create Project',path:'prjs/newProject',url:'/projects/new',description:'Create a new project ...',security:[]});
  res.menu.admin.addMenuItem({name:'View Projects',path:'prjs/viewProjects',url:'/projects',description:'View current projects ...',security:[]});
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
  calipso.e.addEvent('FOLDER_CREATE',{enabled:true,hookio:true});
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

    module.router.addRoute('GET /project/:name/:fname', showFolderByName, {
      template: 'folder',
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
        description:{type: String, required: false},
        owner:{type: String, required: true, "default": 'admin'},
        permissions:{type: String, required: true, "default":'Contributor'},
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now }
      });
      var Folder = new calipso.lib.mongoose.Schema({
        name:{type: String, required: true, "default": ''},
        project:{type: String, required: true},
        canWrite: {type: Boolean, required: true, "default": true},
        canDelete: {type: Boolean, required: true, "default": false},
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now }
      });

      calipso.lib.mongoose.model('Project', Project);
      calipso.lib.mongoose.model('Folder', Folder);

    next();

  });

}
function showProjects(req, res, template, block, next) {
  var Project = calipso.lib.mongoose.model('Project');
  var format = req.moduleParams.format || 'html';
  var query = queryPermissions(req);
  Project.find(query).run( function(err, contents) {
    if (format === 'html') {
      calipso.theme.renderItem(req, res, template, block, {projects:contents}, next);
    } else if (format === 'json') {
      res.format = format;
      res.send(contents.map(function(u) {
        return u.toObject();
      }));
      next();
    }
  });
}
function showProjectByName(req, res, template, block, next) {
  var Project = calipso.lib.mongoose.model('Project');
  var Folder = calipso.lib.mongoose.model('Folder');
  var name = req.moduleParams.name;
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";
  var query = queryPermissions(req);
  Project.find(query).find({name:name}).run( function(err, p) {
    if(err || p === null || !p.length) {
      res.statusCode = 404;
      next();
    } else {
      Folder.find({project:p[0].id}).run( function(err, f) {
        calipso.theme.renderItem(req, res, template, block, {
        project:p[0],
        folders:f
      },next);
      });
    }
  });
}
function showFolderByName(req, res, template, block, next) {
  var Project = calipso.lib.mongoose.model('Project');
  var Folder = calipso.lib.mongoose.model('Folder');
  var name = req.moduleParams.name;
  var fname = req.moduleParams.fname;
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";
  var query = queryPermissions(req);
  Project.find(query).find({name:name}).run( function(err, p) {
    if(err || p === null || !p.length) {
      res.statusCode = 404;
      next();
    } else {
      Folder.find({name:fname}).run( function(err, f) {
        if(err || f === null || !f.length) {
          res.statusCode = 404;
          next();
        } else {
          calipso.theme.renderItem(req, res, template, block, {
            folder:f[0]
          },next);
        }
      });
    }
  });
}
function queryPermissions(req) {
  if (req.session.user.isAdmin) { return {}; }
  var query = new Query();
  query.or([{
    permissions:req.session.user.roles[0]},
    {owner:req.session.user.username}
  ]); // TODO iterate over all user.roles
  return query;
}
function newProject(req, res, template, block, next) {
  var name = req.moduleParams.name ? req.moduleParams.name : "";
  var description = req.moduleParams.description ? req.moduleParams.description : "";
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
        label:'Description',
        name:'description',
        type:'textarea',
        description:'Description of your project ...'
      },
      {
        label:'',
        name:'owner',
        type:'hidden'
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
    description:description,
    owner:req.session.user.username,
    permissions:permissions
  };

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
          req.flash('error',req.t('Something went wrong. Does this mean anything to you? {msg}.', {msg:err.message}));
          next();
        } else if (!checkP.length) {
          calipso.e.pre_emit('PROJECT_CREATE',p,function(p) {
            p.save(function(err) {
              if(err) {
                calipso.debug(err);
                req.flash('error',req.t('Could not create project because {msg}.', {msg:err.message}));
                if(res.statusCode != 302) {
                  res.redirect('/projects/new?type='+form.content.contentType);
                }
                next();
              } else {
                req.flash('info',req.t('Project saved.'));
                calipso.e.post_emit('PROJECT_CREATE',p,function(p) {
                  createDefaultFolders(p);
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
          req.flash('error',req.t('Nice try! A project with that name already exists ...'));
          next();
        }
      });
    } else {
      req.flash('info',req.t('Woah there, slow down. You should stick with the forms ...'));
      next();
    }
  });
}
function createDefaultFolders(p) {
  var archive = createFolder("Archive", p.id, true, false);
  var work = createFolder("Work", p.id, true, true);
  var publish = createFolder("Publish", p.id, true, true);
  saveFolder(archive);
  saveFolder(work);
  saveFolder(publish);
}
function createFolder(name, project, canWrite, canDelete) {
  var Folder = calipso.lib.mongoose.model('Folder');
  var f = new Folder({
    name:name,
    project:project,
    canWrite:canWrite,
    canDelete:canDelete,
    created: Date.now(),
    updated: Date.now()
  })
  return f;
}
function saveFolder(folder) {
  calipso.e.pre_emit('FOLDER_CREATE',folder,function(folder) {
    folder.save(function(err) {
      if(err) {
        calipso.debug(err);
      } else {
        calipso.e.post_emit('FOLDER_CREATE',folder,function(folder) {});
      }
    });
  });
}