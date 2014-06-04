// Copyright (C) 2008 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview
 * Whitelists of HTML elements and attributes.
 * 
 * @author mikesamuel@gmail.com
 */


/** @namespace */
var html4 = {};

/**
 * HTML element flags.
 * @enum {number}
 */
html4.eflags = {
  OPTIONAL_ENDTAG: 1,
  BREAKS_FLOW: 2,
  EMPTY: 4,
  NAVIGATES: 8,
  CDATA: 0x10,
  RCDATA: 0x20,
  UNSAFE: 0x40
};

/**
 * HTML attribute flags.
 * @enum {number}
 */
html4.atype = {
  SCRIPT: 1,
  STYLE: 2,
  IDREF: 3,
  NAME: 4,
  NMTOKENS: 5,
  URI: 6,
  FRAME: 7
};

/**
 * Maps HTML4 element names to flag bitsets.
 * Since this is a whitelist, be sure to do
 * {@code html4.ELEMENTS.hasOwnProperty} to determine whether or not an element
 * is allowed.
 */
html4.ELEMENTS = {
  'a'          : html4.eflags.NAVIGATES,
  'abbr'       : 0,
  'acronym'    : 0,
  'address'    : 0,
  'applet'     : html4.eflags.UNSAFE,
  'area'       : html4.eflags.EMPTY | html4.eflags.NAVIGATES,
  'b'          : 0,
  // Changes the meaning of URIs
  'base'       : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  // Affects global styles.
  'basefont'   : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  'bdo'        : 0,
  'big'        : 0,
  'blockquote' : html4.eflags.BREAKS_FLOW,
  // Attributes merged into global body.
  'body'       : html4.eflags.UNSAFE | html4.eflags.OPTIONAL_ENDTAG,
  'br'         : html4.eflags.EMPTY | html4.eflags.BREAKS_FLOW,
  'button'     : 0,
  'caption'    : 0,
  'center'     : html4.eflags.BREAKS_FLOW,
  'cite'       : 0,
  'code'       : 0,
  'col'        : html4.eflags.EMPTY,
  'colgroup'   : html4.eflags.OPTIONAL_ENDTAG,
  'dd'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'del'        : 0,
  'dfn'        : 0,
  'dir'        : html4.eflags.BREAKS_FLOW,
  'div'        : html4.eflags.BREAKS_FLOW,
  'dl'         : html4.eflags.BREAKS_FLOW,
  'dt'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'em'         : 0,
  'fieldset'   : 0,
  'font'       : 0,
  'form'       : html4.eflags.BREAKS_FLOW | html4.eflags.NAVIGATES,
  'frame'      : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  // Attributes merged into global frameset.
  'frameset'   : html4.eflags.UNSAFE,
  'h1'         : html4.eflags.BREAKS_FLOW,
  'h2'         : html4.eflags.BREAKS_FLOW,
  'h3'         : html4.eflags.BREAKS_FLOW,
  'h4'         : html4.eflags.BREAKS_FLOW,
  'h5'         : html4.eflags.BREAKS_FLOW,
  'h6'         : html4.eflags.BREAKS_FLOW,
  'head'       : (html4.eflags.UNSAFE | html4.eflags.OPTIONAL_ENDTAG
                | html4.eflags.BREAKS_FLOW),
  'hr'         : html4.eflags.EMPTY | html4.eflags.BREAKS_FLOW,
  'html'       : (html4.eflags.UNSAFE | html4.eflags.OPTIONAL_ENDTAG
                | html4.eflags.BREAKS_FLOW),
  'i'          : 0,
  'iframe'     : html4.eflags.UNSAFE,
  'img'        : html4.eflags.EMPTY,
  'input'      : html4.eflags.EMPTY,
  'ins'        : 0,
  'isindex'    : (html4.eflags.UNSAFE | html4.eflags.EMPTY
                | html4.eflags.BREAKS_FLOW | html4.eflags.NAVIGATES),
  'kbd'        : 0,
  'label'      : 0,
  'legend'     : 0,
  'li'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  // Can load global styles.
  'link'       : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  'map'        : 0,
  'menu'       : html4.eflags.BREAKS_FLOW,
  // Can override document headers and encoding, or cause navigation.
  'meta'       : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  // Ambiguous tokenization.  Content is CDATA/PCDATA depending on browser.
  'noframes'   : html4.eflags.UNSAFE | html4.eflags.BREAKS_FLOW,
  // Ambiguous tokenization.  Content is CDATA/PCDATA depending on browser.
  'noscript'   : html4.eflags.UNSAFE,
  'object'     : html4.eflags.UNSAFE,
  'ol'         : html4.eflags.BREAKS_FLOW,
  'optgroup'   : 0,
  'option'     : html4.eflags.OPTIONAL_ENDTAG,
  'p'          : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'param'      : html4.eflags.UNSAFE | html4.eflags.EMPTY,
  'plaintext'  : (html4.eflags.OPTIONAL_ENDTAG | html4.eflags.UNSAFE
                | html4.eflags.CDATA),
  'pre'        : html4.eflags.BREAKS_FLOW,
  'q'          : 0,
  's'          : 0,
  'samp'       : 0,
  'script'     : html4.eflags.UNSAFE | html4.eflags.CDATA,
  'select'     : 0,
  'small'      : 0,
  'span'       : 0,
  'strike'     : 0,
  'strong'     : 0,
  'style'      : html4.eflags.UNSAFE | html4.eflags.CDATA,
  'sub'        : 0,
  'sup'        : 0,
  'table'      : html4.eflags.BREAKS_FLOW,
  'tbody'      : html4.eflags.OPTIONAL_ENDTAG,
  'td'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'textarea'   : html4.eflags.RCDATA,
  'tfoot'      : html4.eflags.OPTIONAL_ENDTAG,
  'th'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'thead'      : html4.eflags.OPTIONAL_ENDTAG,
  'title'      : (html4.eflags.UNSAFE | html4.eflags.BREAKS_FLOW
                | html4.eflags.RCDATA),
  'tr'         : html4.eflags.OPTIONAL_ENDTAG | html4.eflags.BREAKS_FLOW,
  'tt'         : 0,
  'u'          : 0,
  'ul'         : html4.eflags.BREAKS_FLOW,
  'var'        : 0,
  'xmp'        : html4.eflags.CDATA
};

