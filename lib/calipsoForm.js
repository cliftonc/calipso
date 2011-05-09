/*
 * Default form rendering library
 */
var sys=require('sys'),
calipso = require('./calipso'),
qs = require('qs'),
merge = require('connect').utils.merge;

/**
 * Core form generation module,
 * This is loaded by calipso as a plugin, so can be replaced by modules.
 * Module must expose a single object as below, with a single
 * function that is called by other modules to generate form markup.
 *
 * This is most likely a synchronous call, but has been written asynch just
 * in case a module author wants to make an asynch version (for some reason!).
 *
 */

function Form() {

  // TODO - tagStyle should also affect whether attributes can be minimised ('selected' vs. 'selected="selected"')
  this.tagStyle = "html";
  this.tagClose = this.tagStyle == "html" ? '>' : ' />';

  // TODO (i18n)
  // monthNames is used for date inputs
  this.monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

}

/**
 * Form Renderer
 *
 * @param item : the json object representing the form
 * @param next : Callback when done, pass markup as return val.
 */
Form.prototype.render = function(item, values, next) {

  // Refresh the reference, as it is initially loaded at startup
  calipso = require('./calipso');

  next(
    this.start_form(item) +
    this.render_sections(item.sections, values) +
    this.render_fields(item.fields, values) +
    this.render_buttons(item.buttons) +
    this.end_form(item)
  );

};

/**
 * Start the form, create basic form tag wrapper
 * @param form
 * @returns {String}
 */
Form.prototype.start_form = function(form) {
  return (
    '<form id="' + form.id + '" name="' + form.id + '"' + (form.cls ? ' class="' + form.cls + '"' : "") +
    ' method="' + form.method + '"' + ' enctype="multipart/form-data"' + ' action="' + form.action + '">' +
    '<header class="form-header">' +
    '<h2>' + form.title + '</h2>' +
    '</header>' +
    '<div class="form-container">' +
    (form.tabs ? form_tabs(form.sections) : '') +
    '<ul class="form-fields">'
  );
};

/**
 * Close the form
 * @param form
 * @returns {String}
 */
Form.prototype.end_form = function(form) {
  return '</ul></div></form>';
};


/**
 * Deal with form tabs in jQuery UI style
 */
Form.prototype.form_tabs = function(sections) {

  if(!sections)
    return '';

  var tabOutput = '<ul>';

  sections.forEach( function(section) {
    tabOutput += '<li><a href="#' + section.id + '">' + section.label + '</a></li>';
  });
  return tabOutput + '</ul>';

};

/**
 * Render sections
 */
Form.prototype.render_sections = function(sections,values) {


  var self = this;
  
  if(!sections)
    return '';

  var sectionOutput = '';

  sections.forEach( function(section) {
    sectionOutput += (
      '<div class="section" id="' + section.id + '">' +
      '<section><h3>' + section.label + '</h3></section>' +
      self.render_fields(section.fields, values) +
      '</div>'
    );
  });
  return sectionOutput;

};

/**
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
Form.prototype.render_fields = function(fields, values) {

  if(!fields)
    return '';

  var self = this;
  var fieldOutput = '';
  
  fields.forEach( function(field) {
    
    var value = '';
    
    // Assume the field is in the form "object.field"
    
    var objectName = field.name.split('[')[0];
    
    if(field.name.split('[').length > 1) {
      
      var fieldName = field.name.split('[')[1].replace(']', '');
      
      // Check to see if it looks valid
      if(!objectName || !fieldName) {
        calipso.error('Field name incorrect: ' + field.name);
        value = '';
      } else {
        if(values && values[objectName] && values[objectName][fieldName]) {
          value = values[objectName][fieldName];
        }
      }
      
    } else {
      
      if(values && values[objectName]) {
        value = values[objectName];
      }
      
    }
    
    fieldOutput += self.render_field(field, value);

  });
  return fieldOutput;
};

/**
 * Render the buttons on a form
 * @param buttons
 * @returns {String}
 */
