/**
 * Google translate
 */
exports.googleTranslate = function (string, language, next) {

  // GOOGLE REST API requires a key
  // GET https://www.googleapis.com/language/translate/v2?key=INSERT-YOUR-KEY&source=en&target=de&q=Hello%20world

  var apiKey = "AIzaSyDqLwQV7Cz6fNdxXREADBAxwBgfyjoE_s8";  // CHANGE THIS FOR YOUR KEY
  var url = "https://www.googleapis.com/language/translate/v2?"
    + "key=" + apiKey
    + "&source=en"
    + "&target=" + language
    + "&q=" + encodeURI(string);

  // Create our client
  var client = require('https');
  var parts = require('url').parse(url);

  // HTTPS Options
  var options = { host:parts.hostname, port:parts.port, path:parts.pathname + parts.search };

  // Make the request
  client.get(options,function (response) {
    var data = '';
    response.setEncoding('utf8');
    response.on('data', function (d) {
      data += d;
    });
    response.on('end', function () {
      var jsonData = JSON.parse(data);
      if (jsonData.error) {
        next(new Error(jsonData.error.message));
      } else {
        var translation = jsonData.data.translations[0].translatedText;
        next(null, {string:string, translation:translation});
      }

    });
  }).on('error', function (err) {
      next(err);
    });

}