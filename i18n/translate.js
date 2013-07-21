var rootpath = process.cwd() + '/',
  path = require('path');
/**
 * Translation function, will be exposed through a connect middleware function
 * that adds a translate function to the request object.
 *
 * This allows for language settings to be extracted either from user session, or from
 * query string parameters.
 *
 * Query string parameters will always take precedent over user session
 *
 */
module.exports.translate = function (configLanguage, enabledLanguages, addMode) {

  // Default to english
  var languages = enabledLanguages || ['en']; // Always contains english
  var languageCache = cacheLanguages([], languages);

  return function (req, res, next) {

    // Set the request language
    req.language = configLanguage || "en";

    // add our loaded languages to the request object
    req.languages = languages;

    // Add the translate function to the request object
    req.t = req.translate = function (englishString, values) {

      // Check the user session
      if (req.session && req.session.user) {
        // Set the language to the user configuration if it exists;
        req.language = req.session.user.language || req.language;
      }

      // Check the query string parameters
      req.language = req.moduleParams ? req.moduleParams.language || req.language : req.language;

      // Translate
      if (languageCache[req.language]) {
        return doTranslation(englishString, languageCache[req.language], values, addMode);
      } else {
        if (addMode) {
          // Add the language
          languageCache[req.language] = {};
          return doTranslation(englishString, languageCache[req.language], values, addMode);
        } else {
          return replaceValues(englishString, values);
        }
      }

    }

    if (addMode) {
      req.languageCache = languageCache;
    }

    next();

  }

};

/**
 * Load the languages into a cache
 * Optionally limit (as this will reduce memory footprint and speed up)
 */
function cacheLanguages(languages, loadedLanguages) {

  var languageCache = {};

  // Read the language files, sync is ok as this is done once on load
  var fs = require("fs");
  fs.readdirSync("i18n").forEach(function (file) {
    var languageFile = file.split(".");
    if (languageFile[0] === "language") {
      languageCache[languageFile[1]] = require(path.join(rootpath, "i18n/", file)).language;
      loadedLanguages.push(languageFile[1]);
    }
  });

  return languageCache;

}

/**
 * Look up and perform the translation, by default, return the english string if not found.
 */
function doTranslation(englishString, languageCache, values, addMode) {

  if (addMode) {
    // Add the string if appropriate
    languageCache[englishString] = languageCache[englishString] || englishString;
    return replaceValues(languageCache[englishString], values);
  } else {
    // Just return it
    return replaceValues(languageCache[englishString] || englishString, values);
  }

}

/**
 * Replace any tokens with values
 * Expected values:
 *
 *     {"msg":"Clifton"}
 *
 * String:
 *     "Hello {msg}"
 *
 * Output:
 *     "Hello Clifton"
 */
function replaceValues(string, values) {

  return string.replace(/{[^{}]+}/g, function (key) {
    if (!values) values = {}; // In case we have { } in the string but really no values (thinking Mongo Errors during install)
    return values[key.replace(/[{}]+/g, "")] || "";
  });

}