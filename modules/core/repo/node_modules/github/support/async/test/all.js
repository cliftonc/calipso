var async = require("../lib/async")

async.concat(
    require("./async.test"),
    require("./fs.test")
).exec()
