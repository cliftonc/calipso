/*!a
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


var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join('..', 'calipso')),
  qs = require('qs'),
  merge = require('connect').utils.merge;

// Global variable (in this context) for translation function
var t;

/**
 * The default calipso form object, with default configuration values.
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

}

var f = new Form();

var me = Form.prototype;

// instead of referring to the singleton (`f`), we could implement a function
// that would give us the current instance, for a more sure `this`
// but it would be a little bit slower, due to the function call
//me.getInstance = function(){
//  return this;
//};
//me.getContext = function(){
//  return this;
//};

/* just an idea.
 function getAttributeString(el){
 var validAttrs = ['type','name','id','class','value','disabled'];
 var output = '';
 validAttrs.forEach(function(i, attrName){
 if(el[attrName]){
 output += ' ' + attrName + '="' + el.attr[attrName] + '"';
 }
 });
 return output;
 }
 */

// if complete for every country, this will be a lot of data and should
// probably be broken out to a separate file.
me.countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
  "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus",
  "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
  "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic",
  "Chad", "Chile", "China (People's Republic of China)", "Colombia", "Comoros",
  "Democratic Republic of the Congo", "Republic of the Congo",
  "Costa Rica", "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Denmark, the Kingdom of", "Djibouti", "Dominica",
  "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "North Korea", "South Korea",
  "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
  "Federated States of Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
  "Nepal", "Netherlands, the Kingdom of", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "Norway", "Oman", "Pakistan", "Palau", "Palestinian territories",
  "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan",
  "Suriname", "Swaziland", "Sweden", "Switzerland", "Syria",
  "Taiwan (Republic of China)", "Tajikistan", "Tanzania", "Thailand", "Togo",
  "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
];

