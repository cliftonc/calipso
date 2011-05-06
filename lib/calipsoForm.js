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

exports.render = render;

/**
 * Helper to process a multi-part form and convert to object
 */
exports.process = process;


// TODO - tagStyle should also affect whether attributes can be minimised ('selected' vs. 'selected="selected"')
var tagStyle = "html";
var tagClose = tagStyle == "html" ? '>' : ' />';
// TODO (i18n)
// monthNames is used for date inputs
var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


/**
 * Form Renderer
 * 
 * @param item : the json object representing the form
 * @param next : Callback when done, pass markup as return val.
 */
function render(item, values, next) {
  
  // Refresh the reference, as it is initially loaded at startup
  calipso = require('./calipso');
  
  next(
    start_form(item) +
    render_sections(item.sections, values) +
    render_fields(item.fields, values) +
    render_buttons(item.buttons) +
    end_form(item)
  );
  
}

/**
 * Start the form, create basic form tag wrapper
 * @param form
 * @returns {String}
 */
function start_form(form) {
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
}

/**
 * Close the form
 * @param form
 * @returns {String}
 */
function end_form(form) {
  return '</ul></div></form>';
}


function form_tabs(sections) {
  
  if(!sections) return '';
  
  var tabOutput = '<ul>';
  
  sections.forEach(function(section){
    tabOutput += '<li><a href="#' + section.id + '">' + section.label + '</a></li>';
  });
  
  return tabOutput + '</ul>';
  
}

/**
 * Render sections
 */
function render_sections(sections,values) {
  
  if(!sections) return '';
  
  var sectionOutput = '';
  
  sections.forEach(function(section){
    sectionOutput += (
      '<div class="section" id="' + section.id + '">' +
        '<section><h3>' + section.label + '</h3></section>' +
        render_fields(section.fields, values) +
      '</div>'
    );
  });
  
  return sectionOutput;
  
}

/** 
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
function render_fields(fields, values) {
  
  if(!fields) return '';
  
  var fieldOutput = '';
  
  fields.forEach(function(field){
    
    var value = '';
    
    // Assume the field is in the form "object.field"
    
    var objectName = field.name.split('[')[0];
    
    if(field.name.split('[').length > 1) {
      
      var fieldName = field.name.split('[')[1].replace(']', '');
      
      // Check to see if it looks valid
      if(!objectName || !fieldName) {
        console.log('Field name incorrect: ' + field.name);
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
    
    fieldOutput += render_field(field, value);
    
  });
  
  return fieldOutput;
}

/** 
 * Render the buttons on a form
 * @param buttons
 * @returns {String}
 */
function render_buttons(buttons) {
  
  var buttonsOutput = '<li class="buttons"><div class="form-element">';
  
  buttons.forEach(function(button){
    buttonsOutput += render_button(button);
  });
  
  buttonsOutput += '</div></li>';
  
  return buttonsOutput;
}

/**
 * Render a single button
 * @param button
 * @returns
 */
function render_button(button) {
  
  // Use the same tag renderer for simplicity
  return render_tag(button);
  
}

/**
 * Render a single field
 * @param field
 * @returns {String}
 */
function render_field(field, value) {
  
  return field.label || field.label.length > 0 ? (
      '<li class="form-field" id="' + field.name.replace('[','_').replace(']','') + '">' +
        '<div class="form-element">' +
          '<label for="">' + field.label + '</label>' +
          render_tag(field,value) +
        '</div>' +
        (field.instruct ? '<p class="instruct">' + field.instruct + '</p>' : '') +
      '</li>'
    ) : render_tag(field, value);
}

/**
 * Render each tag
 * @param field
 * @returns {String}
 */
