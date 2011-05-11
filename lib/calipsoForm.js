/**
 * Core form generation module (default form rendering library).
 * This is loaded by calipso as a plugin, so can be replaced by modules.
 * Module must expose a single object as below, with a single
 * function that is called by other modules to generate form markup.
 *
 * This is most likely a synchronous call, but has been written asynch just
 * in case a module author wants to make an asynch version (for some reason!).
 *
 * TODO: validation, redisplay of submitted values
 * 
 */

/* example usage:
  
  var form = {
    id:'login-form',cls:'login',title:'Login',type:'form',method:'POST',action:'/user/login',
    fields:[
      {label:'Username', name:'user[username]', type:'text'},
      {label:'Password', name:'user[password]', type:'password'}
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Login'},
      {name:'register', type:'button', link:'/user/register', value:'Register'}
    ]
  };

*/

var sys = require('sys'),
calipso = require('./calipso'),
qs = require('qs'),
merge = require('connect').utils.merge;


/*
 * Constructor
 */
function Form() {
  
  // TODO - tagStyle should also affect whether attributes can be minimised ('selected' vs. 'selected="selected"')
  
  // tagStyle should be one of [html, xhtml, xml]
  this.tagStyle = "html";
  
  // adjust the way tags are closed based on the given tagStyle.
  this.tagClose = this.tagStyle == "html" ? '>' : ' />';
  
  // cheap way of ensuring unique radio ids
  this.radioCount = 0;

  // TODO (i18n)
  // monthNames is used for date inputs
  this.monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

};

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
Form.prototype.render_sections = function(sections, values) {


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
  
  var labelHTML = '<label for="' + field.name + '">' + field.label + '</label>';
  var tagHTML = this.render_tag(field, value);
  var isCheckable = field.type == "checkbox" || field.type == "radio";
  
  return field.label || field.label.length > 0 ? (
    '<li class="form-field" id="' + field.name.replace('[','_').replace(']','') + (field.type == 'radio' ? this.radioCount + 1 : '') + '">' +
    '<div class="form-element">' +
    (isCheckable ? tagHTML : labelHTML) +
    (isCheckable ? labelHTML : tagHTML) +
    '</div>' +
    (field.instruct ? '<p class="instruct">' + field.instruct + '</p>' : '') +
    '</li>'
  ) : tagHTML;
  
};

/**
 * Render each tag
 * @param field
 * @returns {String}
 */
Form.prototype.render_tag = function(field, value) {
  
  var tagOutput = '';
  
  // Look for the field type function
  var fieldFunctionName = "render_tag_" + field.type.toLowerCase();
  
  if(typeof this[fieldFunctionName] === "function") {
    tagOutput = this[fieldFunctionName](field, value);
  } else {
    tagoutput = this.render_tag_default(field, value);
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
};

// TEXT
Form.prototype.render_tag_text = function(field, value) {
  return '<input type="' + field.type + '"'
  + ' class="text ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
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
  + ' id="' + field.name + '"'
  + '>'
  + value
  + '</textarea>';
};

// HIDDEN
// potential todo: allow hidden inputs to have id, classname.
Form.prototype.render_tag_hidden = function(field, value) {
  return '<input type="hidden"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

// SELECT
// TODO: Allow displayed text to be different from the option values
// TODO: Support optgroups
// potential todo: allow each option to have a classname.
Form.prototype.render_tag_select = function(field, value) {

  var tagOutput =  '<select'
  + ' class="select ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + '>';

  var options = typeof field.options === 'function' ? field.options() : field.options;
  
  options.forEach( function(optionValue) {
    tagOutput += '<option'
    + (value === optionValue ? ' selected' :'')
    + '>'
    + optionValue
    + '</option>';
  });
  
  tagOutput += '</select>';

  return tagOutput;

};

// SUBMIT
Form.prototype.render_tag_submit = function(field, value) {
  return '<input type="submit"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + field.value + '"'
  + this.tagClose;
};

// BUTTON
Form.prototype.render_tag_button = function(field, value) {
  return '<input type="button"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
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
  var tagOutput = '<input type="text"'
  + ' class="date date-day' + (field.cls ? ' date-day-'+field.cls : '') + '"'
  + ' name="' + field.name + '[day]"'
  + ' value="' + value.getDate() + '"'
  + this.tagClose;

  tagOutput += ' ';

  tagOutput += '<select class="date date-month' + (field.cls ? ' date-month-'+field.cls : '') + '"'
  + ' name="' + field.name + '[month]">';
  for(var monthNameCounter=0; monthNameCounter<12; monthNameCounter++) {
    tagOutput += (
      '<option value="0"' + (value.getMonth() === monthNameCounter ? ' selected' : '') + '>'
      + this.monthNames[monthNameCounter]
      + '</option>'
    );
  }
  tagOutput += '</select>';

  tagOutput += ' ';

  tagOutput += '<input type="text"'
  + ' class="date date-year' + (field.cls ? ' date-year-'+field.cls : '') + '"'
  + ' name="' + field.name + '[year]"'
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

  var tagOutput = '<input class="time time-hours' + (field.cls ? ' time-hours-'+field.cls : '') + '"'
  + ' name="' + field.name + '[hours]"'
  + ' value="' + value.getHours() + '"'
  + this.tagClose;

  tagOutput += ' ';

  tagOutput += '<input class="time time-minutes' + (field.cls ? ' time-minutes-'+field.cls : '') + '"'
  + ' name="' + field.name + '[minutes]"'
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
    ' ' +
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
  + ' class="text password ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

// CHECKBOX
Form.prototype.render_tag_checkbox = function(field, value) {
  return '<input type="checkbox"'
  + ' class="checkable checkbox ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

// RADIO
Form.prototype.render_tag_radio = function(field, value) {
  //console.log(this);
  return '<input type="radio"'
  + ' class="checkable radio ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + (++this.radioCount) + '"'
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
        
        console.log(sys.inspect(output, true, 5, true));
        
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

  /**
   * TODO - this all needs to be locale driven.
   * 
   *  This allows for dates to come back in a combination of forms:
   * 
   * 1; All as properties {year,month,day,hours,minutes}
   * 2; Date with time as properties {date,hours,minutes} 
   * 3; Date & time as properties {date,time}
   * 
   * If none of the above (e.g. it is a full date time string), then it just goes
   * straight to mongoose and gets dealt with there.
   */
  

  for(var sectionName in output) {
    
    for(var fieldName in output[sectionName]) {
      
      var field = output[sectionName][fieldName];
      
      // Full object year,month,day,hours,minutes
      if(field.year || field.hours) {
        
        output[sectionName][fieldName] = new Date(
          (field.year || 1900),
          (field.month || 1),
          (field.day || 1),
          (field.hours || 0),
          (field.minutes || 0),
          (field.seconds || 0)
        );
        
      }
      
      // Partial object date,hours,minutes
      if(field.date && field.hours) {
        
        // TODO - LOCALE!
        output[sectionName][fieldName] = new Date(
          field.date + " " + field.hours + ":" + field.minutes + ":00"
        );
        
      }
      
      // Date entry
      if(field.date && field.time) {
        
        // TODO - LOCALE!
        output[sectionName][fieldName] = new Date(
          field.date + " " + field.time
        );
        
      }
      
    }
    
  }

}