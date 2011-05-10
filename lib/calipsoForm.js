
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

var calipso = require('./calipso'),
    qs = require('qs'),
    merge = require('connect').utils.merge;


/**
 * The default calipso form object, with default configuration values.
 */
function CalipsoForm() {

  // TODO - tagStyle should also affect whether attributes can be minimised ('selected' vs. 'selected="selected"')
  this.tagStyle = "html";
  this.tagClose = this.tagStyle == "html" ? '>' : ' />';

}

/**
 * Form Renderer, controls the overall creation of the form based on a form json object passed
 * in as the first parameter.  The structure of this object is as follows:  
 * 
 * form
 *  id : Unique ID that will become the form ID.
 *  title : Title to show at the top of the form.
 *  type : Type of form (not used at present).
 *  method: HTTP method to use.
 *  action : URL to submit form to.
 *  tabs : Should tabs be rendered for sections (default false).
 *  sections [*] : Optional - divide the form into sections.
 *    id  : Unique identifier for a section.
 *    label : Description of section (appears as header or tab label)
 *    fields [*] : Array of fields in the section (see below).
 *  fields [*] : Form fields array - can be in form or section.
 *    label : Label for form field.
 *    name : Name of form element to be passed back with the value.
 *    type : Type of element, based on the form functions defined below.
 *    instruct : Instruction text to be rendered after the element in a p tag.
 *  buttons [*] : Array of buttons to be rendered at the bottom of the form.
 *    name : Name of button (for submission).
 *    type : Type of button.
 *    value : Value to submit when pressed.
 * 
 * A complete example is shown below:
 * 
 * var myForm = {id:'my-form',title:'Create My Thing ...',type:'form',method:'POST',action:'/myaction',tabs:false,
 *          sections:[{
 *            id:'myform-section-1',
 *            label:'Section 1',            
 *            fields:[                                                                                                         
 *                    {label:'Field A',name:'object[fieldA]',type:'text',instruct:'Instructions ... '},
 *                    {label:'Field B',name:'object[fieldB]',type:'textarea',instruct:'Instructions ...'}                                  
 *                   ]  
 *          },{
 *            id:'myform-section2',
 *            label:'Section 2',            
 *            fields:[                                                                                                         
 *                    {label:'Select Field',name:'object[select]',type:'select',options:["option 1","option 2"],instruct:'Instructions ...'},
 *                    {label:'Date Field',name:'object[date]',type:'datetime',instruct:'Instructions ...'},
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
CalipsoForm.prototype.render = function(item, values, next) {

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
 * Render the initial form tag
 * 
 * @param form
 * @returns {String}
 */
