#!/usr/bin/env node

var async = require("../lib/async")

function ls(pattern, options, callback) {
    
    var fileFilter = options.all ? null : filterHidden
    var printFile = options.long ? printFileLong : printFileShort
    
    async.glob(pattern)
        .filter(fileFilter)
        .stat()
        .each(function(file, next) {
            if (file.stat.isDirectory()) {
                console.log("\n" + file.path + ":")
                async.readdir(file.path)
                    .filter(fileFilter)
                    .stat()
                    .each(printFile)
                    .end(next)
            }
            else {
                printFile(file)
                next()
            }
        })
        .end(callback)
        
    function filterHidden(file) {
        return file.name.charAt(0) !== "."
    }
    
    function printFileShort(file) {
        console.log(file.path)
    }
    
    function printFileLong(file) {
        var stat = file.stat
        var owner = stat.uid + ":" + stat.gid
        console.log([
            modeString(stat.mode), 
            pad(owner, 8),
            pad(stat.size + "", 6),
            file.path
        ].join(" "))
    }
    
    function modeString(mode) {
        var rights = [
            "---",
            "-w-",
            "--x",
            "-wx",
            "r--",
            "r-x",
            "rw-",
            "rwx"
        ]
        return (
            rights[mode >> 6 & 0x7] +
            rights[mode >> 3 & 0x7] +
            rights[mode & 0x7]
        )
    }
    
    function pad(str, length) {
        if (str.length >= length)
            return str
        else
            return new Array(length - str.length + 1).join(" ") + str
    }
}

// very simplistic ls
function ls1(pattern, callback) {
    async.glob(pattern)
        .get("path")
        .print()
        .end(callback)
}

// TODO command line parser
ls(process.argv[2] || ".", {all: false, long: true})