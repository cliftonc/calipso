/*
 * Default form rendering library
 */
var sys=require('sys'), 
    calipso = require("./calipso");

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
 * Form Renderer
 * 
 * @param item : the json object representing the form
 * @param next : Callback when done, pass markup as return val.
 */
function render(item,values,next) {
 
  var formOutput = "";  
  formOutput += start_form(item);
  formOutput += render_fields(item.fields,values);
  formOutput += render_buttons(item.buttons);
  formOutput += end_form(item);  
  next(formOutput);
  
}

/**
 * Start the form, create basic form tag wrapper
 * @param form
 * @returns {String}
 */
function start_form(form) {
  return "<form id='" + form.id + "' name='" + form.id + "'" 
          + " method='" + form.method + "'" 
          + " action='" + form.action + "'>"  
          + "<header class='form-header'>" 
          + "<h2>" + form.title + "</h2>" 
          + "</header>" 
          + "<ul>"
}

/**
 *  Close the form
 * @param form
 * @returns {String}
 */
function end_form(form) {
  return "</ul>"  
         + "</form>";
}


/** 
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
function render_fields(fields,values) {
  
  var fieldOutput = "";
  fields.forEach(function(field){
    
      var value = "";
    
      // Assume the field is in the form 'object[field]'
      var objectName = field.name.split("[")[0];      
      var fieldName = field.name.split("[")[1].replace("]","");
      
      // Check to see if it looks valid
      if(!objectName || !fieldName ) {
        console.log("Field name incorrect: " + field.name);
        value = "";
      } else {        
        if(values[objectName] && values[objectName][fieldName]) {          
          value = values[objectName][fieldName];          
        }        
      }         
            
      fieldOutput += render_field(field,value);
      
  });
  
  return fieldOutput;
}

/** 
 * Render the buttons on a form
 * @param buttons
 * @returns {String}
 */
function render_buttons(buttons) {
  
  var buttonsOutput = "<li class='buttons'><div>";
  
  buttons.forEach(function(button){
    buttonsOutput += render_button(button);
  });
  
  buttonsOutput += "</div></li>"
  
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
function render_field(field,value) {  
  
  var fieldOutput = "";
  
  // Check to see if it is a non-visible element  
  var hasLabel = field.label || field.label.length > 0 ? true : false;  
  if(!hasLabel) {
    
    fieldOutput = render_tag(field,value); 
    
  } else {
    
    fieldOutput = "<li id='" + field.name + "'>" 
                  + "<div>" 
                  + "<label for=''>"
                  + field.label
                  + "</label>"                   
                  + render_tag(field,value)            
                  + "</div>" 
                  + (field.instruct ? "<p class='instruct'>" + field.instruct + "</p>" : "")
                  + "</li>";   
  }
      
  return fieldOutput;
  
}

/**
 * Render each tag
 * @param field
 * @returns {String}
 */
function render_tag(field,value) {  
  
  var tagOutput = "";
  
  switch(field.type) {
    case "textarea":
      tagOutput = "<textarea" 
                  + " class='textarea " + (field.cls ? field.cls : '') + "'"          
                  + " rows='" + (field.rows ? field.rows : '10') + "'"                      
                  + " name='" + field.name + "'"
                  + ">" 
                  + value
                  + "</textarea>";
      break;
    case "hidden":
      
      tagOutput = "<input type='hidden'"
                  + " name='" + field.name + "'"        
                  + " value='" + value + "'"
                  + "/>"
      break;
      
    case "select":
      
      tagOutput = "<select"
                  + " class='select " + (field.cls ? field.cls : '') + "'"      
                  + " name='" + field.name + "'"
                  + ">"

      var options = [];
      if(typeof field.options === "function") {
        options = field.options();
      } else {
        options = field.options;
      }
      
      options.forEach(function(option) {
        tagOutput += "<option "
                    + (value === option ? "SELECTED" :"")
                    + ">"
                    + option
                    + "</option>";                                    
      });
            
      tagOutput += "</select>";               
            
      break;
    case "date":
      break;
    case "time":
      break;
    case "submit":
      tagOutput = "<input type='submit'"
        + (field.cls ? " class='" + field.cls + "'": '')      
        + " name='" + field.name + "'"
        + " value='" + field.value + "'"
        + "/>"
      break;
    case "button":
      tagOutput = "<input type='button'"
        + (field.cls ? " class='" + field.cls + "'": '')      
        + " name='" + field.name + "'"
        + " value='" + field.value + "'"
        + "/>"
      break;
    default:
      tagOutput = "<input type='text'"
                  + " class='text " + (field.cls ? field.cls : '') + "'"
                  + " name='" + field.name + "'"        
                  + " value='" + value + "'"
                  + "/>"
      break;
  }  

  return tagOutput;
  
}