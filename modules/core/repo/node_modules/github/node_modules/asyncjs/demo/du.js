#!/usr/bin/env node

var async = require("../lib/async")

function du(path, callback) {

    var dirSizes = [0];
    function beforeRecurse(file) {
        if (file.stat.isDirectory())
            dirSizes.push(0);

        return true;
    }
    
    async.walkfiles(path, beforeRecurse, async.POSTORDER)
        .stat()
        .each(function(file) {
            if (file.stat.isDirectory())
                var size = dirSizes.pop()
            else
                size = file.stat.blocks
                
            if (dirSizes.length)
                dirSizes[dirSizes.length-1] += size
                
            if (file.stat.isDirectory())
                console.log(rpad(size, 10) + file.path)
            
        })
        .end(callback)
}

function rpad(str, length) {
    str = str + ""
    if (str.length >= length)
        return str
    else
        return str + new Array(length - str.length + 1).join(" ")
}

var argv = process.argv

if (argv.length !== 3)
    console.log("Usage: du.js PATH")
else
    du(argv[2], function(err) { err && console.log(err)})