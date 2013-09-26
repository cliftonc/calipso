/*!
 *
 * Calipso Table Rendering Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Loaded into calipso as a plugin, used to simplify the rendering of tabular data.
 * Including things such as rendering table sorting elements etc.
 * TODO: validation, redisplay of submitted values
 *
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso')),
  qs = require('qs'),
  pager = require(path.join(rootpath, 'utils/pager')),
  merge = require('connect').utils.merge;

// Global variable (in this context) for translation function
var t;

/**
 * The default calipso table object, with default configuration values.
 * Constructor
 */

function CalipsoTable() {

  //TODO Allow over-ride
}

/**
 * Export an instance of our table object
 */
module.exports = new CalipsoTable();


/**
 * Table Renderer, controls the overall creation of the tablle based on a form json object passed
 * in as the first parameter.  The structure of this object is as follows:
 *
 *     table
 *        id : Unique ID that will become the form ID.
 *        title : Title to show at the top of the form.
 *        cls : css class
 *      columns [*] : Form fields array - can be in form or section.
 *        label : Label for form field.
 *        name : Name of form element to be passed back with the value.
 *        type : Type of element, based on the form functions defined below.
 *        sortable : true / false
 *        fn : Function to apply to the row
 *      data [*] : Array of buttons to be rendered at the bottom of the form.
 *      view : COntrols display of this form
 *        pager : show pager
 *        from  : from page
 *        to    : to page
 *        url   : base url for links
 *        sort  : {} of sort field name:dir (asc|desc)
 *
 *  This is synchronous so that it can be called from views.
 *
 * @param item : the json object representing the table
 * @param req : The request object
 */
CalipsoTable.prototype.render = function (req, item) {

  // Store local reference to the request for use during translation
  t = req.t;

  return (
    this.start_table(item) + this.render_headers(item) + this.render_data(item, req) + this.end_table(item) + this.render_pager(item, item.view.url));

};

/**
 * Render the initial table tag
 *
 * @param form
 * @returns {String}
 */
CalipsoTable.prototype.start_table = function (table) {
  return ('<table id="' + table.id + '"' + (table.cls ? ' class="' + table.cls + '"' : "") + '>');
};

/**
 * Close the table
 * @param table
 * @returns {String}
 */
CalipsoTable.prototype.end_table = function (table) {
  return '</table>';
};


/**
 * Render headers
 * @param table
 * @returns {String}
 */
CalipsoTable.prototype.render_headers = function (table) {

  // If there are no columns, return
  if (table.columns== null || table.columns.length === 0) {
    throw new Error("You must define columns to render a table.");
  }

  // Test
  var output = "<thead><tr>";

  // Iterate
  table.columns.forEach(function (column, key) {

    // set the class
    // Check to see if we are sorting by this column
    var cls = getHeaderClass(table, column);

    output += "<th" + (' class="' + cls + '"') + (column.sort ? ' name="' + column.sort + '"' : (column.name ? ' name="' + column.name + '"' : "")) + ">";
    output += column.label;
    output += "</th>";

  });

  output += "</tr></thead>";

  return output;

};

/**
 * Helper function to determine column header sort class
 */

function getHeaderClass(table, column) {

  // Default class
  var cls = column.cls || '';
  // Sortable
  cls += column.sortable === false ? '' : 'sortable';

  if (table.view && table.view.sort && (table.view.sort[column.name] || table.view.sort[column.sort])) {
    cls += ' sorted-' + (table.view.sort[column.sort] || table.view.sort[column.name]);
  } else {
    // Leave as is
  }
  return cls;

}

/**
 * Convert a sortBy parameter into mongo sort queries
 */
CalipsoTable.prototype.sortQuery = function (qry, sortBy) {

  return qry.sort(this.parseSort(sortBy));

};


/**
 * Convert a sort by form param into a view sort object
 */
CalipsoTable.prototype.parseSort = function (sortBy) {

  var options = {};

  if (typeof sortBy === 'string') {
    sortBy = [sortBy];
  }
  if (!sortBy || sortBy.length === 0) {
    return options;
  }

  sortBy.forEach(function (sort) {
    var sortArr = sort.split(",");
    if (sortArr.length === 2) {
      options[sortArr[0]] = sortArr[1];
    }
  });

  return options;
};


/**
 * Render headers
 * @param table
 * @returns {String}
 */
CalipsoTable.prototype.render_data = function (table, req) {

  // If there are no columns, return
  if (table.columns.length === 0) {
    throw new Error("You must define columns to render a table.");
  }

  // Test
  var output = "<tbody>";

  // Iterate
  table.data.forEach(function (row) {
    output += "<tr>";
    // Iterate over the columns
    table.columns.forEach(function (column) {
      output += "<td>";
      if (column.name in row) {
        if (typeof column.fn === "function") {
          output += column.fn(req, row);
        } else {
          output += row[column.name];
        }
      } else {
        output += "Invalid: " + column.name;
      }
      output += "</td>";
    });
    output += "</tr>";
  });

  return output + "</tbody>";

};

/**
 * Render headers
 * @param table
 * @returns {String}
 */
CalipsoTable.prototype.render_pager = function (table, url) {

  // Test
  var output = "";

  if (table.view && table.view.pager) {
    output += pager.render(table.view.from, table.view.limit, table.view.total, url);
  }

  return output;

};
