/*!
 * Calipso Form Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Core form generation module.
 *
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

var calipso = require('lib/calipso'),
    qs = require('qs'),
    merge = require('connect').utils.merge;

// Global variable (in this context) for translation function
var t;

/**
 * The default calipso form object, with default configuration values.
 * Constructor
 */
function CalipsoForm() {

  // TODO - tagStyle should also affect whether attributes can be minimised ('selected' vs. 'selected="selected"')

  // tagStyle should be one of [html, xhtml, xml]
  this.tagStyle = "html";

  // adjust the way tags are closed based on the given tagStyle.
  this.tagClose = this.tagStyle == "html" ? '>' : ' />';

  // cheap way of ensuring unique radio ids
  this.radioCount = 0;

}

/**
 * Export an instance of our form object
 */
exports.CalipsoForm = new CalipsoForm();

/**
 * Form Renderer, controls the overall creation of the form based on a form json object passed
 * in as the first parameter.  The structure of this object is as follows:
 *
 *     form
 *        id : Unique ID that will become the form ID.
 *        title : Title to show at the top of the form.
 *        type : Type of form (not used at present).
 *        method: HTTP method to use.
 *        action : URL to submit form to.
 *        tabs : Should tabs be rendered for sections (default false).
 *      sections [*] : Optional - divide the form into sections.
 *        id  : Unique identifier for a section.
 *        label : Description of section (appears as header or tab label)
 *        fields [*] : Array of fields in the section (see below).
 *      fields [*] : Form fields array - can be in form or section.
 *        label : Label for form field.
 *        name : Name of form element to be passed back with the value.
 *        type : Type of element, based on the form functions defined below.
 *        description : Description text to be rendered after the element in a div tag.
 *      buttons [*] : Array of buttons to be rendered at the bottom of the form.
 *        name : Name of button (for submission).
 *        type : Type of button.
 *        value : Value to submit when pressed.
 *
 * A complete example is shown below:
 *
 *      var myForm = {id:'my-form',title:'Create My Thing...',type:'form',method:'POST',action:'/myaction',tabs:false,
 *          sections:[{
 *            id:'myform-section-1',
 *            label:'Section 1',
 *            fields:[
 *                    {label:'Field A',name:'object[fieldA]',type:'text',description:'Description ... '},
 *                    {label:'Field B',name:'object[fieldB]',type:'textarea',description:'Description ...'}
 *                   ]
 *          },{
 *            id:'myform-section2',
 *            label:'Section 2',
 *            fields:[
 *                    {label:'Select Field',name:'object[select]',type:'select',options:["option 1","option 2"],description:'Description...'},
 *                    {label:'Date Field',name:'object[date]',type:'datetime',description:'Description...'},
 *                   ]
 *          }
 *          ],
 *          fields:[
 *            {label:'',name:'hiddenField',type:'hidden'}
 *          ],
 *          buttons:[
 *               {name:'submit',type:'submit',value:'Save'}
 *          ]};
 *
 * The values of the form are passed through (optionally) as the second parameter.  This allows you to re-use
 * a form definition across different uses (e.g. CRU).
 *
 * @param item : the json object representing the form
 * @param values : The values to initialise the form with.
 * @param next : Callback when done, pass markup as return val.
 */
CalipsoForm.prototype.render = function(item, values, req, next) {

  // Refresh the reference, as it is initially loaded at startup
  calipso = require('./calipso');

  // Store local reference to the request for use during translation
  t = req.t;

  next(
    this.start_form(item) +
    this.render_sections(item, values) +
    this.render_fields(item.fields, values) +
    this.render_buttons(item.buttons) +
    this.end_form(item)
  );

};

/**
 * Deal with form tabs in jQuery UI style if required.
 */
CalipsoForm.prototype.formTabs = function(sections) {

  if(!sections)
    return '';

  var tabOutput = '<nav><ul class="tabs">',
    numSections = sections.length;
  sections.forEach( function(section, index) {
    console.log('tags section: ', section)
    console.log("args: ", arguments)
    console.log('numSections: ', numSections)
    var classes = 'form-tab';
    if (index === 0) { 
      classes += ' first';
    }
    if ((index + 1) === numSections) {
      classes += ' last';
    }
    tabOutput += '<li class="' + classes + '"><a href="#' + section.id + '">' + t(section.label) + '</a></li>';
  });
  return tabOutput + '</ul></nav>';

};