me.states = {
  "United States":{
    AL:"Alabama",
    AK:"Alaska",
    AZ:"Arizona",
    AR:"Arkansas",
    CA:"California",
    CO:"Colorado",
    CT:"Connecticut",
    DE:"Delaware",
    DC:"District Of Columbia",
    FL:"Florida",
    GA:"Georgia",
    HI:"Hawaii",
    ID:"Idaho",
    IL:"Illinois",
    IN:"Indiana",
    IA:"Iowa",
    KS:"Kansas",
    KY:"Kentucky",
    LA:"Louisiana",
    ME:"Maine",
    MD:"Maryland",
    MA:"Massachusetts",
    MI:"Michigan",
    MN:"Minnesota",
    MS:"Mississippi",
    MO:"Missouri",
    MT:"Montana",
    NE:"Nebraska",
    NV:"Nevada",
    NH:"New Hampshire",
    NJ:"New Jersey",
    NM:"New Mexico",
    NY:"New York",
    NC:"North Carolina",
    ND:"North Dakota",
    OH:"Ohio",
    OK:"Oklahoma",
    OR:"Oregon",
    PA:"Pennsylvania",
    RI:"Rhode Island",
    SC:"South Carolina",
    SD:"South Dakota",
    TN:"Tennessee",
    TX:"Texas",
    UT:"Utah",
    VT:"Vermont",
    VA:"Virginia",
    WA:"Washington",
    WV:"West Virginia",
    WI:"Wisconsin",
    WY:"Wyoming"
  }
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

me.defaultTagRenderer = function (field, value, bare) {
  var isCheckable = field.type == 'radio' || field.type == 'checkbox';
  var checked = field.checked || (isCheckable && value && (field.value == value || value === true));

  //console.log('... field: ', field, value);
  var tagOutput = "";

  if (field.type == 'checkbox' && !field.readonly && !field.disabled) {
    // Workaround for readonly/disabled fields (esp. checkboxes/radios) - add a hidden field with the value
    tagOutput += '<input type="hidden" name="' + field.name + '" value="false" />';
  }

  tagOutput += '<input type="' + field.type + '"'
    + ' class="' + field.type + (field.cls ? ' ' + field.cls : "") + (field.labelFirst ? ' labelFirst' : '') + '"'
    + ' name="' + field.name + '"'
    + (field.placeholder ? ' placeholder = "' + field.placeholder + '"' : '')
    + (field.href ? ' onClick=\'window.location="' + field.href + '"\';' : '')
    + ' id="' + (field.id ? field.id : field.name + (field.type == 'radio' ? (++f.radioCount) : '')) + '"'
    + (field.required ? ' required = "required"' : '')
    + (field.src ? ' src="' + field.src + '"' : '') // for input type=image .. which should be avoided anyway.
    + (field.multiple ? ' multiple="' + field.multiple + '"' : '') // for input type=file
    + (field.directory ? ' mozdirectory webkitdirectory directory' : '') //for input type=file
    + ' value="' + calipso.utils.escapeHtmlQuotes(value || field.value || (isCheckable && 'on') || '') + '"'
    + (field.readonly || field.disabled ? ' disabled' : '')
    + (checked ? ' checked' : '')
    + f.tagClose;
  if (field.readonly || field.disabled) {
    // Workaround for readonly/disabled fields (esp. checkboxes/radios) - add a hidden field with the value
    tagOutput += '<input type="hidden" name="' + field.name + '" value="' + (checked ? 'true' : 'false') + '" />';
  }

  return bare ? tagOutput : me.decorateField(field, tagOutput);

};

me.decorateField = function (field, tagHTML) {
  calipso.silly('FORM: decorateField, field: ', field);
  var isCheckable = !field.labelFirst && (field.type == "checkbox" || field.type == "radio");
  var labelHTML = field.label ? (
    '<label ' + (isCheckable ? ' class="for-checkable"' : '')
      + ' for="' + field.name + (field.type == 'radio' ? f.radioCount : '')
      + '">' + t(field.label) + (isCheckable ? '' : ':') + '</label>'
    ) : '';

  var wrapperId = field.name ? (
    field.name.replace(/\[/g, '_').replace(/\]/g, '')
      + (field.type == 'radio' ? '-radio' + me.radioCount : '')
    ) : '';

  return field.label && field.label.length > 0 ? (
    '<div class="form-item field-type-' + field.type + '" id="' + wrapperId + '-wrapper">' +
      '<div class="form-field row">' +
      // put checkboxes and radios ("checkables") before their labels, unless field.labelFirst is true
      (isCheckable ? tagHTML + labelHTML : labelHTML + tagHTML) +
      '</div>' +
      (field.description ? '<span class="description ' + field.type + '-description">' + t(field.description) + '</span>' : '') +
      '</div>'
    ) : tagHTML;
};

// if there is no `canContain` or `cannotContain`, then the element is not a container.
// the following psuedofunction should suffice:
// x.canContain(y) =
//   ((x.canContain && y in x.canContain) || (x.cannotContain && !(y in x.cannotContain)))
//   && (!y.canBeContainedBy || x in y.canBeContainedBy)
me.elementTypes = {

  'page':{
    cannotContain:['page'],
    render:function (el) {
    }
  },

  'section':{
    cannotContain:['page'],
    isTab:false,
    render:function (el, values, isTabs) {
      return (
        '<section' + (el.isTab || isTabs ? ' class="tab-content"' : '') + ' id="' + el.id + '">' +
          (el.label ? '<h3>' + t(el.label) + '</h3>' : '') +
          (el.description ? '<p>' + el.description + '</p>' : '') +
          '<div class="section-fields">' +
          me.render_fields(el, values) +
          '</div>' +
          '</section>'
        );
    }
  },

  // todo: allow for pre-rendered markup for the description, or other renderers (such as markdown)
  'fieldset':{
    cannotContain:['section', 'page'],
    render:function (el, values) {
      if (!el.label) {
        el.label = el.legend;
      }
      return (
        '<fieldset class="' + (el.type != 'fieldset' ? el.type + '-fieldset' : 'fieldset') + '">' +
          // <legend> is preferable, but legends are not fully stylable, so 'label' = <h4>
          (el.label ? '<h4>' + t(el.label) + '</h4>' : '') +
          (el.description ? '<p>' + el.description + '</p>' : '') +
          '<div class="fieldset-fields">' +
          me.render_fields(el, values) +
          '</div>' +
          '</fieldset>'
        );
    }
  },

  // Create a div.
  'container':{
    cannotContain:['section', 'page', 'fieldset'],
    render:function (el, values) {
      return (
        '<div class="container' + (el.cls ? ' ' + el.cls : '') + '">' +
          (el.label ? '<h5>' + el.label + '</h5>' : '') +
          me.render_fields(el, values) +
        '</div>'
      );
    }
  },

  // special .. might also be used as a container (i.e., depending on what radio is active, elements 'under' it are active?)
  // special - have to share ids .. are part of a set - TODO - allow for more than one radio group (already done?)
  'radios':{ // it's a container because radios must belong to a 'set' .. also, sometimes a form uses radios kindof like tabs....
    canContain:['option'],
    render:function (field, values) {
      return me.elementTypes.fieldset.render(field, values);
    }
  },

  // special .. might also be used as a container (i.e., depending on whether a checkbox is checked, elements 'under' it are active?)
  'checkboxes':{
    canContain:['option'],
    render:function (field, values) {
      return me.elementTypes.fieldset.render(field, values);
    }
  },

  'select':{ // it's a container because it contains options
    canContain:['options', 'optgroup'],
    render:function (field, value) {

      var tagOutput = '<select'
        + ' class="select ' + (field.cls ? field.cls : "") + '"'
        + ' name="' + field.name + '"'
        + ' id="' + field.name + '"'
        + (field.multiple ? ' multiple="multiple"' : '')
        + (field.required ? ' required = "required"' : '')
        + '>';

      var options = typeof field.options === 'function' ? field.options() : field.options;

      value = (value ? value : field.value ? field.value : value)

      if (field.optgroups) {
        field.optgroups.forEach(function (optgroup) {
          tagOutput += '<optgroup label="' + optgroup.label + '">';
          optgroup.options.forEach(function (option) {
            tagOutput += me.elementTypes.option.render(option, value, 'select');
          });
          tagOutput += '</optgroup>';
        });
      } else {
        options.forEach(function (option) {
          tagOutput += me.elementTypes.option.render(option, value, 'select');
        });
      }
      tagOutput += '</select>';

      return me.decorateField(field, tagOutput);
    }
  },

  'optgroup':{
    canBeContainedBy:['select'],
    canContain:['option']
  },

  'options':{
    canBeContainedBy:['select'],
    canContain:['option']
  },

  // an "option" can be an <option> or a radio or a checkbox.
  'option':{
    canBeContainedBy:['radios', 'checkboxes', 'select', 'optgroup'],
    // container determines render method.
    render:function (option, value, containerType) {
      if (containerType == 'select') {
        var displayText = option.label || option;
        var optionValue = option.value || option;
        return (
          '<option'
            + ' value="' + optionValue + '"'
            + (value === optionValue ? ' selected' : '')
            + (option.cls ? ' class="' + option.cls + '"' : '')
            + '>'
            + displayText
            + '</option>'
          );
      } else {
        return me.defaultTagRenderer(option, value);
      }
    }
  },

  // type: 'radio' should become type: option, and be in a {type: radios}
  'radio':{
    render:me.defaultTagRenderer
  },

  // type: 'checkbox' should become type: option, and be in a {type: checkboxes}
  'checkbox':{
    render:function (field, value, bare) {

      // Quickly flip values to true/false if on/off
      value = (value === "on" ? true : (value === "off" ? false : value));

      // Now set the checked variable
      var checked = (value ? true : (field.value ? true : (field.checked ? true : false)));

      var tagOutput = "";

      if (!field.readonly && !field.disabled) {
        // Workaround for readonly/disabled fields (esp. checkboxes/radios) - add a hidden field with the value
        tagOutput += '<input type="hidden" name="' + field.name + '" value="off" />';
      }

      tagOutput += '<input type="' + field.type + '"'
        + ' class="' + field.type + (field.cls ? ' ' + field.cls : "") + (field.labelFirst ? ' labelFirst' : '') + '"'
        + ' name="' + field.name + '"'
        + ' id="' + field.name + '"'
        + (field.readonly || field.disabled ? ' disabled' : '')
        + (checked ? ' checked' : '')
        + f.tagClose;

      if (field.readonly || field.disabled) {
        // Workaround for readonly/disabled fields (esp. checkboxes/radios) - add a hidden field with the value
        tagOutput += '<input type="hidden" name="' + field.name + '" value="' + (checked ? "on" : "off") + '" />';
      }
      return bare ? tagOutput : me.decorateField(field, tagOutput);
    }
  },

  'text':{
    render:me.defaultTagRenderer
  },

  'textarea':{
    render:function (field, value) {
      return me.decorateField(field, '<textarea'
        + ' class="textarea ' + (field.cls ? field.cls : "") + '"'
        + ' rows="' + (field.rows ? field.rows : "10") + '"'
        + ' cols="' + (field.cols ? field.cols : "10") + '"'
        + ' name="' + field.name + '"'
        + ' id="' + field.name + '"'
        + (field.required ? ' required = "required"' : '')
        + (field.placeholder ? 'placeholder="' + field.placeholder + '"' : '')
        + '>'
        + (field.value ? field.value : value)
        + '</textarea>');
    }
  },

  'hidden':{
    render:me.defaultTagRenderer
  },

  'password':{  // can be special, if there is a 'verify'
    render:me.defaultTagRenderer
  },

  'email':{
    render:me.defaultTagRenderer
  },
  'url':{
    render:me.defaultTagRenderer
  },
  // might allow file to take a url
  'file':{
    render:me.defaultTagRenderer
  },

  'buttons':{
    canContain:['submit', 'image', 'reset', 'button', 'link']
  },

  // buttons should only be able to be added to the 'action set'
  // button can be [submit, reset, cancel (a link), button (generic), link (generic)]
  // if form has pages, 'previous' and 'next' buttons should interpolate until the last page, 'submit'
  'button':{
    render:me.defaultTagRenderer
  },

  'submit':{
    render:me.defaultTagRenderer
  },

  'image':{
    render:me.defaultTagRenderer
  },

  'reset':{
    render:me.defaultTagRenderer
  },

  // a link is not really a form control, but is provided here for convenience
  // it also doesn't really make sense for it to have a value.
  // a link should have an href and text, and optionally, cls ('class'), id
  'link':{
    render:function (field, value) {
      var id = field.id || field.name;
      var text = field.text || field.value;
      return '<a href="' + field.href + '"'
        + ' class="form-link' + (field.cls ? ' ' + field.cls : "") + '"'
        + (id ? ' id="' + id + '"' : '')
        + '>' + text + '</a>';
    }
  },

  'readonlytext':{
    render:function (field, value, bare) {
      var id = field.id || field.name;
      var text = field.text || field.value;
      var tagOutput = '<div class="readonlytext text' + (field.cls ? ' ' + field.cls : "") + '"'
        + (id ? ' id="' + id + '"' : '')
        + '>' + text + '</div>';
      return bare ? tagOutput : me.decorateField(field, tagOutput);
    }
  },

  'date':{
    render:function (field, value, bare) {

      if (!value) {
        value = new Date();
      }

      // TODO - use user's Locale
      var monthNames = calipso.date.regional[''].monthNamesShort;

      var tagOutput = '<input type="text"'
        + ' class="date date-day' + (field.cls ? ' date-day-' + field.cls : '') + '"'
        + ' name="' + field.name + '[day]"'
        + ' value="' + value.getDate() + '"'
        + (field.required ? ' required' : '')
        + f.tagClose;

      tagOutput += ' ';

      tagOutput += '<select class="date date-month' + (field.cls ? ' date-month-' + field.cls : '') + '"'
        + (field.required ? ' required' : '')
        + ' name="' + field.name + '[month]">';
      for (var monthNameCounter = 0; monthNameCounter < 12; monthNameCounter++) {
        tagOutput += (
          '<option value="' + monthNameCounter + '"' + (value.getMonth() === monthNameCounter ? ' selected' : '') + '>'
            + monthNames[monthNameCounter]
            + '</option>'
          );
      }
      tagOutput += '</select>';

      tagOutput += ' ';

      tagOutput += '<input type="text"'
        + ' class="date date-year' + (field.cls ? ' date-year-' + field.cls : '') + '"'
        + ' name="' + field.name + '[year]"'
        + ' value="' + value.getFullYear() + '"'
        + (field.required ? ' required' : '')
        + f.tagClose;

      return bare ? tagOutput : me.decorateField(field, tagOutput);
    }
  },

  'time':{
    render:function (field, value, bare) {

      // TODO
      if (!value) {
        value = new Date(); // why 1900? why not 'now'?
      }

      var tagOutput = '<input type="text" class="time time-hours' + (field.cls ? ' time-hours-' + field.cls : '') + '"'
        + ' name="' + field.name + '[hours]"'
        + ' value="' + value.getHours() + '"'
        + (field.required ? ' required' : '')
        + f.tagClose;

      tagOutput += ' ';

      tagOutput += '<input type="text" class="time time-minutes' + (field.cls ? ' time-minutes-' + field.cls : '') + '"'
        + ' name="' + field.name + '[minutes]"'
        + ' value="' + value.getMinutes() + '"'
        + (field.required ? ' required' : '')
        + f.tagClose;

      return bare ? tagOutput : me.decorateField(field, tagOutput);

    }
  },

  'datetime':{
    render:function (field, value) {
      // Call both types
      return me.decorateField(field,
        me.elementTypes.date.render({
          name:field.name,
          type:"date",
          required:field.required
        }, value, true) +
          ' ' +
          me.elementTypes.time.render({
            name:field.name,
            type:"time",
            required:field.required
          }, value, true)
      );
    }
  },

  'crontime':{
    render:function (field, value) {
      var tagOutput = '';
      var cronTimeValues = value ? value.split(/\s/) : ['*', '*', '*', '*', '*', '*'];
      for (var cronTimeInputCounter = 0; cronTimeInputCounter < 6; cronTimeInputCounter++) {
        tagOutput += (
          '<input type="text" class="text crontime" value="' +
            cronTimeValues[cronTimeInputCounter] +
            '" name="job[cronTime' + cronTimeInputCounter + ']"' +
            (field.required ? ' required' : '') +
            f.tagClose
          );
      }
      return me.decorateField(field, tagOutput);
    }
  }

};

// any element types that reference other element types have to be declared afterward
// so that the references exist.
me.elementTypes.richtext = {
  render:me.elementTypes.textarea.render
};

me.elementTypes.json = {
  render:me.elementTypes.textarea.render
};

me.elementTypes.email = {
  render:function (field, value) {
    field.type = 'text';
    field.cls = (field.cls ? field.cls + ' ' : '') + 'email';
    return me.elementTypes.text.render(field, value);
  }
};

me.elementTypes.address = {
  render:me.elementTypes.fieldset.render,
  defaultDefinition:{
    tag:'fieldset',
    type:'address',
    children:[
      {type:'text', name:'street', label:'Street Address'},
      {type:'select', name:'country', label:'Country', options:me.countries},
      {type:'select', name:'state', label:'State', options:me.states["United States"]},
      {type:'text', name:'postalcode', label:'Postal Code'}
    ]
  }
};


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
 * @param values : The values to initialise the form with
 * @param next : Callback when done, pass markup as return val (TODO : deprecate this, then can use form.render in views)
 */
me.render = function (formJson, values, req, next) {

  var self = this,
    formData = {formJson: formJson, values: values};

  // Store local reference to the request for use during translation
  t = req.t;

  // Emit a form pre-render event.
  calipso.e.custom_emit('FORM', formJson.id, formData, function (formData) {

    var formJson = formData.formJson,
      values = formData.values,
      form = (
      self.start_form(formJson) +
        self.render_sections(formJson, values) + // todo: deprecate - sections should be treated the same as any other field (container)
        self.render_fields(formJson, values) +
        self.render_buttons(formJson.buttons) + // todo: deprecate - buttons should be treated the same as any other field (container)
        self.end_form(formJson)
      );

    // Save the form object in session, this enables us to use it later
    // To parse the incoming data and validate against.
    // Saving it in the session allows for per-user customisation of the form without
    // impacting this code.
    saveFormInSession(formJson, req, function (err) {
      if (err) {
        calipso.error(err.message);
      }
      next(form);
    })

  });

};

/**
 * Helper to save a form in the session to be used later when processing.
 */
function saveFormInSession(form, req, next) {

  // If we have a form id and a session, save it
  if (form.id && calipso.lib._.keys(req.session).length > 0) {
    calipso.silly("Saving form " + form.id + " in session.");
    req.session.forms = req.session.forms || {};
    req.session.forms[form.id] = form;
    req.session.save(next);
  } else {
    next();
  }
}

/**
 * Deal with form tabs in jQuery UI style if required.
 */
me.formTabs = function (sections) {

  if (!sections) {
    return '';
  }

  var tabOutput = '<nav><ul class="tabs">',
    numSections = sections.length;

  sections.forEach(function (section, index) {
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
me.start_form = function (form) {
  return (
    '<form id="' + form.id + '" name="' + form.id + '"' + (form.cls ? ' class="' + form.cls + '"' : "") +
      ' method="' + form.method + '"' + ' enctype="' + (form.enctype ? form.enctype : "multipart/form-data") + '"' + ' action="' + form.action + '">' +
      '<input type="hidden" value="' + form.id + '" name="form[id]"/>' +
      '<legend>' + t(form.title) + '</legend>' +
      '<div class="form-container">' +
      (form.tabs ? this.formTabs(form.sections) : '') +
      '<fieldset class="form-fields' + (form.tabs ? ' tab-container' : '') + '">'
    );
};

/**
 * Close the form
 * @param form
 * @returns {String}
 */
me.end_form = function (form) {
  return '</fieldset></div></form>';
};


/**
 * Render the form sections, iterating through and then rendering
 * each of the fields within a section.
 */
me.render_sections = function (form, values) {

  var self = this;
  var sections = form.sections;

  if (!sections) {
    return '';
  }

  var sectionOutput = '';

  sections.forEach(function (section) {
    sectionOutput += (
      '<section' + (form.tabs ? ' class="tab-content"' : '') + ' id="' + section.id + '">' +
        '<h3>' + t(section.label) + '</h3>' +
        self.render_fields(section, values) +
        '</section>'
      );
  });
  return sectionOutput;

};

/**
 * Render the buttons on a form
 * @param buttons
 * @returns {String}
 */
me.render_buttons = function (buttons) {

  var self = this;
  var buttonsOutput = '<div class="row actions">';

  buttons.forEach(function (field) {
    buttonsOutput += self.elementTypes[field.tag || field.type].render(field);
  });

  buttonsOutput += '</div>';

  return buttonsOutput;
};


/**
 * Render the fields on a form
 * @param fields
 * @returns {String}
 */
me.render_fields = function (fieldContainer, values) {

  var fields = fieldContainer.fields || fieldContainer.children;
  var self = this;
  var fieldOutput = '';

  if (!fields) {
    return '';
  }

  fields.forEach(function (field) {

    var value = '';
    var fieldName = field.name;

    // If we have a field name, lookup the value
    if (fieldName) {
      value = getValueForField(fieldName, values);
    }

    // if the 'field' is really just a container, pass the values on down
    // todo: consider adding a property 'isContainer'
    if (field.type == 'section' || field.type == 'fieldset' || field.type == 'container') {
      value = values;
    }

    // field.tag was introduced to allow for <button type="submit"> (without tag:button, that would be <input type="submit">)
    if (self.elementTypes[field.tag || field.type]) {
      fieldOutput += self.elementTypes[field.tag || field.type].render(field, value, fieldContainer.tabs);  //self.render_field(field, value);
    } else {
      calipso.warn('No renderer for ', field);
    }

  });

  return fieldOutput;
};

/**
 * Get the value for a form field from the values object
 * @param from
 * @param to
 */
function getValueForField(field, values) {

  if (!values || !field) {
    return '';
  }

  // First of all, split the field name into keys
  var path = []
  if (field.match(/.*\]$/)) {
    path = field.replace(/\]/g, "").split("[");
  } else {
    path = field.split(':');
  }

  while (path.length > 0) {

    key = path.shift();

    if (!(values && key in values)) {
      if (values && (typeof values.get === "function")) {
        values = values.get(key);
      } else {
        if (values && values[field]) {
          return values[field];
        } else {
          return '';
        }
      }
    } else {
      values = values[key];
    }

    if (path.length === 0) {
      return (values || '');
    }
  }

}


/**
 * Get the value for a form field from the values object
 * @param from
 * @param to
 */
function setValueForField(field, values, value) {

  if (!values) {
    return '';
  }

  // First of all, split the field name into keys
  var path = []
  if (field.match(/.*\]$/)) {
    path = field.replace(/\]/g, "").split("[");
  } else {
    path = [field];
  }

  //
  // Scope into the object to get the appropriate nested context
  //
  while (path.length > 1) {
    key = path.shift();
    if (!values[key] || typeof values[key] !== 'object') {
      values[key] = {};
    }
    values = values[key];
  }

  // Set the specified value in the nested JSON structure
  key = path.shift();
  values[key] = value;
  return true;

}

