/**
 * Template module
 */
var calipso = require('lib/calipso');

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,
  install: install,
  reload: reload,
  disable: disable,
  jobs: {
    templateJob: templateJob
  },
  depends:["content","contentTypes"],
  last: true,
  // Exposed function for calling via getModuleFn
  templatePage: templatePage
};

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  // Menu items
  //res.menu.primary.push({ name: 'Template', url: '/template', regexp: /template/});
  res.menu.primary.addMenuItem({name:'Template',path:'template',url:'/template',description:'Template module ...',security:[]});

  // Router
  module.router.route(req, res, next);

};


/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {

  calipso.e.addEvent('TEMPLATE_EVENT');  
  
  // Version event listeners
  calipso.e.custom('TEMPLATE_EVENT','PING',module.name,templatePing);
  calipso.e.pre('CONTENT_CREATE',module.name,templateEvent);
  calipso.e.post('CONTENT_CREATE',module.name,templateEvent);  
  calipso.e.pre('CONTENT_UPDATE',module.name,templateEvent);
  calipso.e.post('CONTENT_UPDATE',module.name,templateEvent);  
  calipso.e.pre('CONTENT_CREATE_FORM',module.name,formAlter);
  calipso.e.pre('CONTENT_UPDATE_FORM',module.name,formAlter);
  
  calipso.lib.step(

  function defineRoutes() {

    // Add a route to every page, notice the 'end:false' to ensure block further routing
    module.router.addRoute(/.*/, allPages, {
      end: false,
      template: 'templateAll',
      block: 'right'
    }, this.parallel());

    // Page
    module.router.addRoute('GET /template', templatePage, {
      template: 'templateShow',
      block: 'content'
    }, this.parallel());

  }, function done() {

    // Any schema configuration goes here
    next();

  });


};

/**
 * Simple template page function
 */
function templatePage(req, res, template, block, next) {

  // Set any variables
  var myVariable = "Hello World";

  // Create a content item
  var item = {
    id: "NA",
    type: 'content',
    meta: {
      variable: myVariable
    }
  };
  
  // Raise a ping
  calipso.e.custom_emit('TEMPLATE_EVENT','PING',{req:req}, function(options) {
  
    // Render the item via the template provided above
    calipso.theme.renderItem(req, res, template, block, {
      item: item
    },next);

  });

  
};

/**
 * Every page block function
 */
function allPages(req, res, template, block, next) {

  var myVariable = "Hello World on every page!";
  var item = {
    id: "NA",
    type: 'content',
    meta: {
      variable: myVariable
    }
  };

  calipso.theme.renderItem(req, res, template, block, {
    item: item
  },next);

};

/**
 * Function called by event listeners
 */
function templateEvent(event,content,next) {
  
  // Content - fires
  console.log(event + " @ " + content.title);
  return next();
  
}

/**
 * Function called by event listeners
 */
function templatePing(event,options,next) {
  
  // Req is passed through by the event emitter (specifically, not normally done)
  options.req.flash('info','Fired from an ' + event + ' listener in the page rendering process ... You are: ' + (options.req.session.user ? options.req.session.user.username : " The Invisible Man/Woman!"));  
  return next();
  
}


/**
 * Example of a form alter
 * Adds a new section to the content create and update forms
 */
function formAlter(event,form,next) {
  
  // Content - fires
  var newSection = {
    id:'form-section-template',
    label:'Template Alter',
    fields:[
            {label:'Status',name:'content[template]',type:'textarea',description:'A field added dynamically to the content from by the template module'},                 
           ]
  }
  
  form.sections.push(newSection);
  
  return next(form);
  
}

/**
 * Template installation hook
 */
function install() {
  calipso.log("Template module installed");
}

/**
 * hook for disabling
 */
function disable() {
  calipso.log("Template module disabled");
}

/**
 * Admin hook for reloading
 */
function reload() {
  calipso.log("Template module reloaded");
}

/**
 * Template Job
 */
function templateJob(args, next) {
  calipso.log("Template job function called with args: " + args);
  next();
}