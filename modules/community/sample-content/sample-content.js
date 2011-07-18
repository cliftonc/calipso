/**
 * Calipso is included in every module
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
  depends:["content","contentTypes"]
};

/**
 * Template module
 */

function route(req, res, module, app, next) {

  // Menus
  //res.menu.primary.push({ name: 'Sample Content', url: '/sample-content', regexp: /sample-content/ });
  res.menu.primary.addMenuItem({name:'Sample Content',path:'sample-content',url:'/sample-content',description:'Sample content ...',security:[]});
  
  // Routes
  module.router.route(req, res, next);

};

function init(module, app, next) {


   //If dependent on another module (e.g. content):
   //if(!calipso.modules.content.initialised) {
   //process.nextTick(function() { init(module,app,next); });
   //return;
   //}

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {

    // Add a route to every page, notice the 'end:false' to ensure block further routing
    //module.router.addRoute(/.*/, allPages, {end:false, template:'template-all', block:'right'}, this.parallel());
    app.use(calipso.lib.express.static(__dirname + '/static'));

    // Page
    module.router.addRoute('GET /sample-content', renderSampleContentPage, {
      template: 'sample-content',
      block: 'content'
    }, this.parallel());
    module.router.addRoute('POST /sample-content', renderSampleContentPage, {
      template: 'sample-content',
      block: 'content'
    }, this.parallel());

  }, function done() {


    // Any schema configuration goes here
    next();
  });

};

/**
 * Render sample content
 */
function renderSampleContentPage(req, res, template, block, next) {

  calipso.form.process(req, function(incomingForm) {

    var sampleForm = {
      id: 'sample-content-form',
      cls: 'sample-content-form',
      title: 'Sample Content Form',
      type: 'form',
      method: 'POST',
      action: '/sample-content',
      fields: [{
        label: 'Text',
        name: 'sample-text',
        type: 'text'
      }, {
        label: 'Textarea',
        name: 'sample-textarea',
        type: 'textarea'
      }, {
        label: 'Password',
        name: 'sample-password',
        type: 'password'
      },
      // "simple" select (values are used for displayed text also):
      {
        label: 'Select (simple)',
        name: 'sample-select-simple',
        type: 'select',
        options: ['Option 1', 'Option 2', 'Option 3']
      },
      // typical select (values may differ from displayed text):
      {
        label: 'Select (typical)',
        name: 'sample-select-typical',
        type: 'select',
        options: [{
          label: 'alpha',
          value: '1'
        }, {
          label: 'beta',
          value: '2'
        }, {
          label: 'gamma',
          value: '3'
        }]
      },
      // optgroup select (has optgroups with both simple and typical option sets):
      {
        label: 'Select (optgroups)',
        name: 'sample-select-optgroups',
        type: 'select',
        optgroups: [{
          label: 'Option Group 1',
          options: ['Option 1', 'Option 2', 'Option 3']
        }, {
          label: 'Option Group 2',
          options: [{
            label: 'delta',
            value: '4'
          }, {
            label: 'epsilon',
            value: '5'
          }, {
            label: 'zeta',
            value: '6'
          }]
        }, {
          label: 'Option Group 3',
          options: ['Option 7', 'Option 8', 'Option 9']
        }]
      }, {
        label: 'Radio 1',
        name: 'radios',
        type: 'radio',
        value: '1'
      }, {
        label: 'Radio 2',
        name: 'radios',
        type: 'radio',
        value: '2'
      }, {
        label: 'Radio 3',
        name: 'radios',
        type: 'radio',
        value: '3'
      }, {
        label: 'Checkbox 1',
        name: 'checkbox1',
        type: 'checkbox',
        value: '1'
      }, {
        label: 'Checkbox 2',
        name: 'checkbox2',
        type: 'checkbox',
        value: '2'
      }, {
        label: 'Checkbox 3',
        name: 'checkbox3',
        type: 'checkbox',
        value: '3'
      }, {
        label: 'File',
        name: 'file',
        type: 'file'
      }, ],
      buttons: [{
        name: 'cancel',
        type: 'button',
        link: '/',
        value: 'Cancel'
      }, {
        name: 'reset',
        type: 'reset',
        value: 'Reset'
      }, {
        name: 'submit',
        type: 'submit',
        value: 'Submit'
      }]
    };

    calipso.form.render(sampleForm, incomingForm, req, function(form) {
      calipso.theme.renderItem(req, res, template, block, {form: form}, next);
    });

  });
};


/**
 * hook for installing
 * @returns
 */

function install() {
  calipso.log("Sample Content module installed");
}

/**
 * hook for disabling
 */

function disable() {
  calipso.log("Sample Content module disabled");
}

/**
 * hook for reloading
 */

function reload() {
  calipso.log("Sample Content module reloaded");
}