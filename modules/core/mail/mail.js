/**
 * Mail module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query,
  mustache = require("mailer/vendor/mustache"),
  mail = require("mailer");

/**
 * Routes this module will respond to
 */
var routes = [
  {path:'GET /admin/mail/show', fn:showMailTemplates, permit:{}, admin:true, template:'mail', block:'content.mail'},
  {path:'GET /admin/mail/new', fn:newMailTemplateForm, permit:{}, admin:true},
  {path:'POST /admin/mail/new', fn:newMailTemplate, permit:{}, admin:true},
  {path:'GET /admin/mail/edit/:id', fn:editMailTemplateForm, permit:{}, admin:true},
  {path:'POST /admin/mail/edit/:id', fn:editMailTemplate, permit:{}, admin:true},
  {path:'GET /admin/mail/delete/:id', fn:deleteMailTemplateForm, permit:{}, admin:true},
  {path:'POST /admin/mail/delete/:id', fn:deleteMailTemplate, permit:{}, admin:true}
];

exports = module.exports = {
  init:init,
  route:route,
  routes:routes,
  config:{
    host:{
      "default":"",
      "label":"SMTP Server",
      "type":"text",
      "description":"This is the SMTP server IP or DNS name.",
      required:true,
      placeholder:"192.168.1.55"
    },
    port:{
      "default":"",
      "label":"SMTP Port",
      "type":"text",
      "description":"This is the SMTP server port to use.",
      required:true,
      placeholder:"9000"
    },
    domain:{
      "default":"",
      "label":"Domain",
      "type":"text",
      "description":"This is the domain name.",
      required:true,
      placeholder:"myDomain"
    },
    authentication:{
      "default":false,
      "label":"Authentication",
      "type":"checkbox",
      "labelFirst":true,
      "description":"Does this SMPT server require authentication?"
    },
    ssl:{
      "default":false,
      "label":"SSL",
      "type":"checkbox",
      "labelFirst":true,
      "description":"Should we use SSL to connect to the SMTP server?"
    },
    from:{
      "default":"",
      "label":"From",
      "type":"text",
      "description":"This is the email address the email is being sent from.",
      required:true,
      placeholder:"someone@gmail.com"
    },
    username:{
      "default":"",
      "label":"Username",
      "type":"text",
      "description":"This is the username to use when authenticating to the SMTP server.",
      required:true,
      placeholder:"admin username"
    },
    password:{
      "default":"",
      "label":"Password",
      "type":"password",
      "description":"This is the password to use to authenticating to the SMTP server.",
      required:true,
      placeholder:"Password"
    },
    base64:{
      "default":false,
      "label":"Base 64 Auth",
      "type":"checkbox",
      "description":"Use base64 encoding for username and password."
    }
  }
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  // Menu
  res.menu.admin.addMenuItem(req, {name:'Mail', permit:{}, path:'admin/mail', url:'/admin/mail/show', description:'Manage mail templates ...', security:[], icon:"icon-newspaper" });

  // Router
  module.router.route(req, res, next);

}

/**
 * Init
 */
function init(module, app, next) {

  // Register events for the Content Module

  var MailTemplate = new calipso.lib.mongoose.Schema({
    name:{type:String, required:true, "default":''},
    to:{type:String, required:true},
    subject:{type:String, required:false, "defualt":''},
    body:{type:String, required:false, "default":''},
    event:{type:String, required:false}
  });
  calipso.db.model('MailTemplate', MailTemplate);
  bindEvents();
  next();
}

function bindEvents() {
  calipso.debug("Binding events for mail handler ...");
  var MailTemplate = calipso.db.model('MailTemplate');
  MailTemplate.find().exec(function (err, mailTemplates) {
    if (err || !mailTemplates) {
      calipso.debug('A problem occurred while retrieving your templates.');
      return;
    }
    mailTemplates.forEach(function (mt) {
      if (!mt.event) {
        return;
      }
      calipso.e.post(mt.event, module.name, function (e, data) {
        MailTemplate.find({event:e.substring(5)}, function (err, mts) {
          if (err || !mts) {
            calipso.debug("Email: " + mts.name + " was not sent because: " + (err || "unknown."));
          }
          sendMail(mts, data);
        });
      });
    });
  });
}

function sendMail(templates, data) {
  if (!templates || !templates.length) {
    return;
  }
  var User = calipso.db.model('User');
  var template = templates.splice(0, 1)[0];
  var query;
  if (template.to === 'Everyone') {
    query = {};
  } else if (template.to === 'Administrators') {
    query = {roles:'Administrator'};
  } else if (template.to === 'Target') {
    query = {username:data.username || data.author};
  } else {
    query = {id:template.to};
  }
  User.find(query, function (err, users) {
    if (err || !users) {
      return sendMail(templates, data);
    }
    function parseUsers(users) {
      if (!users || !users.length) {
        return sendMail(templates, data);
      }
      var user = users.splice(0, 1)[0];
      toUser(user, template, data, function () {
        parseUsers(users);
      });
    }

    parseUsers(users);
  });
}

