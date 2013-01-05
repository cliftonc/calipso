/**
 * This is a generic date parsing and formatting library, to avoid any confusion
 * about how dates are handled across both the back and front end (assuming jQuery UI will be)
 * the default.
 *
 * These functions are extracted from the jQuery UI Datepicker (see below).
 */

/**
 * jQuery UI Datepicker
 *
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * - License http://jquery.org/license
 * - Original Source http://docs.jquery.com/UI/Datepicker
 */

function CalipsoDate() {

  this.regional = []; // Available regional settings, indexed by language code
  this.regional[''] = { // Default regional settings
    closeText:'Done',
    // Display text for close link
    prevText:'Prev',
    // Display text for previous month link
    nextText:'Next',
    // Display text for next month link
    currentText:'Today',
    // Display text for current month link
    monthNames:['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    // Names of months for drop-down and formatting
    monthNamesShort:['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    // For formatting
    dayNames:['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    // For formatting
    dayNamesShort:['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    // For formatting
    dayNamesMin:['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    // Column headings for days starting at Sunday
    weekHeader:'Wk',
    // Column header for week of the year
    dateFormat:'mm/dd/yy',
    // See format options on parseDate
    firstDay:0,
    // The first day of the week, Sun = 0, Mon = 1, ...
    isRTL:false,
    // True if right-to-left language, false if left-to-right
    showMonthAfterYear:false,
    // True if the year select precedes month, false for month then year
    yearSuffix:'' // Additional text to append to the year in the month headers
  };

  this._defaults = this.regional[''];

  // Standard date formats.
  this.ATOM = 'yy-mm-dd'; // RFC 3339 (ISO 8601)
  this.COOKIE = 'D, dd M yy';
  this.ISO_8601 = 'yy-mm-dd';
  this.RFC_822 = 'D, d M y';
  this.RFC_850 = 'DD, dd-M-y';
  this.RFC_1036 = 'D, d M y';
  this.RFC_1123 = 'D, d M yy';
  this.RFC_2822 = 'D, d M yy';
  this.RSS = 'D, d M y'; // RFC 822
  this.TICKS = '!';
  this.TIMESTAMP = '@';
  this.W3C = 'yy-mm-dd'; // ISO 8601
  this._ticksTo1970 = (((1970 - 1) * 365 + Math.floor(1970 / 4) - Math.floor(1970 / 100) + Math.floor(1970 / 400)) * 24 * 60 * 60 * 10000000);

}

/* Parse a string value into a date object.
 See formatDate below for the possible formats.

 @param  format    string - the expected format of the date
 @param  value     string - the date in the above format
 @param  settings  Object - attributes include:
 shortYearCutoff  number - the cutoff year for determining the century (optional)
 dayNamesShort    string[7] - abbreviated names of the days from Sunday (optional)
 dayNames         string[7] - names of the days from Sunday (optional)
 monthNamesShort  string[12] - abbreviated names of the months (optional)
 monthNames       string[12] - names of the months (optional)
 @return  Date - the extracted date value or null if value is blank */
CalipsoDate.prototype.parseDate = function (format, value, settings) {
  if (format == null || value == null) {
    throw 'Invalid arguments';
  }
  value = (typeof value == 'object' ? value.toString() : value + '');
  if (value == '') {
    return null;
  }
  var shortYearCutoff = (settings ? settings.shortYearCutoff : null) || this._defaults.shortYearCutoff;
  shortYearCutoff = (typeof shortYearCutoff != 'string' ? shortYearCutoff : new Date().getFullYear() % 100 + parseInt(shortYearCutoff, 10));
  var dayNamesShort = (settings ? settings.dayNamesShort : null) || this._defaults.dayNamesShort;
  var dayNames = (settings ? settings.dayNames : null) || this._defaults.dayNames;
  var monthNamesShort = (settings ? settings.monthNamesShort : null) || this._defaults.monthNamesShort;
  var monthNames = (settings ? settings.monthNames : null) || this._defaults.monthNames;
  var year = -1;
  var month = -1;
  var day = -1;
  var doy = -1;
  var literal = false;
  // Check whether a format character is doubled
  var lookAhead = function (match) {
    var matches = (iFormat + 1 < format.length && format.charAt(iFormat + 1) == match);
    if (matches) {
      iFormat++;
    }
    return matches;
  };
  // Extract a number from the string value
  var getNumber = function (match) {
    var isDoubled = lookAhead(match);
    var size = (match == '@' ? 14 : (match == '!' ? 20 : (match == 'y' && isDoubled ? 4 : (match == 'o' ? 3 : 2))));
    var digits = new RegExp('^\\d{1,' + size + '}');
    var num = value.substring(iValue).match(digits);
    if (!num) {
      throw 'Missing number at position ' + iValue;
    }
    iValue += num[0].length;
    return parseInt(num[0], 10);
  };
  // Extract a name from the string value and convert to an index
  var getName = function (match, shortNames, longNames) {
    var names = $.map(lookAhead(match) ? longNames : shortNames,function (v, k) {
      return [
        [k, v]
      ];
    }).sort(function (a, b) {
        return -(a[1].length - b[1].length);
      });
    var index = -1;
    $.each(names, function (i, pair) {
      var name = pair[1];
      if (value.substr(iValue, name.length).toLowerCase() == name.toLowerCase()) {
        index = pair[0];
        iValue += name.length;
        return false;
      }
    });
    if (index != -1) {
      return index + 1;
    }
    else {
      throw 'Unknown name at position ' + iValue;
    }
  };
  // Confirm that a literal character matches the string value
  var checkLiteral = function () {
    if (value.charAt(iValue) != format.charAt(iFormat)) {
      throw 'Unexpected literal at position ' + iValue;
    }
    iValue++;
  };
  var iValue = 0;
  for (var iFormat = 0; iFormat < format.length; iFormat++) {
    if (literal) {
      if (format.charAt(iFormat) == "'" && !lookAhead("'")) {
        literal = false;
      }
      else {
        checkLiteral();
      }
    }
    else {
      switch (format.charAt(iFormat)) {
        case 'd':
          day = getNumber('d');
          break;
        case 'D':
          getName('D', dayNamesShort, dayNames);
          break;
        case 'o':
          doy = getNumber('o');
          break;
        case 'm':
          month = getNumber('m');
          break;
        case 'M':
          month = getName('M', monthNamesShort, monthNames);
          break;
        case 'y':
          year = getNumber('y');
          break;
        case '@':
          var date = new Date(getNumber('@'));
          year = date.getFullYear();
          month = date.getMonth() + 1;
          day = date.getDate();
          break;
        case '!':
          var date = new Date((getNumber('!') - this._ticksTo1970) / 10000);
          year = date.getFullYear();
          month = date.getMonth() + 1;
          day = date.getDate();
          break;
        case "'":
          if (lookAhead("'")) {
            checkLiteral();
          }
          else {
            literal = true;
          }
          break;
        default:
          checkLiteral();
      }
    }
  }
  if (year == -1) {
    year = new Date().getFullYear();
  }
  else if (year < 100) {
    year += new Date().getFullYear() - new Date().getFullYear() % 100 + (year <= shortYearCutoff ? 0 : -100);
  }
  if (doy > -1) {
    month = 1;
    day = doy;
    do {
      var dim = this._getDaysInMonth(year, month - 1);
      if (day <= dim) {
        break;
      }
      month++;
      day -= dim;
    } while (true);
  }
  var date = this._daylightSavingAdjust(new Date(year, month - 1, day));
  if (date.getFullYear() != year || date.getMonth() + 1 != month || date.getDate() != day) {
    throw 'Invalid date';
  } // E.g. 31/02/00
  return date;
}

/*
 Format a date object into a string value.

 The format can be combinations of the following

 d  - day of month (no leading zero)
 dd - day of month (two digit)
 o  - day of year (no leading zeros)
 oo - day of year (three digit)
 D  - day name short
 DD - day name long
 m  - month of year (no leading zero)
 mm - month of year (two digit)
 M  - month name short
 MM - month name long
 y  - year (two digit)
 yy - year (four digit)
 @ - Unix timestamp (ms since 01/01/1970)
 ! - Windows ticks (100ns since 01/01/0001)
 '...' - literal text
 '' - single quote

 @param  format    string - the desired format of the date
 @param  date      Date - the date value to format
 @param  settings  Object - attributes include:
 dayNamesShort    string[7] - abbreviated names of the days from Sunday (optional)
 dayNames         string[7] - names of the days from Sunday (optional)
 monthNamesShort  string[12] - abbreviated names of the months (optional)
 monthNames       string[12] - names of the months (optional)
 @return  string - the date in the above format */

CalipsoDate.prototype.formatDate = function (format, date, settings) {
  if (!date) {
    return '';
  }
  var dayNamesShort = (settings ? settings.dayNamesShort : null) || this._defaults.dayNamesShort;
  var dayNames = (settings ? settings.dayNames : null) || this._defaults.dayNames;
  var monthNamesShort = (settings ? settings.monthNamesShort : null) || this._defaults.monthNamesShort;
  var monthNames = (settings ? settings.monthNames : null) || this._defaults.monthNames;
  // Check whether a format character is doubled
  var lookAhead = function (match) {
    var matches = (iFormat + 1 < format.length && format.charAt(iFormat + 1) == match);
    if (matches) {
      iFormat++;
    }
    return matches;
  };
  // Format a number, with leading zero if necessary
  var formatNumber = function (match, value, len) {
    var num = '' + value;
    if (lookAhead(match)) {
      while (num.length < len) {
        num = '0' + num;
      }
    }
    return num;
  };
  // Format a name, short or long as requested
  var formatName = function (match, value, shortNames, longNames) {
    return (lookAhead(match) ? longNames[value] : shortNames[value]);
  };
  var output = '';
  var literal = false;
  if (date) {
    for (var iFormat = 0; iFormat < format.length; iFormat++) {
      if (literal) {
        if (format.charAt(iFormat) == "'" && !lookAhead("'")) {
          literal = false;
        }
        else {
          output += format.charAt(iFormat);
        }
      }
      else {
        switch (format.charAt(iFormat)) {
          case 'd':
            output += formatNumber('d', date.getDate(), 2);
            break;
          case 'D':
            output += formatName('D', date.getDay(), dayNamesShort, dayNames);
            break;
          case 'o':
            output += formatNumber('o', (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000, 3);
            break;
          case 'm':
            output += formatNumber('m', date.getMonth() + 1, 2);
            break;
          case 'M':
            output += formatName('M', date.getMonth(), monthNamesShort, monthNames);
            break;
          case 'y':
            output += (lookAhead('y') ? date.getFullYear() : (date.getYear() % 100 < 10 ? '0' : '') + date.getYear() % 100);
            break;
          case '@':
            output += date.getTime();
            break;
          case '!':
            output += date.getTime() * 10000 + this._ticksTo1970;
            break;
          case "'":
            if (lookAhead("'")) {
              output += "'";
            }
            else {
              literal = true;
            }
            break;
          default:
            output += format.charAt(iFormat);
        }
      }
    }
  }
  return output;
}

/**
 * Export an instance of our date object
 */
module.exports = new CalipsoDate();