CalipsoForm.prototype.start_form = function(form) {
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
CalipsoForm.prototype.end_form = function(form) {
  return '</ul></div></form>';
};


/**
 * Deal with form tabs in jQuery UI style if required.
 */
CalipsoForm.prototype.form_tabs = function(sections) {

  if(!sections)
    return '';

  var tabOutput = '<ul>';

  sections.forEach( function(section) {
    tabOutput += '<li><a href="#' + section.id + '">' + section.label + '</a></li>';
  });
  return tabOutput + '</ul>';

};

/**
 * Render the form sections, iterating through and then rendering 
 * each of the fields within a section.
 */
CalipsoForm.prototype.render_sections = function(sections, values) {


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
CalipsoForm.prototype.render_fields = function(fields, values) {

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
CalipsoForm.prototype.render_buttons= function(buttons) {
  
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
CalipsoForm.prototype.render_button = function(button) {

  // Use the same tag renderer for simplicity
  return this.render_tag(button);

};

/**
 * Render a single field
 * @param field
 * @returns {String}
 */
CalipsoForm.prototype.render_field = function(field, value) {
  
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
CalipsoForm.prototype.render_tag = function(field, value) {
  
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
 * Current field types available are:
 * 
 * text : default text field (used if no function matches field type)
 * textarea : default textarea, can set rows in form definition to control rows in a textarea field item.
 * hidden : hidden field
 * select : single select box, requires values to be set (as array or function)
 * submit : submit button
 * button : general button
 * date : date input control (very rudimentary)
 * time : time input controls
 * datetime : combination of date and time controls
 * crontime : crontime editor (6 small text boxes)
 * password : password field
 * 
 */

/**
 * TEXT tag 
 */
CalipsoForm.prototype.render_tag_text = function(field, value) {
  return '<input type="text"'
  + ' class="text ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
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
  + '>'
  + value
  + '</textarea>';
};

/**
 * Hidden tag
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
    + '</option>';
  });
  
  tagOutput += '</select>';

  return tagOutput;

};

/**
 * Submit button
 */
CalipsoForm.prototype.render_tag_submit = function(field, value) {
  return '<input type="submit"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' value="' + field.value + '"'
  + this.tagClose;
};

/**
 * General button
 */
CalipsoForm.prototype.render_tag_button = function(field, value) {
  return '<input type="button"'
  + (field.cls ? ' class="' + field.cls + '"': "")
  + ' name="' + field.name + '"'
  + ' value="' + field.value + '"'
  + (field.link ? ' onclick="window.location=\'' + field.link + '\'"' : '')
  + this.tagClose;
};

/**
 * Date
 */
CalipsoForm.prototype.render_tag_date = function(field, value) {

  if(!value) {
    value = new Date(1900, 0, 1);
  }

  var tagOutput = '<input class="date" name="' + field.name + '[day]"'
  + ' value="' + value.getDate() + '"'
  + this.tagClose;

  // TODO - use users Locale
  var monthNames = calipso.date.regional[''].monthNamesShort;

  tagOutput += '<select class="date" name="' + field.name + '[month]">';
  for(var monthNameCounter=0; monthNameCounter<12; monthNameCounter++) {
    tagOutput += '<option value="' + monthNameCounter + '"' + (value.getMonth() === monthNameCounter ? ' selected' : '') + '>' + monthNames[monthNameCounter] + '</option>';
  }
  tagOutput += '</select>';

  tagOutput += '<input class="date" name="' + field.name + '[year]"'
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

  var tagOutput = '<input class="time" name="' + field.name + '[hours]"'
  + ' value="' + value.getHours() + '"'
  + this.tagClose;

  tagOutput += '<input class="time" name="' + field.name + '[minutes]"'
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
    '&nbsp;' +
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
      '" name="job[cronTime'+cronTimeInputCounter+']"' +
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
  + ' class="text ' + (field.cls ? field.cls : "") + '"'
  + ' name="' + field.name + '"'
  + ' value="' + value + '"'
  + this.tagClose;
};

/**
 * Default (if no function matches the tag)
 */
CalipsoForm.prototype.render_tag_default = function(field, value) {
  return this.render_tag_text(field, value);
}

/**
 * Process the values submitted by a form and return a JSON
 * object representation (makes it simpler to then process a form submission
 * from within a module.
 */
CalipsoForm.prototype.process = function(req, next) {
  
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
exports.CalipsoForm = new CalipsoForm();

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
 * Quick scan to replace any date structures
 * with actual dates so that each module doesn't need to.
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
   * Straight to mongoose and gets dealt with there.
   */
  

  for(var object in output) {
    
    for(var field in output[object]) {

      var dateobj = output[object][field];
    
      // Full object year,month,day,hours,minutes
      if(output[object][field].hasOwnProperty('year') && output[object][field].hasOwnProperty('hours')) {
        
        var dateValue = new Date(
        (dateobj.year ? dateobj.year : 1900),
        (dateobj.month ? dateobj.month : 1),
        (dateobj.day ? dateobj.day : 1),
        (dateobj.hours ? dateobj.hours : 0),
        (dateobj.minutes ? dateobj.minutes : 0),
        (dateobj.seconds ? dateobj.seconds : 0));

        output[object][field] = dateValue;
        
      }
  
      // Partial object date,hours,minutes
      if(output[object][field].hasOwnProperty('date') && output[object][field].hasOwnProperty('hours')) {
        
        
        var dateValue = new Date(dateobj.date
                               + " " + output[object][field].hours
                               + ":" + output[object][field].minutes
                               + ":00"); // TODO - LOCALE!                                       

        output[object][field] = dateValue;
        
      }
      
      
      // Date entry
      if(output[object][field].hasOwnProperty('date') && output[object][field].hasOwnProperty('time')) {
        
        var dateValue = new Date(dateobj.date
                               + " " + output[object][field].time); // TODO - LOCALE!
                                       
        output[object][field] = dateValue;
        
      }

    }
    
  }

}