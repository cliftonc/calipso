/*!
 * async.js
 * Copyright(c) 2011 Fabian Jakobs <fabian.jakobs@web.de>
 * MIT Licensed
 */

module.exports = require("./lib/async")

require("./lib/plugins/utils")
require("./lib/plugins/shortcuts")
require("./lib/plugins/fs-node")

module.exports.test = require("./lib/test")