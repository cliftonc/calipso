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
module.exports.translate = function(configLanguage) {

    // Default to english
    var languages = ['en']; // Always contains english
    var languageCache = cacheLanguages([], languages);

    return function(req, res, next){

        var language = configLanguage || "en";

        // add our loaded languages to the request object
        req.languages = languages;

        // Add the translate function to the request object
        req.t = req.translate = function(englishString) {

            // Check the user session
            if(req.session && req.session.user) {
              // Set the language to the user configuration if it exists;
              language = req.session.user.language || language;
            }

            // Check the query string parameters
            language = req.moduleParams.language || language;

            // Translate
            if(languageCache[language]) {
              return doTranslation(englishString,languageCache[language]);
            } else {
              return englishString;
            }

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
  fs.readdirSync("i8n").forEach(function(file){
      var languageFile = file.split(".");
      if(languageFile[0] === "language") {
        languageCache[languageFile[1]] = require("i8n/" + file).language;
        loadedLanguages.push(languageFile[1]);
      }
  });

  return languageCache;

}

/**
 * Look up and perform the translation, by default, return the english string if not found.
 */
function doTranslation(englishString, languageCache) {

  return languageCache[englishString] || englishString;

}