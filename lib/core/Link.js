/*!
 *
 * Calipso Link Rendering Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Loaded into calipso as a plugin, used to simplify rendering of links
 *
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso')),
  qs = require('qs');

// Global variable (in this context) for translation function
var t;

/**
 * The default calipso link object, with default configuration values.
 * Constructor
 */

function CalipsoLink() {

  //TODO Allow over-ride
}

/**
 * Export an instance of our link object
 */
module.exports = new CalipsoLink();


/**
 * Link Renderer, controls the overall creation of the tablle based on a form json object passed
 * in as the first parameter.  The structure of this object is as follows:
 *
 *     link
 *        id : Unique ID that will become the link ID.
 *        title : Title to show (hover)
 *        target : target window
 *        label : label to show in link
 *        cls : css class
 *        url: the direct url to use, can be function (mandatory)
 *
 * @param item : the json object representing the form
 * @param next : Callback when done, pass markup as return val.
 */
CalipsoLink.prototype.render = function (item) {

  return (
    this.render_link(item));

};

/**
 * Render link
 *
 * @param link
 * @returns {String}
 */
CalipsoLink.prototype.render_link = function (link) {

  var url = "";
  if (typeof link.url === 'function') {
    url = link.url(link);
  } else {
    url = link.url;
  }

  return ('<a' + ' href="' + url + '"' + (link.id ? ' id=' + link.id + '"' : "") + (link.target ? ' target="' + link.target + '"' : "") + (link.title ? ' title="' + link.title + '"' : "") + (link.cls ? ' class="' + link.cls + '"' : "") + '>' + (link.label || "") + '</a>');
};
