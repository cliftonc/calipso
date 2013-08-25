/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query;

/**
 * Define the routes that this module will repsond to.
 */
var routes = [
]

/**
 * Exports
 */
exports = module.exports = {
  init:init,
  route:route,
  routes:routes,
  fieldSettingsFormJson: defaultFieldSettingsFormJson,
  fieldJson: defaultFieldJson
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  /**
   * Routing and Route Handler
   */
  module.router.route(req, res, next);

}

/**
 *Init
 */
function init(module, app, next) {
  calipso.e.custom('FORM', 'FORM', module.name, addFieldConfiguration);
  //calipso.e.pre('CONTENT_TYPE_CREATE', module.name, processFieldConfiguration);
  //calipso.e.pre('CONTENT_TYPE_UPDATE', module.name, processFieldConfiguration);
  calipso.e.pre('CONTENT_TYPE_MAP_FIELDS', module.name, processFieldConfiguration);

  module.initialised = true;
  next();
}

/**
 * Alter form when changing content Types.
 */
function addFieldConfiguration(event, formData, next) {
  var formJson = formData.formJson,
    values = formData.values;

  for (var key in formJson.sections) {
    if (formJson.sections.hasOwnProperty(key)) {
      if (formJson.sections[key].id === 'type-custom-fields') {
        if (values.contentType.fields == '') {
          return next(formData);
        }
        var formFields = formJson.sections[key].fields;
        try {
          fieldValues = JSON.parse(values.contentType.fields)
        }
        catch (err) {
          return next(formData);
        }
        var settings = fieldSettings(fieldValues);
          
          // Initially there was only one element in the array, reset it.
          while (formFields.length > 1) {
            formFields.shift();
          }
          formFields = settings.concat(formFields);
          formJson.sections[key].fields = formFields;
      }
    }
  }

  formData.formJson = formJson;

  next(formData);
}

/**
 * Assemble json settings for fields.
 */
function fieldSettings(fields, settings) {
  fieldHelper = calipso.field.Helper;
  if (typeof settings === 'undefined') {
    settings = [];
  }
  for (var key in fields) {
    if (fields.hasOwnProperty(key)) {
      if (key === 'fields') {
        for (var i = 0; i < fields[key].length; i++) {
          settingsFormCb = fieldHelper.settingsForm[fields[key][i].type];
          if (typeof settingsFormCb !== 'function') {
            settingsFormCb = defaultFieldSettingsFormJson;
          }
          settings = settings.concat(settingsFormCb(fields[key][i]));
        }
      }
      else if (key === 'sections') {
        for (var i = 0; i < fields[key].length; i++) {
          settings = settings.concat(sectionSettingsFormJson(fields[key][i]));
        }
      }
    }
  }

  return settings;
}

/**
 * Return json to render field settings.
 */
function defaultFieldSettingsFormJson(field) {
  var id = field.name.replace(/\[|\]/g, '_');
  
  return [{
    type: "container",
    cls: "field-settings",
    fields: [{
      label: "label",
      name: "fieldSettings[" + id + "][label]",
      value: field.label,
      cls: "inline",
      type: "text",
      description: "Create a label for this field"
    },
    {
      label: "name",
      name: "fieldSettings[" + id + "][name]",
      value: field.name,
      cls: "inline",
      type: "text",
      description: "Create a name for this field"
    },
    {
      label: "type",
      name: "fieldSettings[" + id + "][type]",
      value: field.type,
      type: "select",
      options: fieldTypesArray(),
      description: "Select a field type for this field"
    },
    {
      label: "description",
      name: "fieldSettings[" + id + "][description]",
      value: field.description,
      type: "textarea",
      rows: 1,
      cols: 40,
      description: "Create a description for this field"
    }]
  }];
}

/**
 * Return json to render section settings.
 */
function sectionSettingsFormJson(section) {
  var fields = [];
  if (typeof section.fields !== 'undefined') {
    var settings = fieldSettings({fields: section.fields});
    // Include name property inside sectionSettings
    for (var key1 in settings) {
      if (settings.hasOwnProperty(key1)) {
        for (var key2 in settings[key1].fields) {
          if (settings[key1].fields.hasOwnProperty(key2)) {
            var name = settings[key1].fields[key2].name;
            name = name.replace('fieldSettings', 'fieldSettings]');
            settings[key1].fields[key2].name = "sectionSettings[" + section.label + "][" + name;
          }
        }
      }
    }
    fields = fields.concat(settings);
  }

  fields.unshift({
    label: "label",
    name: "sectionSettings[" + section.label + "][label]" ,
    value: section.label,
    cls: "inline",
    type: "text",
    description: "Create a label for this section"
  });

  return [{
    label: section.label,
    name: section.label + "[fieldset]",
    cls: "section",
    type: "fieldset",
    fields: fields
  }];
}

/**
 * Return default json for a field.
 */
function defaultFieldJson(fieldSettings) {
  return {
    label: fieldSettings.label,
    name: fieldSettings.name,
    type: fieldSettings.type,
    description: fieldSettings.description
  };
}

/**
 * Return a list of defined fields.
 */
function fieldTypesArray() {
  return calipso.field.Helper.fieldTypes;
}

/**
 * Process field settings and store json.
 */
function processFieldConfiguration(event, formData, next) {
  var form = formData.form,
    fieldsJson = formData.json,
    jsonObject = {};

  for (var key in form.fieldSettings) {
    if (form.fieldSettings.hasOwnProperty(key)) {
      processFieldJson(form.fieldSettings[key], jsonObject);
    }
  }

  for (var key in form.sectionSettings) {
    if (form.sectionSettings.hasOwnProperty(key)) {
      processSectionJson(form.sectionSettings[key], jsonObject);
    }
  }

  formData.json = JSON.stringify(jsonObject);
  next(formData);
}

/**
 * Return json for each field.
 */
function processFieldJson(fieldSettings, jsonObject) {
  var fieldHelper = calipso.field.Helper,
    fieldJsonCb = fieldHelper.json;
  if (typeof fieldJsonCb !== 'function') {
    fieldJsonCb = defaultFieldJson;
  }
  if (typeof jsonObject.fields === 'undefined') {
    jsonObject.fields = [];
  }
  jsonObject.fields.push(fieldJsonCb(fieldSettings));
}

/**
 * Return json for each section.
 */
function processSectionJson(sectionSettings, jsonObject) {
  if (typeof jsonObject.sections === 'undefined') {
    var tempJsonObject = {label: sectionSettings.label};
    jsonObject.sections = [];
  }
  else {
    var tempJsonObject = jsonObject.sections;
  }
  if (typeof sectionSettings.fieldSettings !== 'undefined') {
    for (var key in sectionSettings.fieldSettings) {
      if (sectionSettings.fieldSettings.hasOwnProperty(key)) {
        processFieldJson(sectionSettings.fieldSettings[key], tempJsonObject) 
      }
    }
  }

  jsonObject.sections = [];
  jsonObject.sections.push(tempJsonObject);
}