/**
 * Recursive copy of object
 * @param from
 * @param to
 */
function copyFormToObject(field, value, target) {

  // First of all, split the field name into keys
  var path = []
  if (field.match(/.*\]$/)) {

    path = field.replace(/\]/g, "").split("[");

    // Now, copy over
    while (path.length > 1) {
      key = path.shift();
      if (!target[key]) {
        target[key] = {};
      }
      target = target[key];
    }

    // Shift one more time and set the value
    key = path.shift();
    target[key] = value;

  } else {

    // We are probably an nconf form, hence just copy over
    target[field] = value;

  }


}

/**
 * Process a field / section array from a contentType
 * And modify the form
 */
me.processFields = function (form, fields) {

  // Process fields
  if (fields.fields) {
    processFieldArray(form, fields.fields);
  }

  if (fields.sections) {
    fields.sections.forEach(function (section, key) {
      // Process fields
      if (section.label) {
        form.sections.push(section);
      }
      // Remove it
      if (section.hide) {
        form = removeSection(form, section.id);
      }
    });
  }

  return form;

};


// Helper function to process fields
function processFieldArray(form, fields) {

  fields.forEach(function (field, key) {
    // Add it
    if (field.type) {
      form.fields.push(field);
    }
    // Remove it
    if (field.hide) {
      form = removeField(form, field.name);
    }
  });

}

