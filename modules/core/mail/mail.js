/**
 * Mail module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query,
  mail = require("mailer");

/**
 * Routes this module will respond to
 */
var routes = [
    {path: 'GET /admin/mail/show', fn: showMailTemplates, permit:{}, admin:true, template: 'mail', block: 'content.mail'},
    {path: 'GET /admin/mail/new', fn: newMailTemplateForm, permit:{}, admin:true},
    {path: 'POST /admin/mail/new', fn: newMailTemplate, permit:{}, admin:true},
    {path: 'GET /admin/mail/edit/:id', fn: editMailTemplateForm, permit:{}, admin:true},
    {path: 'POST /admin/mail/edit/:id', fn: editMailTemplate, permit:{}, admin:true},
    {path: 'GET /admin/mail/delete/:id', fn: deleteMailTemplate, permit:{}, admin:true},
    {path: 'POST /admin/mail/delete/:id', fn: deleteMailTemplate, permit:{}, admin:true}
  ];


exports = module.exports = {
  init: init,
  route: route,
  routes: routes
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Mail', permit: {}, path: 'admin/mail', url: '/admin/mail/show', description: 'Manage mail templates ...', security: [] });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module

  var MailTemplate = new calipso.lib.mongoose.Schema({
    name: {type: String, required: true, "default": ''},
    to: {type: calipso.lib.mongoose.Schema.ObjectId, ref: 'User', required: true},
    subject: {type: String, required: true, "defualt": ''},
    body: {type: String, required: true, "default": ''},
    event: {type: String, required: false}   // TODO - Allow multiple events to send an email
  });
  calipso.db.model('MailTemplate', MailTemplate);
  bindEvents();
  next();
}

function bindEvents(){
  calipso.debug("Binding events for mail handler ...");
  MailTemplate = calipso.db.model('MailTemplate');
  MailTemplate.find().run(function(err, mailTemplates){
    if (err || !mailTemplates) {
      calipso.debug('A problem occurred while retrieving your templates.');
      return;
    }
    mailTemplates.forEach(function(mt){
      calipso.e.post(mt.event, module.name, function(e, data){
        MailTemplate.find({event:e.substring(5)}, function(err, mts){
          if(err || !mts){
            calipso.debug("Email: " + mts.name + " was not sent because: " + (err || "unknown."));
          }
          sendMail(mts, data);
        });
      });
    });
  });
}

function sendMail(templates, data){
  if(!templates || !templates.length){
    return;
  }
  var template = templates.splice(0,1)[0];
  var User = calipso.db.model('User');
  User.findById(template.to, function(err, user){
    if(err || !user){
      return sendMail(templates, data);
    }
    var host = calipso.config.get("mail:host");
    var port = calipso.config.get("mail:port");
    var domain = calipso.config.get("mail:domain");
    var authentication = calipso.config.get("mail:authentication") ? 'login' : '';
    var ssl = calipso.config.get("mail:ssl");
    var base64 = calipso.config.get("mail:base64")
    var username = calipso.config.get("mail:username");
    var password = calipso.config.get("mail:password");
    if (base64) {
      username = (new Buffer(username)).toString("base64");
      password = (new Buffer(password)).toString("base64")
    }
    mail.send({
      host : host,                      // smtp server hostname
      port : port,                      // smtp server port
      domain : domain,                  // domain used by client to identify itself to server
      to : user.email,
      from : "admin@antenna.cc",
      subject : template.subject,
      body: template.body + JSON.stringify(data),
      authentication : authentication,  // 'login' is supported; anything else is no auth
      ssl: ssl,                         // true/false
      username : username,              // Account username
      password : password               // Account password
    },
    function(err, result){
        if(err){
          calipso.debug("Error in mail.js: " + err);
        } else {
          calipso.debug("Email sent with result: " + result);
        }
        sendMail(templates, data);
    });
  });
}

/**
 * Show mail templates
 */
function showMailTemplates(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  var template = calipso.modules.mail.templates.mail;
  var parsedTemplates = [];
  res.menu.adminToolbar.addMenuItem(req, {
    name:'New Template',
    path:'newtemplate',
    url:'/admin/mail/new',
    description:'Make a new template ...',
    security:[]
  });
  MailTemplate.find().run(function(err, mailTemplates){
    if (err || !mailTemplates) {
      req.flash('error',req.t('A problem occurred while retrieving your templates.'));
      return next();
    }
    function idToEmail(mailTemplates) {
      if(!mailTemplates || !mailTemplates.length) {
        calipso.theme.renderItem(req, res, template, 'content.mail-templates', {mailTemplates:parsedTemplates}, next);
      } else {
        var mt = mailTemplates.splice(0,1)[0];
        User.findById(mt.to, function(err, user){
          if(err || !user) return;
          parsedTemplates.push({
            name:mt.name,
            event:mt.event,
            to:user.email,
            subject:mt.subject,
            body:mt.body,
            id:mt.id
          });
          idToEmail(mailTemplates);
        });
      }
    }
    idToEmail(mailTemplates);
  });
}

/**
 * New mail template
 */