Form.prototype.render_buttons= function(buttons) {
  
  var self = this;
  var buttonsOutput = '<li class="buttons"><div class="form-element">';
  
  buttons.forEach( function(button) {
    buttonsOutput += self.render_button(button);
  });
  buttonsOutput += '</div></li>';
  
  return buttonsOutput;
};

/**
 * Render a single button
 * @param button
 * @returns
 */
Form.prototype.render_button = function(button) {

  // Use the same tag renderer for simplicity
  return this.render_tag(button);

};

/**
 * Render a single field
 * @param field
 * @returns {String}
 */
Form.prototype.render_field = function(field, value) {
  
  return field.label || field.label.length > 0 ? (
    '<li class="form-field" id="' + field.name.replace('[','_').replace(']','') + '">' +
    '<div class="form-element">' +
    '<label for="">' + field.label + '</label>' +
    this.render_tag(field,value) +
    '</div>' +
    (field.instruct ? '<p class="instruct">' + field.instruct + '</p>' : '') +
    '</li>'
  ) : this.render_tag(field, value);
};

/**
 * Render each tag
 * @param field
 * @returns {String}
 */
Form.prototype.render_tag = function(field, value) {
  
  var tagOutput = '';
  
  // Look for the field type function
  var defaultFunction = this.render_tag_default;
  var fieldFunction = "render_tag_" + field.type.toLowerCase();
  
  if(typeof this[fieldFunction] === "function") {
    tagOutput = this[fieldFunction](field, value);
  } else {
    tagoutput = defaultFunction(field, value);
  }
  
  return tagOutput;
  
};

/**
 * Functions for each tag type, these are now exposed directly on the object
 * so that they can be redefined within modules (e.g. in a module that provides
 * a rich text editor), or a module can add new types specific to that module.
 *
 */

// DEFAULT
Form.prototype.render_tag_default = function(field, value) {
  return this.render_tag_text(field, value);
}

// TEXT
Form.prototype.render_tag_text = function(field, value) {
  return '<input type="text"'
  + ' class="text ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + (field.readonly ? ' readonly' : '')
  + this.tagClose;
};


// TEXTAREA
Form.prototype.render_tag_textarea = function(field, value) {
  return '<textarea'
  + ' class="textarea ' + (field.cls ? field.cls : "") + '"'
  + ' rows="' + (field.rows ? field.rows : "10") + '"'
  + ' name="' + field.name + '"'
  + '>'
  + value
  + '</textarea>';
};

