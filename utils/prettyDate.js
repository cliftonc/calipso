/*
 * JavaScript Pretty Date
 * Copyright (c) 2008 John Resig (jquery.com)
 * Licensed under the MIT license.
 */

// Takes an ISO time and returns a string representing how
// long ago the date represents.
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipsoDate = require(path.join(rootpath, "lib/core/Date"));

exports = module.exports = {

  prettyDate:function (stringDate) {

    var date = new Date(stringDate),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0) {
      return;
    }

    return day_diff == 0 && (
      diff < 60 && "just now" ||
        diff < 120 && "1 minute ago" ||
        diff < 3600 && Math.floor(diff / 60) + " minutes ago" ||
        diff < 7200 && "1 hour ago" ||
        diff < 86400 && Math.floor(diff / 3600) + " hours ago"
      ) ||
      day_diff == 1 && "Yesterday" ||
      day_diff < 7 && day_diff + " days ago" ||
      day_diff < 31 && Math.ceil(day_diff / 7) == 1 && "1 week ago" ||
      day_diff < 31 && Math.ceil(day_diff / 7) + " weeks ago" ||
      day_diff >= 31 && calipsoDate.formatDate('D, d M yy', date);
  },
  // Splits the date into 7 'hot' categories based on recency
  hotDate:function (stringDate) {

    var date = new Date(stringDate),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0) {
      return;
    }

    return day_diff == 0 && (
      diff < 7200 && "h1" ||
        diff < 86400 && "h2"
      ) ||
      day_diff == 1 && "h3" ||
      day_diff < 3 && "h4" ||
      day_diff < 5 && "h5" ||
      day_diff <= 7 && "h6" ||
      day_diff > 7 && "h7";
  }


};