function newMailTemplateForm(req, res, options, next) {
  var template = calipso.modules.mail.templates.newTemplate;
  var User = calipso.db.model('User');
  var eventArray = [];
  eventArray.push('');
  for (key in calipso.e.events) {
    eventArray.push(key);
  }
  eventArray.sort();
  User.find( function(err, users) {
    var emailArray = [];
    users.forEach(function(user) {
      emailArray.push(user.email);
    });
    var form = {
      id:'content-type-form',
      title:'Add new mail template ...',
      type:'form',
      method:'POST',
      action:'/admin/mail/new',
      tabs:false,
      fields:[
        {
          label:'Name',
          name:'name',
          type:'text'
        },
        {
          label:'Event',
          name:'event',
          type:'select',
          options: function(){ return eventArray;}
        },
        {
          label:'To',
          name:'to',
          type:'select',
          options: function(){ return emailArray;}

        },
        {
          label:'Subject',
          name:'subject',
          type:'text'
        },
        {
          label:'Body',
          name:'body',
          type:'textarea'
        }
      ],
      buttons:[
        {
          name:'submit',
          type:'submit',
          value:'Done'
        }
      ]
    };

    calipso.form.render(form, null, req, function(form) {
      calipso.theme.renderItem(req, res, template, 'content.new-mail-template', {form:form}, next);
    });
  });
}
function newMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  calipso.form.process(req, function(form) {
    if (!form) {
      req.flash('error',req.t('Your new template could not be processed.'));
      return next();
    }
    User.findOne({email:form.to}, function(err, user){
      if (err || !user) {
        req.flash('error',req.t('You must specify a valid recipient.'));
        return next();
      }
      var mt = new MailTemplate({
        name:form.name,
        event:form.event,
        to:user.id,
        subject:form.subject,
        body:form.body
      });
      mt.save(function(err){
        calipso.reloadConfig(mt.event, null, function(){
          res.redirect('/admin/mail/show');
          return next(err);
        }); // Reinitialize calipso to pick up new event bindings
      });
    });
  });
}
function editMailTemplateForm(req, res, options, next) {
  var template = calipso.modules.mail.templates.newTemplate;
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  var id = req.moduleParams.id;
  if(!id){
    req.flash('error',req.t('You must specifiy a template to edit.'));
    return next();
  }
  var eventArray = [];
  eventArray.push('');
  for (key in calipso.e.events) {
    eventArray.push(key);
  }
  eventArray.sort();
  User.find( function(err, users) {
    var emailArray = [];
    users.forEach(function(user) {
      emailArray.push(user.email);
    });
    var form = {
      id:'content-type-form',
      title:'Edit mail template ...',
      type:'form',
      method:'POST',
      action:'/admin/mail/edit/'+id,
      tabs:false,
      fields:[
        {
          label:'Name',
          name:'name',
          type:'text',
          description:'The name of template ...'
        },
        {
          label:'Event',
          name:'event',
          type:'select',
          options: function(){ return eventArray;}
        },
        {
          label:'To',
          name:'to',
          type:'select',
          options: function(){ return emailArray;}
        },
        {
          label:'Subject',
          name:'subject',
          type:'text'
        },
        {
          label:'Body',
          name:'body',
          type:'textarea'
        },
        {
          name:'id',
          type:'hidden',
          value:id
        }
      ],
      buttons:[
        {
          name:'submit',
          type:'submit',
          value:'Done'
        },
        {
          name:'delete',
          type:'button',
          value:'Delete',
          href:'/admin/mail/delete/' + id
        }
      ]
    };
    MailTemplate.findById(id, function(err, mailTemplate){
      if(err || !mailTemplate) {
        req.flash('error',req.t('That template does not exist.'));
        return next();
      }
      User.findById(mailTemplate.to, function(err, user){
        if(err) {
          req.flash('error',req.t('A problem occured while retrieving this form.'));
          return next();
        }
        var values = {};
        values.name = mailTemplate.name;
        values.event = eventArray.indexOf(mailTemplate.event) != -1 ? mailTemplate.event : eventArray[0];
        values.to = emailArray.indexOf(user.email) != -1 ? user.email : emailArray[0];
        values.subject = mailTemplate.subject;
        values.body = mailTemplate.body;
        calipso.form.render(form, values, req, function(form) {
          calipso.theme.renderItem(req, res, template, 'content.new-mail-template', {form:form}, next);
        });
      });
    });
  });
}
function editMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  calipso.form.process(req, function(form) {
    if (!form) {
      req.flash('error',req.t('Your template could not be processed.'));
      return next();
    }
    MailTemplate.findById(form.id, function(err, mailTemplate){
      if(err || !mailTemplate) {
        req.flash('error',req.t('The template you were editing cannot be found.'));
        return next();
      }
      User.findOne({email:form.to}, function(err, user){
        if (err || !user) {
          req.flash('error',req.t('You must specify a valid recipient.'));
          return next();
        }
        mailTemplate.name = form.name || mailTemplate.name;
        mailTemplate.event = form.event;
        mailTemplate.to = user.id;
        mailTemplate.subject = form.subject;
        mailTemplate.body = form.body;
        mailTemplate.save(function(err){
          calipso.reloadConfig(mailTemplate.event, null, function(){
            res.redirect('/admin/mail/show');
            return next(err);
          }); // Reinitialize calipso to pick up new event bindings
        });
      });
    });
  });
}
function deleteMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var id = req.moduleParams.id;
  MailTemplate.findById(id, function(err, mailTemplate){
    if(err || !mailTemplate) {
      req.flash('error',req.t('The template you were deleting cannot be found.'));
      return next();
    }
    mailTemplate.remove(function(err){
      calipso.reloadConfig(mailTemplate.event, null, function(){
        res.redirect('/admin/mail/show');
        return next(err);
      }); // Reinitialize calipso to pick up new event bindings
    });
  });
}