function render_tag(field,value) {  
  
  var tagOutput = '';
  
  switch(field.type) {
    case 'textarea':
      tagOutput = '<textarea' 
                  + ' class="textarea ' + (field.cls ? field.cls : "") + '"'
                  + ' rows="' + (field.rows ? field.rows : "10") + '"'
                  + ' name="' + field.name + '"'
                  + '>'
                  + value
                  + '</textarea>';
      break;
    
    case 'hidden':
      tagOutput = '<input type="hidden"'
                  + ' name="' + field.name + '"'
                  + ' value="' + value + '"'
                  + tagClose
      break;
      
    case 'select':
      tagOutput = '<select'
                  + ' class="select ' + (field.cls ? field.cls : "") + '"'
                  + ' name="' + field.name + '"'
                  + '>'
      
      var options = typeof field.options === 'function' ? field.options() : field.options;
      
      options.forEach(function(option) {
        tagOutput += '<option'
                    + (value === option ? ' selected' :'')
                    + '>'
                    + option
                    + '</option>';
      });
      
      tagOutput += '</select>';
      
      break;
    
    case 'submit':
      
      tagOutput = '<input type="submit"'
        + (field.cls ? ' class="' + field.cls + '"': "")
        + ' name="' + field.name + '"'
        + ' value="' + field.value + '"'
        + tagClose
      break;
      
    case 'button':
      
      tagOutput = '<input type="button"'
        + (field.cls ? ' class="' + field.cls + '"': "")
        + ' name="' + field.name + '"'
        + ' value="' + field.value + '"'
        + (field.link ? ' onclick="window.location=\'' + field.link + '\'"' : '')
        + tagClose
      break;
      
    case 'date':
      
      if(!value) {
        value = new Date(1900, 0, 1);
      }
      
      // TODO
      tagOutput = '<input class="date" name="' + field.name + '[day]"'
                  + ' value="' + value.getDate() + '"'
                  + tagClose;
                  
      tagOutput += '<select class="date" name="' + field.name + '[month]">';
      for(var monthNameCounter=0; monthNameCounter<12; monthNameCounter++){
        tagOutput += '<option value="0"' + (value.getMonth() === monthNameCounter ? ' selected' : '') + '>' + monthNames[monthNameCounter] + '</option>';
      }
      tagOutput += '</select>';
      
      tagOutput += '<input class="date" name="' + field.name + '[year]"'
                + ' value="' + value.getFullYear() + '"'
                + tagClose;
      break;
      
    // TODO
    case 'time':
      
      // TODO
      if(!value) {
        value = new Date(1900, 0, 1);
      }
      
      tagOutput = '<input class="time" name="' + field.name + '[hours]"'
                  + ' value="' + value.getHours() + '"'
                  + tagClose;
      
      tagOutput += '<input class="time" name="' + field.name + '[minutes]"'
                  + ' value="' + value.getMinutes() + '"'
                  + tagClose;
      break;
      
    case 'datetime':
      
      // Call both types
      tagOutput = (
        render_tag({ name:field.name, type:"date" }, value) +
        '&nbsp;' +
        render_tag({ name:field.name, type:"time" }, value)
      );
      break;
      
    case 'cronTime':
      
      tagOutput = '';
      var cronTimeValues = value ? value.split(/\s/) : ['*','*','*','*','*','*'];
      for(var cronTimeInputCounter = 0; cronTimeInputCounter < 6; cronTimeInputCounter++){
        tagOutput += '<input type="text" class="text crontime" value="' + cronTimeValues[cronTimeInputCounter] + '" name="job[cronTime'+cronTimeInputCounter+']" />';
      }
      break;
      
    case 'password':
      tagOutput = '<input type="password"'
                  + ' class="text ' + (field.cls ? field.cls : "") + '"'
                  + ' name="' + field.name + '"'
                  + ' value="' + value + '"'
                  + tagClose
      break;
      
    default:
      tagOutput = '<input type="text"'
                  + ' class="text ' + (field.cls ? field.cls : "") + '"'
                  + ' name="' + field.name + '"'
                  + ' value="' + value + '"'
                  + (field.readonly ? ' readonly' : '')
                  + tagClose
      break;
  }

  return tagOutput;
  
}




/**
 * Process Form
 */
function process(req, next) {
  
  if (req.form) {
    
    req.form.complete(function(err, fields, files) {
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
}

/**
 * Recursive copy of object
 * @param from
 * @param to
 */
function copyProperties(from, to) {
  
  if(typeof from === 'object') {
    
    var props = Object.getOwnPropertyNames(from);
    props.forEach(function(name) {
      
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