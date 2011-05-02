/*
 * Default form rendering library
 */
var sys=require('sys'), calipso = require("./calipso"), qs = require("qs"), merge = require('connect').utils.merge;

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

/**
 * Form Renderer
 * 
 * @param item : the json object representing the form
 * @param next : Callback when done, pass markup as return val.
 */
function render(item,values,next) {
 
  // Refresh the reference, as it is initially loaded at startup
  calipso = require("./calipso");
  
  var formOutput = "";  
  formOutput += start_form(item);
  formOutput += render_sections(item.sections,values);
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
          + (form.cls ? " class='" + form.cls + "'": '')   
          + " method='" + form.method + "'" 
          + " enctype='multipart/form-data'"
          + " action='" + form.action + "'>"  
          + "<header class='form-header'>" 
          + "<h2>" + form.title + "</h2>" 
          + "</header>"
          + "<div class='form-container'>"
          + (form.tabs ? form_tabs(form.sections) : "")
          + "<ul class='form-fields'>"
}

/**
 *  Close the form
 * @param form
 * @returns {String}
 */
function end_form(form) {
  return "</ul>"  
         + "</div>"
         + "</form>";
}


function form_tabs(sections) {

  if(!sections) return "";
  
  var tabOutput = "<ul>";
  
  sections.forEach(function(section){
      tabOutput += "<li>"
      tabOutput += "<a href='#" + section.id + "'>" + section.label + "</a>"         
      tabOutput += "</li>"        
  });
  
  return tabOutput + "</ul>";  
  
}

/**
 * Render sections
 */
function render_sections(sections,values) {
  
  if(!sections) return "";
  
  var sectionOutput = "";
  
  sections.forEach(function(section){
    sectionOutput += "<div class='section' id='" + section.id + "'>"
    sectionOutput += "<section><h3>" + section.label + "</h3></section>"     
    sectionOutput += render_fields(section.fields,values);
    sectionOutput += "</div>"        
  });
  return sectionOutput;
  
}

/** 
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
function render_fields(fields,values) {
  
  if(!fields) return "";  
  
  var fieldOutput = "";
  fields.forEach(function(field){
    
      var value = "";
    
      // Assume the field is in the form 'object.field'
        
        var objectName = field.name.split("[")[0];
                
        if(field.name.split("[").length > 1) {        
          
          var fieldName = field.name.split("[")[1].replace("]","");
          
          // Check to see if it looks valid
          if(!objectName || !fieldName ) {
            console.log("Field name incorrect: " + field.name);
            value = "";
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
  
  var buttonsOutput = "<li class='buttons'><div class='form-element'>";
  
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
    
    fieldOutput = "<li class='form-field' id='" + field.name + "'>" 
                  + "<div class='form-element'>" 
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
      
    case "date":
            
      if(!value) {
          value = new Date(1900,0,1);
      }
      
      // TODO
      tagOutput = "<input class='date' name='" + field.name + "[day]'"
                  + " value='" + value.getDate() + "'"
                  + "</input>";
                  
      tagOutput += "<select class='date' name='" + field.name + "[month]'>"
                    + "<option value='0' " + (value.getMonth() === 0 ? "SELECTED":"") + ">Jan</option>"
                    + "<option value='1' " + (value.getMonth() === 1 ? "SELECTED":"") + ">Feb</option>"
                    + "<option value='2' " + (value.getMonth() === 2 ? "SELECTED":"") + ">Mar</option>"
                    + "<option value='3' " + (value.getMonth() === 3 ? "SELECTED":"") + ">Apr</option>"
                    + "<option value='4' " + (value.getMonth() === 4 ? "SELECTED":"") + ">May</option>"
                    + "<option value='5' " + (value.getMonth() === 5 ? "SELECTED":"") + ">Jun</option>"
                    + "<option value='6' " + (value.getMonth() === 6 ? "SELECTED":"") + ">Jul</option>"
                    + "<option value='7' " + (value.getMonth() === 7 ? "SELECTED":"") + ">Aug</option>"
                    + "<option value='8' " + (value.getMonth() === 8 ? "SELECTED":"") + ">Sep</option>"
                    + "<option value='9' " + (value.getMonth() === 9 ? "SELECTED":"") + ">Oct</option>"
                    + "<option value='10' " + (value.getMonth() === 10 ? "SELECTED":"") + ">Nov</option>"
                    + "<option value='12' " + (value.getMonth() === 11 ? "SELECTED":"") + ">Dec</option>"
                  + "</select>";
      
      tagOutput += "<input class='date' name='" + field.name + "[year]'"
                + " value='" + value.getFullYear() + "'"
                + "</input>";
      break;
      
      // TODO
    case "time":
      
      // TODO      
      if(!value) {
          value = new Date(1900,0,1);
      }
      
      tagOutput = "<input class='time' name='" + field.name + "[hours]'"
                  + " value='" + value.getHours() + "'"
                  + "</input>";
      
      tagOutput += "<input class='time' name='" + field.name + "[minutes]'"
                  + " value='" + value.getMinutes() + "'"
                  + "</input>";
      break;
      
    case "datetime":
      
      // Call both types
      var dfield = {name:field.name,type:'date'};      
      tagOutput = render_tag(dfield,value);
      
      tagOutput += "&nbsp;";
              
      var tfield = {name:field.name,type:'time'};
      tagOutput += render_tag(tfield,value);
      break;
      
    case "cronTime":
      
      tagOutput = "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[0] : "*") + "' name='job[cronTime0]'/>"
      tagOutput += "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[1] : "*") + "' name='job[cronTime1]'/>"
      tagOutput += "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[2] : "*") + "' name='job[cronTime2]'/>"
      tagOutput += "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[3] : "*") + "' name='job[cronTime3]'/>"
      tagOutput += "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[4] : "*") + "' name='job[cronTime4]'/>"
      tagOutput += "<input type='text' class='text crontime' value='" + (value ? value.split(/\s/)[5] : "*") + "' name='job[cronTime5]'/>"                  
      break;
      
    case "password":
      tagOutput = "<input type='password'"
                  + " class='text " + (field.cls ? field.cls : '') + "'"
                  + " name='" + field.name + "'"        
                  + " value='" + value + "'"
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




/**
 * Process Form
 */
function process(req,next) {
 
  if (req.form) {   
    req.form.complete(function(err, fields, files) {                  
      if(fields) {  
        
        var output = {};        
        for(var field in fields) {          
          
          var fo = qs.parse(field + "=" + fields[field]);
          copyProperties(fo,output);                    
          
        }
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
function copyProperties(from,to) {
  
  if(typeof from === "object") {    
    var props = Object.getOwnPropertyNames(from);          
    props.forEach(function(name) {
        if (name in to) {                      
            copyProperties(from[name],to[name]);        
        } else {            
            var destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(to, name, destination);
        }
    });    
  }
  
}