/**
 * Maps HTML4 attribute names to flag bitsets.
 */
html4.ATTRIBS = {
  'abbr'          : 0,
  'accept'        : 0,
  'accept-charset': 0,
  'action'        : html4.atype.URI,
  'align'         : 0,
  'alink'         : 0,
  'alt'           : 0,
  'archive'       : html4.atype.URI,
  'axis'          : 0,
  'background'    : html4.atype.URI,
  'bgcolor'       : 0,
  'border'        : 0,
  'cellpadding'   : 0,
  'cellspacing'   : 0,
  'char'          : 0,
  'charoff'       : 0,
  'charset'       : 0,
  'checked'       : 0,
  'cite'          : html4.atype.URI,
  'class'         : html4.atype.NMTOKENS,
  'classid'       : html4.atype.URI,
  'clear'         : 0,
  'code'          : 0,
  'codebase'      : html4.atype.URI,
  'codetype'      : 0,
  'color'         : 0,
  'cols'          : 0,
  'colspan'       : 0,
  'compact'       : 0,
  'content'       : 0,
  'coords'        : 0,
  'data'          : html4.atype.URI,
  'datetime'      : 0,
  'declare'       : 0,
  'defer'         : 0,
  'dir'           : 0,
  'disabled'      : 0,
  'enctype'       : 0,
  'face'          : 0,
  'for'           : html4.atype.IDREF,
  'frame'         : 0,
  'frameborder'   : 0,
  'headers'       : 0,
  'height'        : 0,
  'href'          : html4.atype.URI,
  'hreflang'      : 0,
  'hspace'        : 0,
  //'http-equiv'  : 0,   // unsafe
  'id'            : html4.atype.IDREF,
  'ismap'         : 0,
  'label'         : 0,
  'lang'          : 0,
  'language'      : 0,
  'link'          : 0,
  'longdesc'      : html4.atype.URI,
  'marginheight'  : 0,
  'marginwidth'   : 0,
  'maxlength'     : 0,
  'media'         : 0,
  'method'        : 0,
  'multiple'      : 0,
  'name'          : html4.atype.NAME,
  'nohref'        : 0,
  'noresize'      : 0,
  'noshade'       : 0,
  'nowrap'        : 0,
  'object'        : 0,
  'onblur'        : html4.atype.SCRIPT,
  'onchange'      : html4.atype.SCRIPT,
  'onclick'       : html4.atype.SCRIPT,
  'ondblclick'    : html4.atype.SCRIPT,
  'onfocus'       : html4.atype.SCRIPT,
  'onkeydown'     : html4.atype.SCRIPT,
  'onkeypress'    : html4.atype.SCRIPT,
  'onkeyup'       : html4.atype.SCRIPT,
  'onload'        : html4.atype.SCRIPT,
  'onmousedown'   : html4.atype.SCRIPT,
  'onmousemove'   : html4.atype.SCRIPT,
  'onmouseout'    : html4.atype.SCRIPT,
  'onmouseover'   : html4.atype.SCRIPT,
  'onmouseup'     : html4.atype.SCRIPT,
  'onreset'       : html4.atype.SCRIPT,
  'onselect'      : html4.atype.SCRIPT,
  'onsubmit'      : html4.atype.SCRIPT,
  'onunload'      : html4.atype.SCRIPT,
  'profile'       : html4.atype.URI,
  'prompt'        : 0,
  'readonly'      : 0,
  'rel'           : 0,
  'rev'           : 0,
  'rows'          : 0,
  'rowspan'       : 0,
  'rules'         : 0,
  'scheme'        : 0,
  'scope'         : 0,
  'scrolling'     : 0,
  'selected'      : 0,
  'shape'         : 0,
  'size'          : 0,
  'span'          : 0,
  'src'           : html4.atype.URI,
  'standby'       : 0,
  'start'         : 0,
  'style'         : html4.atype.STYLE,
  'summary'       : 0,
  'tabindex'      : 0,
  'target'        : html4.atype.FRAME,
  'text'          : 0,
  'title'         : 0,
  'type'          : 0,
  'usemap'        : html4.atype.URI,
  'valign'        : 0,
  'value'         : 0,
  'valuetype'     : 0,
  'version'       : 0,
  'vlink'         : 0,
  'vspace'        : 0,
  'width'         : 0
};

module.exports = html4;