// HIDDEN
Form.prototype.render_tag_hidden = function(field, value) {
  return '<input type="hidden"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

// SELECT
Form.prototype.render_tag_select = function(field, value) {

  var tagOutput =  '<select'
  + ' class="select ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + '>';

  var options = typeof field.options === 'function' ? field.options() : field.options;

  options.forEach( function(option) {
    tagOutput += '<option'
    + (value === option ? ' selected' :'')
    + '>'
    + option
    + '</option>'
  });
  
  tagOutput += '</select>';

  return tagOutput;

};

// SUBMIT
Form.prototype.render_tag_submit = function(field, value) {
  return '<input type="submit"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' value="' + field.value + '"'
  + this.tagClose;
};

// BUTTON
Form.prototype.render_tag_button = function(field, value) {
  return '<input type="button"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' value="' + field.value + '"'
  + (field.link ? ' onclick="window.location=\'' + field.link + '\'"' : '')
  + this.tagClose;
};

// DATE
Form.prototype.render_tag_date = function(field, value) {

  if(!value) {
    value = new Date(1900, 0, 1);
  }

  // TODO
  var tagOutput = '<input class="date" name="' + field.name + '[day]"'
  + ' value="' + value.getDate() + '"'
  + this.tagClose;

  tagOutput += '<select class="date" name="' + field.name + '[month]">';
  for(var monthNameCounter=0; monthNameCounter<12; monthNameCounter++) {
    tagOutput += '<option value="0"' + (value.getMonth() === monthNameCounter ? ' selected' : '') + '>' + this.monthNames[monthNameCounter] + '</option>';
  }
  tagOutput += '</select>';

  tagOutput += '<input class="date" name="' + field.name + '[year]"'
  + ' value="' + value.getFullYear() + '"'
  + this.tagClose;

  return tagOutput;

};

// TIME
Form.prototype.render_tag_time = function(field, value) {

  // TODO
  if(!value) {
    value = new Date(1900, 0, 1);
  }

  var tagOutput = '<input class="time" name="' + field.name + '[hours]"'
  + ' value="' + value.getHours() + '"'
  + this.tagClose;

  tagOutput += '<input class="time" name="' + field.name + '[minutes]"'
  + ' value="' + value.getMinutes() + '"'
  + this.tagClose;

  return tagOutput;

};

// DATETIME
Form.prototype.render_tag_datetime = function(field, value) {

  // Call both types
  return (
    this.render_tag({
      name: field.name,
      type: "date"
    }, value) +
    '&nbsp;' +
    this.render_tag({
      name: field.name,
      type: "time"
    }, value)
  );

};

// CRONTIME
Form.prototype.render_tag_crontime = function(field, value) {
  var tagOutput = '';
  var cronTimeValues = value ? value.split(/\s/) : ['*','*','*','*','*','*'];
  for(var cronTimeInputCounter = 0; cronTimeInputCounter < 6; cronTimeInputCounter++) {
    tagOutput += (
      '<input type="text" class="text crontime" value="' +
      cronTimeValues[cronTimeInputCounter] +
      '" name="job[cronTime'+cronTimeInputCounter+']"' +
      this.tagClose
    );
  }
  return tagOutput;
};

// PASSWORD
Form.prototype.render_tag_password = function(field, value) {
  return '<input type="password"'
  + ' class="text ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

/**
 * Process Form
 */
Form.prototype.process = function(req, next) {
  
  if (req.form) {
    
    req.form.complete( function(err, fields, files) {
      if(fields) {
        
        var output = {};
        for(var field in fields) {
          var fo = qs.parse(field + '=' + fields[field]);
          copyProperties(fo, output);
        }
        
        replaceDates(output);
        next(output);
        
      } else {
        
        next();
        
      }
    });
  } else {
    
    next();
    
  }
};

/**
 * Export an instance of our form object
 */
exports.Form = new Form();

/**
 * Recursive copy of object
 * @param from
 * @param to
 */
function copyProperties(from, to) {
  
  if(typeof from === 'object') {
    
    var props = Object.getOwnPropertyNames(from);
    props.forEach( function(name) {
      
      /**
       * Else just copy over the property as is
       */
      if (name in to) {
        copyProperties(from[name], to[name]);
      } else {
        var destination = Object.getOwnPropertyDescriptor(from, name);
        Object.defineProperty(to, name, destination);
      }
      
    });
  }

}

/**
 * Now, quick scan to replace any date structures
 * with actual dates
 */
function replaceDates(output) {
  
  for(var object in output) {
    
    for(var field in output[object]) {
      
      if(output[object][field].year || output[object][field].hours) {
        
        var dateobj = output[object][field];
        
        var dateValue = new Date(
        (dateobj.year ? dateobj.year : 1900),
        (dateobj.month ? dateobj.month : 1),
        (dateobj.day ? dateobj.day : 1),
        (dateobj.hours ? dateobj.hours : 0),
        (dateobj.minutes ? dateobj.minutes : 0),
        (dateobj.seconds ? dateobj.seconds : 0));
        
        delete output[object][field]; // why delete what is about to be overwritten?
        output[object][field] = dateValue;
        
      }
      
    }
    
  }

}