function toUser(user, template, data, callback) {
  var host = calipso.config.getModuleConfig("mail", "host");
  var port = calipso.config.getModuleConfig("mail", "port");
  var domain = calipso.config.getModuleConfig("mail", "domain");
  var base64 = calipso.config.getModuleConfig("mail", "base64")
  var username = calipso.config.getModuleConfig("mail", "username");
  var password = calipso.config.getModuleConfig("mail", "password");
  if (!host || !port || !domain || !username || !password) {
    return;
  }
  if (base64) {
    username = (new Buffer(username)).toString("base64");
    password = (new Buffer(password)).toString("base64");
  }
  var body = mustache.to_html(template.body, {
    toUser:user.username || '-',
    servername:calipso.config.get('server:name'),
    address:calipso.config.get('server:url'),
    data:data
  });
  mail.send({
      host:host, // smtp server hostname
      port:port, // smtp server port
      domain:domain, // domain used by client to identify itself to server
      to:user.email,
      from:calipso.config.getModuleConfig("mail", "from"),
      subject:template.subject,
      body:body,
      authentication:calipso.config.getModuleConfig("mail", "authentication") ? 'login' : '',
      ssl:calipso.config.getModuleConfig("mail", "ssl") == true ? true : false, // true/false
      username:username, // Account username
      password:password               // Account password
    },
    function (err, result) {
      if (err) {
        calipso.debug("Error in mail.js: " + err);
      } else {
        calipso.debug("Email sent with result: " + result);
      }
      callback();
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
    security:[],
    icon:"icon-file-add"
  });
  MailTemplate.find().exec(function (err, mailTemplates) {
    if (err || !mailTemplates) {
      req.flash('error', req.t('A problem occurred while retrieving your templates.'));
      return next();
    }
    function idToEmail(mailTemplates) {
      if (!mailTemplates || !mailTemplates.length) {
        calipso.theme.renderItem(req, res, template, 'content.mail-templates', {mailTemplates:parsedTemplates}, next);
      } else {
        var mt = mailTemplates.splice(0, 1)[0];
        User.findById(mt.to, function (err, user) {
          var to;
          if (err || !user) {
            if (mt.to != 'Everyone' && mt.to != 'Administrators' && mt.to != 'Target') {
              req.flash('error', req.t('You must specify a valid recipient.'));
              return next();
            }
            to = mt.to;
          } else {
            to = user.email;
          }
          parsedTemplates.push({
            name:mt.name,
            event:mt.event,
            to:to,
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
  getMailTemplateForm('new', null, function (form) {
    calipso.form.render(form, null, req, function (form) {
      calipso.theme.renderItem(req, res, template, 'content.new-mail-template', {form:form}, next);
    });
  });
}
function newMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  calipso.form.process(req, function (form) {
    if (!form) {
      req.flash('error', req.t('Your new template could not be processed.'));
      return next();
    }
    User.findOne({email:form.to}, function (err, user) {
      var to;
      if (err || !user) {
        if (form.to != 'Everyone' && form.to != 'Administrators' && form.to != 'Target') {
          req.flash('error', req.t('You must specify a valid recipient.'));
          return next();
        }
        to = form.to;
      } else {
        to = user.id;
      }
      var mt = new MailTemplate({
        name:form.name,
        event:form.event,
        to:to,
        subject:form.subject,
        body:form.body
      });
      mt.save(function (err) {
        if (err) {
          req.flash('error', req.t('You must fill in the required fields.' + err));
          return next();
        }
        calipso.reloadConfig(mt.event, null, function () {
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
  if (!id) {
    req.flash('error', req.t('You must specifiy a template to edit.'));
    return next();
  }
  getMailTemplateForm('edit', id, function (form) {
    MailTemplate.findById(id, function (err, mailTemplate) {
      if (err || !mailTemplate) {
        req.flash('error', req.t('That template does not exist.'));
        return next();
      }
      User.findById(mailTemplate.to, function (err, user) {
        var to;
        if (err || !user) {
          if (mailTemplate.to != 'Everyone'
            && mailTemplate.to != 'Administrators' && mailTemplate.to != 'Target') {
            req.flash('error', req.t('A problem occured while retrieving this form.'));
            return next();
          }
          to = mailTemplate.to;
        } else {
          to = user.email;
        }
        var values = {};
        values.name = mailTemplate.name;
        values.event = mailTemplate.event;
        values.to = to;
        values.subject = mailTemplate.subject;
        values.body = mailTemplate.body;
        calipso.form.render(form, values, req, function (form) {
          calipso.theme.renderItem(req, res, template, 'content.new-mail-template', {form:form}, next);
        });
      });
    });
  });
}
function editMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  var User = calipso.db.model('User');
  calipso.form.process(req, function (form) {
    if (!form) {
      req.flash('error', req.t('Your template could not be processed.'));
      return next();
    }
    MailTemplate.findById(form.id, function (err, mailTemplate) {
      if (err || !mailTemplate) {
        req.flash('error', req.t('The template you were editing cannot be found.'));
        return next();
      }
      User.findOne({email:form.to}, function (err, user) {
        var to;
        if (err || !user) {
          if (form.to != 'Everyone' && form.to != 'Administrators' && form.to != 'Target') {
            req.flash('error', req.t('You must specify a valid recipient.'));
            return next();
          }
          to = form.to;
        } else {
          to = user.id;
        }
        mailTemplate.name = form.name || mailTemplate.name;
        mailTemplate.event = form.event;
        mailTemplate.to = to;
        mailTemplate.subject = form.subject;
        mailTemplate.body = form.body;
        mailTemplate.save(function (err) {
          if (err) {
            req.flash('error', req.t('You must fill in the required fields.' + err));
            return next();
          }
          calipso.reloadConfig(mailTemplate.event, null, function () {
            res.redirect('/admin/mail/show');
            return next(err);
          }); // Reinitialize calipso to pick up new event bindings
        });
      });
    });
  });
}
function deleteMailTemplateForm(req, res, options, next) {
  var id = req.moduleParams.id;
  var template = calipso.modules.mail.templates.newTemplate;
  var MailTemplate = calipso.db.model('MailTemplate');
  if (!id) {
    req.flash('error', req.t('The template you were deleting cannot be found.'));
    return next();
  }
  MailTemplate.findById(id, function (err, mailTemplate) {
    if (err || !mailTemplate) {
      req.flash('error', req.t('The template you were deleting cannot be found.'));
      return next();
    }
    var form = {
      id:'content-type-form',
      title:'Are you sure you want to do this?',
      description:'This action cannot be undone.',
      type:'form',
      method:'POST',
      action:'/admin/mail/delete/' + id,
      tabs:false,
      fields:[
        {
          label:'Deleting',
          description:mailTemplate.name,
          name:'id',
          type:'hidden',
          value:mailTemplate.id
        }
      ],
      buttons:[
        {
          name:'delete',
          type:'submit',
          value:'Delete'
        },
        {
          name:'cancel',
          type:'button',
          href:'/admin/mail/edit/' + id,
          value:'Cancel'
        }
      ]
    };
    calipso.form.render(form, null, req, function (form) {
      calipso.theme.renderItem(req, res, template, 'content.new-mail-template', {form:form}, next);
    });
  });
}
function deleteMailTemplate(req, res, options, next) {
  var MailTemplate = calipso.db.model('MailTemplate');
  calipso.form.process(req, function (form) {
    if (!form) {
      req.flash('error', req.t('The template you were deleting cannot be found.'));
      return next();
    }
    MailTemplate.findById(form.id, function (err, mailTemplate) {
      if (err || !mailTemplate) {
        req.flash('error', req.t('The template you were deleting cannot be found.'));
        return next();
      }
      mailTemplate.remove(function (err) {
        calipso.reloadConfig(mailTemplate.event, null, function () {
          res.redirect('/admin/mail/show');
          return next(err);
        }); // Reinitialize calipso to pick up new event bindings
      });
    });
  });
}

function getMailTemplateForm(type, id, callback) {
  var User = calipso.db.model('User');
  var eventArray = [];
  eventArray.push('');
  for (key in
    calipso.e.events) {
    eventArray.push(key);
  }
  eventArray.sort();
  User.find(function (err, users) {
    var emailArray = [];
    emailArray.push('Everyone', 'Administrators', 'Target');
    users.forEach(function (user) {
      emailArray.push(user.email);
    });
    var form = {
      id:'content-type-form',
      title:type === 'new' ? 'Add new mail template ...' : 'Edit mail template ...',
      type:'form',
      method:'POST',
      action:type === 'new' ? '/admin/mail/new' : '/admin/mail/edit/' + id,
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
          options:function () {
            return eventArray;
          }
        },
        {
          label:'To',
          name:'to',
          type:'select',
          options:function () {
            return emailArray;
          }

        },
        {
          label:'Subject',
          name:'subject',
          type:'text'
        },
        {
          label:'Body',
          name:'body',
          type:'textarea',
          description:"Available tags are toUser, servername, address, and data. See http://mustache.github.com for more info."
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
    if (type != 'new') {
      form.buttons.push({
        name:'delete',
        type:'button',
        value:'Delete',
        href:'/admin/mail/delete/' + id
      });
      form.fields.push({
        name:'id',
        type:'hidden',
        value:id
      });
    }
    callback(form);
  });
}
