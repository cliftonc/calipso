/**
 * This helper allows us to include files that either have or haven't been marked up by jscoverage.
 * All modules under test should be included via;
 *
 * library = require('./helpers/require')('core/Config.js');
 *
 * The path is always relative to the lib folder, and this approach only works for core Calipso libraries.
 *
 */
if (process.env.CALIPSO_COV) {
  module.exports = function (library) {
    return require('../../lib-cov/' + library);
  }
} else {
  module.exports = function (library) {
    return require('../../lib/' + library);
  }
}