/**
 * Render the initial form tag
 *
 * @param form
 * @returns {String}
 */
CalipsoForm.prototype.start_form = function(form) {
  return (
    '<form id="' + form.id + '" name="' + form.id + '"' + (form.cls ? ' class="' + form.cls + '"' : "") +
    ' method="' + form.method + '"' + ' enctype="' + (form.enctype ? form.enctype : "multipart/form-data") + '"' + ' action="' + form.action + '">' +
    '<header class="form-header">' +
    '<h2>' + t(form.title) + '</h2>' +
    '</header>' +
    '<div class="form-container">' +
    (form.tabs ? this.formTabs(form.sections) : '') +
    '<div class="form-fields'+(form.tabs ? ' tab-container' : '')+'">'
  );
};

/**
 * Close the form
 * @param form
 * @returns {String}
 */
CalipsoForm.prototype.end_form = function(form) {
  return '</div></div></form>';
};




/**
 * Render the form sections, iterating through and then rendering
 * each of the fields within a section.
 */
CalipsoForm.prototype.render_sections = function(form, values) {

  var self = this;
  var sections = form.sections;

  if(!sections)
    return '';

  var sectionOutput = '';

  sections.forEach( function(section) {
    sectionOutput += (
      '<section' + (form.tabs?' class="tab-content"':'') + ' id="' + section.id + '">' +
      '<h3>' + t(section.label) + '</h3>' +
      self.render_fields(section.fields, values) +
      '</section>'
    );
  });
  return sectionOutput;

};

/**
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
CalipsoForm.prototype.render_fields = function(fields, values) {

  if(!fields)
    return '';

  var self = this;
  var fieldOutput = '';

  fields.forEach( function(field) {

    var value = '';

    // Assume the field is in the form "object.field"

    var objectName = field.name && field.name.split('[')[0] || '';

    if(!field.noValue) { // We set this field to a value
    
      if(field.name && field.name.split('[').length > 1) {
  
        var fieldName = field.name.split('[')[1].replace(']', '');
  
        // Check to see if it looks valid
        if(!objectName || !fieldName) {
          calipso.error('Field name incorrect: ' + field.name);
          value = '';
        } else {
  
          if(values && values[objectName]) {
            if(values[objectName][fieldName]) {
              value = values[objectName][fieldName];
            } else {
              try {
                // Use get to get dynamic schema elements (e.g. fields)
                value = values[objectName].get(fieldName);                
              } catch(ex) {
                // Do nothing, leave value blank
              }
              if(value === undefined)               
                value = '';
            }
          }
        }
  
      } else {
        if(values && values[objectName]) {
          value = values[objectName];
        }
      }
      
    } else {
      // Do not set the value 
    }    

    fieldOutput += self.render_field(field, value);

  });



  return fieldOutput;
};

/**
 * Render a single field
 * @param field
 * @returns {String}
 */
CalipsoForm.prototype.render_field = function(field, value) {

  var self = this;

  if(field instanceof Array){ // faster?: Object.prototype.toString.call(field) === '[object Array]'
    var subfieldsHTML = '';
    field.forEach(function(subfield){
      subfieldsHTML += self.render_field(subfield, value);
    });
    return '<div class="field-group">' + subfieldsHTML + '</div>';
  }

  if(field.type == 'fieldset'){
    return self.render_tag_fieldset(field, value);
  }

  var isCheckable = !field.labelFirst && (field.type == "checkbox" || field.type == "radio");
  var tagHTML = this.render_tag(field, value);
  var labelHTML = (
    '<label' + (isCheckable ? ' class="for-checkable"' : '')
    + ' for="' + field.name + (field.type == 'radio' ? this.radioCount : '')
    + '">' + t(field.label) + (isCheckable?'':':') + '</label>'
  );
  //console.log(labelHTML);
  var wrapperId = (
    field.name.replace('[','_').replace(']','')
    + (field.type == 'radio' ? '-radio' + this.radioCount : '')
  );

  return field.label || field.label.length > 0 ? (
    '<div class="form-item field-type-' + field.type + '" id="' + wrapperId + '-wrapper">' +
    '<div class="form-field">' +
      // put checkboxes and radios ("checkables") before their labels
      (isCheckable ? tagHTML : labelHTML) +
      (isCheckable ? labelHTML : tagHTML) +
    '</div>' +
    (field.description ? '<div class="description ' + field.type + '-description">' + t(field.description) + '</div>' : '') +
    '</div>'
  ) : tagHTML;

};

