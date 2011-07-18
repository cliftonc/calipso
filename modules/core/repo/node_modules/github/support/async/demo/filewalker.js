
var async = require("../lib/async")

function postOrder(next) {
    console.log("")
    console.log("post order walker:")
    async.walkfiles(__dirname)
        .each(function(file) {
            console.log(file.path)
        })
        .end(next)
}

function preOrder(next) {
    console.log("")
    console.log("pre order walker:")
    async.walkfiles(__dirname, null, async.PREORDER)
        .each(function(file) {
            console.log(file.path)
        })
        .end(next)
}

function filerAssets(next) {
    console.log("")
    console.log("filter assets directory")
    var filter = function(file) {
        return file.name !== "assets" || !file.stat.isDirectory()
    }
    async.walkfiles(__dirname, filter, true)
        .each(function(file) {
            console.log(file.path)
        })
        .end(next)
}

function copy(next) {
    async.copytree(__dirname, __dirname + "/../COPY", function(err) {
        console.log("DONE " + err)
        next()
    })
}

function remove(next) {
    async.rmtree(__dirname + "/../COPY", function(err) {
        console.log("DONE " + err)
        next()
    })
}


async.list([postOrder, preOrder, filerAssets, copy, remove]).call().end()