/**
 * Remove a field from a form (any section)
 */
function removeField(form, fieldName) {

  // Scan sections
  form.sections.forEach(function (section, key) {
    scanFields(section.fields, fieldName);
  });

  // Form fields
  scanFields(form.fields, fieldName);

  return form;

}

// Helper function for removeField
function scanFields(fieldArray, fieldName) {
  fieldArray.forEach(function (field, key) {
    if (field.name === fieldName) {
      fieldArray = fieldArray.splice(key, 1);
    }
  });
}

/**
 * Remove a section from a form
 */
function removeSection(form, sectionId) {

  // Scan sections
  form.sections.forEach(function (section, key) {
    if (section.id === sectionId) {
      form.sections.splice(key, 1);
    }
  });

  return form;

}


/**
 * Simple object mapper, used to copy over form values to schemas
 */
me.mapFields = function (fields, record) {

  var props = Object.getOwnPropertyNames(fields);
  props.forEach(function (name) {
    // If not private (e.g. _id), then copy
    if (!name.match(/^_.*/)) {
      record.set(name, fields[name]);
    }
  });

};


/**
 * Process the values submitted by a form and return a JSON
 * object representation (makes it simpler to then process a form submission
 * from within a module.
 */
me.process = function (req, next) {

  // Fix until all modules refactored to use formData
  if (req.formProcessed) {

    next(req.formData, req.uploadedFiles);
    return;

  } else {

    // Data parsed based on original form structure
    processFormData(req, function (err, formData) {

      if (err) {
        calipso.error(err);
      }

      req.formData = formData;
      req.formProcessed = true;

      return next(req.formData, req.files);

    });

  }

};