/**
 * Render each tag
 * @param field
 * @returns {String}
 */
CalipsoForm.prototype.render_tag = function(field, value) {

  var tagOutput = '';

  // Look for the field type function
  var fieldFunctionName = "render_tag_" + field.type.toLowerCase();

  if(typeof this[fieldFunctionName] === "function") {
    tagOutput = this[fieldFunctionName](field, value);
  } else {
    tagOutput = this.render_tag_default(field, value);
  }

  return tagOutput;

};

/**
 * Functions for each tag type, these are now exposed directly on the object
 * so that they can be redefined within modules (e.g. in a module that provides
 * a rich text editor), or a module can add new types specific to that module.
 *
 * Current field types available are:
 *
 *      text : default text field (used if no function matches field type)
 *      textarea : default textarea, can set rows in form definition to control rows in a textarea field item.
 *      hidden : hidden field
 *      select : single select box, requires values to be set (as array or function)
 *      submit : submit button
 *      button : general button
 *      date : date input control (very rudimentary)
 *      time : time input controls
 *      datetime : combination of date and time controls
 *      crontime : crontime editor (6 small text boxes)
 *      password : password field
 *      checkbox : checkbox field
 *      radio : radio button
 *      file : file field
 *
**/

/**
 * Fieldset
 */
CalipsoForm.prototype.render_tag_fieldset = function(field, value) {
  return (
    '<fieldset'+(field.cls?' class="'+field.cls+'"':'')+'>'
    + (field.legend ? '<legend>' + field.legend + '</legend>' : '')
    + '<div class="fieldset-fields">'
    + this.render_fields(field.fields, value)
    + '</div></fieldset>'
  );
};


/**
 * Default (if no function matches the tag)
 */
CalipsoForm.prototype.render_tag_default = function(field, value) {
  return this.render_tag_text(field, value);
};


/**
 * TEXT tag
 */
