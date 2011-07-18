/*!
 * async.js
 * Copyright(c) 2010 Fabian Jakobs <fabian.jakobs@web.de>
 * MIT Licensed
 */

var async = require("../lib/async")

async.readdir(__dirname)
    .stat()
    .filter(function(file) {
        return file.stat.isFile()
    })
    .readFile("utf8")
    .each(function(file) {
        console.log(file.data)
    })
    .end()