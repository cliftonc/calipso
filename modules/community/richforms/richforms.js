/**
 * Enable rich forms (jQuery UI and editor)
 */
var calipso = require('lib/calipso');

/**
 * Turns form date elements into jQUery UI Datepickers
 * REQUIRES jQuery & jQuery UI to be included in the theme ...
 */
exports = module.exports = {
  init: init,
  route: route,
  disable: disable,
  reload: reload,
  depends:["content","contentTypes"]
};

/**
 * ROute
 */
function route(req, res, module, app, next) {

  module.router.route(req, res, next);

};

/**
 *Init
 */
function init(module, app, next) {

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {

    // Add a route to every page, ideally just do it on form pages, but can't tell atm
    module.router.addRoute(/.*/, allPages, {
      end: false,
      template: 'datepicker.script',
      block: 'scripts.richforms.datepicker'
    }, this.parallel());
    module.router.addRoute(/.*/, allPages, {
      end: false,
      template: 'markitup.script',
      block: 'scripts.richforms.markitup'
    }, this.parallel());

    app.use(calipso.lib.express.static(__dirname + '/static'));

    module.router.addRoute('GET /richforms/preview', showPreview, {}, this.parallel());

  }, function done() {

    // Set the old function so it can be reset later
    calipso.form.render_tag_date_default = calipso.form.render_tag_date;

    // Test over-riding a form element
    calipso.form.render_tag_date = function(field, value) {

      // Default value to current date
      var dateValue = value ? value : new Date();

      // The actual date field that is visible
      var tagOutput = '<input class="jquery-ui-datepicker"' + ' id="date-' + field.name.replace('[', '_').replace(']', '') + '"' + ' value="' + calipso.date.formatDate('MM, dd yy', dateValue) + '"' + ' />';

      tagOutput += '<input type="hidden" name="' + field.name + '[date]"' + ' id="date-' + field.name.replace('[', '_').replace(']', '') + '-value"' + ' value="' + calipso.date.formatDate('MM, dd yy', dateValue) + '"' + ' />';

      return tagOutput;

    }

    // TODO : ADD TIME PICKER
    // Any schema configuration goes here
    next();

  });


};

/**
 * Every page block function
 */
function allPages(req, res, template, block, next) {

  calipso.theme.renderItem(req, res, template, block, {}, next);

};

/**
 * Show a blank page to enable the rich form preview
 * This requires that you have a layout called preview, that basically has no header, footer, navigation
 * etc. or you wont get desired results.
 */
function showPreview(req, res, template, block, next) {

  res.layout = "preview";
  next();

};


/*
 * Disable - same as reload
 */
function disable() {
  reload();
}

/**
 * Reload
 */
function reload() {

  // Reset the Form methods to their defaults
  // TODO!
}