CalipsoForm.prototype.render_tag_text = function(field, value) {

  return '<input type="' + field.type + '"'
  + ' class="'+ field.type + (field.cls ? ' ' + field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + (value || field.value || '') + '"'
  + (field.readonly ? ' readonly' : '')
  + this.tagClose;

};


/**
 * Textarea tag
 */
CalipsoForm.prototype.render_tag_textarea = function(field, value) {
  return '<textarea'
  + ' class="textarea ' + (field.cls ? field.cls : "") + '"'
  + ' rows="' + (field.rows ? field.rows : "10") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + '>'
  + value
  + '</textarea>';
};

/**
 * Hidden tag
 * potential todo: allow hidden inputs to have id, classname.
 */
CalipsoForm.prototype.render_tag_hidden = function(field, value) {
  return '<input type="hidden"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

/**
 * Select tag
 */
CalipsoForm.prototype.render_tag_select = function(field, value) {

  // TODO: Allow displayed text to be different from the option values
  // TODO: Support optgroups
  // potential todo: allow each option to have a classname.
  //console.log('value = ' + value);
  //console.log('field = %o', field);
  var tagOutput =  '<select'
  + ' class="select ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' ' + (field.multiple ? 'multiple="multiple"' : '')
  + '>';

  var options = typeof field.options === 'function' ? field.options() : field.options;

  if(field.optgroups){
    field.optgroups.forEach(function(optgroup){
      tagOutput += '<optgroup label="' + optgroup.label + '">';
      optgroup.options.forEach(render_option);
      tagOutput += '</optgroup>';
    });
  } else {
    options.forEach(render_option);
  }
  tagOutput += '</select>';

  return tagOutput;

  function render_option(option) {
    var isSimple = typeof option === "string" || typeof option === "number";
    var displayText = isSimple ? option : option.label;
    var optionValue = isSimple ? option : option.value;

    tagOutput += '<option'
    + ' value="' + optionValue + '"'
    + (value === optionValue ? ' selected' :'')
    + '>'
    + displayText
    + '</option>';
  }

};

/**
 * Date
 */
CalipsoForm.prototype.render_tag_date = function(field, value) {

  if(!value) {
    value = new Date(1900, 0, 1);
  }

  // TODO - use users Locale
  var monthNames = calipso.date.regional[''].monthNamesShort;

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
      + monthNames[monthNameCounter]
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

/**
 * Time
 */
CalipsoForm.prototype.render_tag_time = function(field, value) {

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

/**
 * Date Time
 */
CalipsoForm.prototype.render_tag_datetime = function(field, value) {

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

/**
 * Cron Time
 */
CalipsoForm.prototype.render_tag_crontime = function(field, value) {
  var tagOutput = '';
  var cronTimeValues = value ? value.split(/\s/) : ['*','*','*','*','*','*'];
  for(var cronTimeInputCounter = 0; cronTimeInputCounter < 6; cronTimeInputCounter++) {
    tagOutput += (
      '<input type="text" class="text crontime" value="' +
      cronTimeValues[cronTimeInputCounter] +
      '" name="job[cronTime' + cronTimeInputCounter + ']"' +
      this.tagClose
    );
  }
  return tagOutput;
};

/**
 * Password
 */
CalipsoForm.prototype.render_tag_password = function(field, value) {
  return '<input type="password"'
  + ' class="text password ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

/**
 * Checkbox
 */
CalipsoForm.prototype.render_tag_checkbox = function(field, value) {
  //console.log(this);
  return '<input type="checkbox"'
  + ' class="checkbox'+(field.labelFirst?'"':' checkable"') + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + (field.value ? ' value="' + field.value + '"' : '')
  + (field.checked ? ' checked' : '')
  + (field.value == value && value != false ? ' checked' : '')
  + (field.readonly ? ' disabled="disabled"' : '')
  + this.tagClose
  + (field.readonly ? '<input type="hidden" name="' + field.name + '" value="' + (field.checked ? 'on' : 'off') + '" />' : ''); // Hidden field with value
};

/**
 * Radio
 */
CalipsoForm.prototype.render_tag_radio = function(field, value) {
  //console.log(this);
  return '<input type="radio"'
  + ' class="radio'+(field.labelFirst?'"':' checkable"') + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + (++this.radioCount) + '"'
  + ' value="' + field.value + '"'
  + (field.value == value ? ' checked' : '')
  + this.tagClose;
};

/**
 * File
 */
CalipsoForm.prototype.render_tag_file = function(field, value) {
  //console.log(this);
  return '<input type="file"'
  + ' class="file ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + (value || field.value) + '"'
  + this.tagClose;
};

/**
 * Render the buttons on a form
 * @param buttons
 * @returns {String}
 */
CalipsoForm.prototype.render_buttons= function(buttons) {

  var self = this;
  var buttonsOutput = '<div class="actions">';

  buttons.forEach( function(button) {
    buttonsOutput += self.render_button(button);
  });
  buttonsOutput += '</div>';

  return buttonsOutput;
};

/**
 * Render a single button
 * @param button
 * @returns
 */
CalipsoForm.prototype.render_button = function(button) {

  // Use the same tag renderer for simplicity
  return this.render_tag(button);

};

/**
 * Submit button
 */
CalipsoForm.prototype.render_tag_submit = function(field, value) {
  return '<input type="submit"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + t(field.value) + '"'
  + this.tagClose;
};

/**
 * Reset button
 */
CalipsoForm.prototype.render_tag_reset = function(field, value) {
  return '<input type="reset"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + t(field.value) + '"'
  + this.tagClose;
};

/**
 * General button
 */
CalipsoForm.prototype.render_tag_button = function(field, value) {
  return '<input type="button"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' id="' + field.name + '"'
  + ' value="' + t(field.value) + '"'
  + (field.link ? ' onclick="window.location=\'' + field.link + '\'"' : '')
  + this.tagClose;
};



/**
 * Process the values submitted by a form and return a JSON
 * object representation (makes it simpler to then process a form submission
 * from within a module.
 */
CalipsoForm.prototype.process = function(req, next) {

  // Form already processed
  // Fix until all modules refactored to use formData
  if(req.formData) {
    next(req.formData);
    return;
  }
  
  // Process form
  if (req.form) {

    req.form.complete( function(err, fields, files) {

      if(fields) {

        var output = {};

        for(var field in fields) {
          var fo = qs.parse(field + '=' + encodeURIComponent(fields[field]));
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
 * Process a field / section array from a contentType
 * And modify the form
 */
CalipsoForm.prototype.processFields = function(form,fields) {

  // Process fields
  if(fields.fields) {
    processFieldArray(form,fields.fields);
  }

  if(fields.sections) {
    fields.sections.forEach(function(section,key) {
      // Process fields
      if(section.label) {
        form.sections.push(section);
      }
      // Remove it
      if(section.hide) {
        form = removeSection(form,section.id);
      }
    });
  }

  return form;

}

// Helper function to process fields
function processFieldArray(form, fields) {

  fields.forEach(function(field, key) {
    // Add it
    if(field.type) {
      form.fields.push(field);
    }
    // Remove it
    if(field.hide) {
      form = removeField(form, field.name);
    }
  });

}

/**
 * Remove a field from a form (any section)
 */
function removeField(form, fieldName) {

  // Scan sections
  form.sections.forEach(function(section, key) {
    scanFields(section.fields, fieldName);
  });

  // Form fields
  scanFields(form.fields, fieldName);

  return form;

}

// Helper function for removeField
function scanFields(fieldArray, fieldName) {
  fieldArray.forEach(function(field, key) {
    if(field.name === fieldName) {
      fieldArray = fieldArray.splice(key, 1);
    }
  });
}

/**
 * Remove a section from a form
 */
function removeSection(form, sectionId) {

  // Scan sections
  form.sections.forEach(function(section,key) {
    if(section.id === sectionId) {
      form.sections.splice(key,1);
    }
  });

  return form;

}

/**
 * Simple object mapper, used to copy over form values to schemas
 */
CalipsoForm.prototype.mapFields = function(fields,record) {
  
  var props = Object.getOwnPropertyNames(fields);
  props.forEach( function(name) {              
    // If not private (e.g. _id), then copy
    if(!name.match(/^_.*/)) {
       record.set(name, fields[name]);
    }
  });
  
}

/**
 * Recursive copy of object
 * @param from
 * @param to
 */
function copyProperties(from, to) {
  
  if(typeof from === 'object') {

    var props = Object.getOwnPropertyNames(from);
    props.forEach( function(name) {
      
      // Else just copy over the property as is       
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
 * Quick scan to replace any date structures
 * with actual dates so that each module doesn't need to.
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
function replaceDates(output) {

  for(var sectionName in output) {

    for(var fieldName in output[sectionName]) {

      var field = output[sectionName][fieldName];

      // Full object year,month,day,hours,minutes
      if(field.hasOwnProperty('year') && field.hasOwnProperty('hours')) {

        output[sectionName][fieldName] = new Date(
          (field.year || 1900),
          (field.month || 1),
          (field.day || 1),
          (field.hours || 0),
          (field.minutes || 0),
          (field.seconds || 0)
        );

      }

      if(field.hasOwnProperty('date') && field.hasOwnProperty('hours')) {

        // TODO - LOCALE!
        output[sectionName][fieldName] = new Date(
          field.date + " " + field.hours + ":" + field.minutes + ":00"
        );

      }

      // Date entry
      if(field.hasOwnProperty('date') && field.hasOwnProperty('time')) {


        // TODO - LOCALE!
        output[sectionName][fieldName] = new Date(
          field.date + " " + field.time
        );

      }

    }

  }

}