/**
 * This process the incoming form, if the form exists in session then use that
 * to validate and convert incoming data against.
 */
function processFormData(req, next) {

  if (calipso.lib._.keys(req.body).length === 0) {
    // No data
    return next();
  }

  // Get the form id and then remove from the response
  var formId = req.body.form ? req.body.form.id : '';
  delete req.body.form;

  // Get the form and then delete the form from the user session to clean up
  var form = req.session.forms ? req.session.forms[formId] : null;
  var formData = req.body;

  if (formId && form) {

    processSectionData(form, formData, function (err, formData) {

      delete req.session.forms[formId];

      req.session.save(function (err) {
        if (err) {
          calipso.error(err.message);
        }
      }); // Doesn't matter that this is async, can happen in background

      return next(err, formData);

    });

  } else {

    // No form in session, do not process
    next(null, formData);

  }

}

/**
 * Process form sections and fields.
 */
function processSectionData(form, formData, next) {

  // Create a single array of all the form and section fields
  var fields = [];

  if (form.sections) {
    form.sections.forEach(function (section) {
      // Ensure section isn't null
      if (section) {
        fields.push(section.fields);
      }
    });
  }
  if (form.fields) {
    fields.push(form.fields);
  }

  calipso.lib.async.map(fields, function (section, cb) {
    processFieldData(section, formData, cb);
  }, function (err, result) {
    next(err, formData);
  })

}

/**
 * Process form fields.
 */
function processFieldData(fields, formData, next) {

  // First create an array of all the fields (and field sets) to allow us to do an async.map
  var formFields = [];

  for (var fieldName in fields) {
    // It is a section that contains fields
    var field = fields[fieldName];
    if (field.fields) {
      // This is a field set
      for (var subFieldName in field.fields) {
        formFields.push(field.fields[subFieldName]);
      }
    } else {
      // Just push the field
      formFields.push(field)
    }
  }

  var iteratorFn = function (field, cb) {

    var value = getValueForField(field.name, formData);
    processFieldValue(field, value, function (err, processedValue) {
      if (value !== processedValue) {
        setValueForField(field.name, formData, processedValue);
      }
      cb(err, true);
    });

  }

  calipso.lib.async.map(formFields, iteratorFn, next);

}

/**
 * Process submitted values against the original form.
 * TODO: This is where we would bolt on any validation.
 */
function processFieldValue(field, value, next) {

  // Process each field
  if (field.type === 'checkbox') {

    if (typeof value === 'object') {
      // The value has come in as ['off','on'] or [false,true]
      // So we always take the last value
      value = value[value.length - 1];
    }

    // Deal with on off
    if (value === 'on') {
      value = true;
    }
    if (value === 'off') {
      value = false;
    }

  }

  if (field.type === 'select') {

    // Deal with Yes / No > Boolean
    if (value === 'Yes') {
      value = true;
    }
    if (value === 'No') {
      value = false;
    }

  }

  if (field.type === 'datetime') {

    if (value.hasOwnProperty('date') && value.hasOwnProperty('time')) {
      value = new Date(
        value.date + " " + value.time
      );
    }

    if (value.hasOwnProperty('date') && value.hasOwnProperty('hours')) {
      value = new Date(
        value.date + " " + value.hours + ":" + value.minutes + ":00"
      );
    }

    if (value.hasOwnProperty('year') && value.hasOwnProperty('hours')) {

      var now = new Date();

      value = new Date(
        (value.year || now.getFullYear()),
        (value.month || now.getMonth()),
        (value.day || now.getDate()),
        (value.hours || now.getHours()),
        (value.minutes || now.getMinutes()),
        (value.seconds || now.getSeconds())
      );

    }

  }

  return next(null, value);

}

/**
 * Export an instance of our form object
 */
module.exports = f;
