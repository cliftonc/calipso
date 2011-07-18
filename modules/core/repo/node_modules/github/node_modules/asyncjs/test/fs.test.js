var async = require("../index")
var assert = require("assert")
var Path = require("path")
var fs = require("fs")

var testDir = "assets_TEST"

var Test = {
    
    setUp: function(next) {
        this.$dir = process.cwd()
        process.chdir(__dirname)
        async.rmtree(__dirname + "/assets_TEST", function() {
            async.copytree(__dirname + "/assets", testDir, next)
        })
    },
    
    tearDown: function(next) {
        process.chdir(this.$dir)
        async.rmtree(__dirname + "/assets_TEST", next)
    },
    
    "test stat": function(next) {
        async.files([testDir + "/1.txt"])
            .stat()
            .end(function(err, file) {
                assert.ok(!err)
                assert.ok(file.stat.isFile())
                next()
            })
    },
    
    "test unlink existing file should remove the file": function(next) {
        async.files([testDir + "/3.txt"])
            .unlink()
            .end(function(err, file) {
                Path.exists(file.path, function(exists) {
                    assert.ok(!exists)
                    next()
                })
            })
    },

    "test rmdir empty dir should remove it": function(next) {
        async.files([testDir + "/emptydir"])
            .rmdir()
            .end(function(err, file) {
                Path.exists(file.path, function(exists) {
                    assert.ok(!exists)
                    next()
                })
            })        
    },
    
    "test rmdir non empty dir should fail": function(next) {
        async.files([testDir + "/nonemptydir"])
            .rmdir()
            .end(function(err, file) {
                assert.ok(err)
                Path.exists(file.path, function(exists) {
                    assert.ok(exists)
                    next()
                })
            })
    },
    
    "test rmdir non existing dir should fail": function(next) {
        async.files([testDir + "/foobar"])
            .rmdir()
            .end(function(err, file) {
                assert.ok(err)
                next()
            })
    },
    
    "test read file": function(next) {
        async.files([testDir + "/1.txt"])
            .readFile()
            .end(function(err, file) {
                assert.ok(!err)
                assert.equal(file.data, "1")
                next()
            })
    },
    
    "test open/close file": function(next) {
        async.files([testDir + "/1.txt"])
            .open()
            .each(function(file, next) {
                assert.ok(file.fd)
                next()
            })
            .close()
            .each(function(file, next) {
                assert.ok(!file.fd)
                next()
            })
            .end(function(err) {
                assert.ok(!err)
                next()                
            })
    },
    
    "test chmod": function(next) {
        async.files([testDir + "/1.txt"])
            .chmod(0600)
            .each(function(file, next) {
                fs.stat(file.path, function(err, stat) {
                    // TODO node.js error?
                    //assert.equal(stat.mode, 0600)
                    next()
                })
            })
            .stat()
            .chmod(0644)
            .each(function(file, next) {
                fs.stat(file.path, function(err, stat) {
                    // TODO node.js error?
                    //assert.equal(stat.mode, file.stat.mode)
                    next()
                })
            })
            .end(function(err) {
                assert.ok(!err)
                next()                
            })
    },
    
    "test mkdir/rmdir": function(next) {
        async.files([testDir + "/newdir"])
            .mkdir(0755)
            .each(function(file, next) {
                Path.exists(file.path, function(exists) {
                    assert.ok(exists)
                    next()
                })
            })
            .rmdir()
            .each(function(file, next) {
                Path.exists(file.path, function(exists) {
                    assert.ok(!exists)
                    next()
                })
            })
            .end(function(err) {
                assert.ok(!err)
                next()                
            })
    },
    
    "test write file with data from argument": function(next) {
        async.files([testDir + "/4.txt"])
            .writeFile("4")
            .readFile()
            .end(function(err, file) {
                assert.ok(!err)
                assert.equal(file.data, "4")
                next()
            })
    },
    
    "test write file with data from stream": function(next) {
        async.files([testDir + "/5.txt"])
            .each(function(file) {
                file.data = "5"
            })
            .writeFile()
            .readFile()
            .end(function(err, file) {
                assert.ok(!err)
                assert.equal(file.data, "5")
                next()
            })
    },

    "test walk files pre order": function(next) {
        async.walkfiles(testDir + "/walk", null, async.PREORDER)
            .get("path")
            .toArray(function(err, values) {
                var expected = [
                    "",
                    "/dir1",
                    "/dir1/1.txt",
                    "/dir2",
                    "/dir2/dir22",
                    "/dir2/dir22/22.txt",
                    "/dir2/2.txt",
                    "/1.txt"
                ].map(function(dir) {
                    return testDir + "/walk" + dir
                })
                assert.equal(JSON.stringify(values), JSON.stringify(expected))
                next()
            })
    },

    "test walk files post order": function(next) {
        async.walkfiles(testDir + "/walk", null, async.POSTORDER)
            .get("path")
            .toArray(function(err, values) {
                var expected = [
                    "/dir1/1.txt",
                    "/dir1",
                    "/dir2/dir22/22.txt",
                    "/dir2/dir22",
                    "/dir2/2.txt",
                    "/dir2",
                    "/1.txt",
                    ""
                ].map(function(dir) {
                    return testDir + "/walk" + dir
                })
                assert.equal(JSON.stringify(values), JSON.stringify(expected))
                next()
            })
    },

    "test glob without magic": function(next) {
        async.glob(testDir + "/1.txt")
            .get("path")
            .toArray(function(err, values) {
                assert.equal(JSON.stringify(values), JSON.stringify([testDir + "/1.txt"]))
                next()
            })
    },
    
    "test glob with * in file name": function(next) {
        async.glob(testDir + "/*.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = ["1" , "2", "3", "11"].map(function(val) {
                    return testDir + "/" + val + ".txt"
                })
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })
    },
    
    "test glob with ? in file name": function(next) {
        async.glob(testDir + "/?.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = ["1" , "2", "3"].map(function(val) {
                    return testDir + "/" + val + ".txt"
                })
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })
    },
    
    "test glob with only file magic": function(next) {
        process.chdir(testDir)
        async.glob("*.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = ["1" , "2", "3", "11"].map(function(val) {
                    return val + ".txt"
                })
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })
    },
    
    "test glob without magic for not existing file should return empty list": function(next) {
        async.glob(testDir + "/notexisting/juhu.txt")
            .toArray(function(err, values) {
                assert.equal(values.length, 0)
                next()
            })
    },
    
    "test glob with non existing file name should return empty list" : function(next) {
        async.glob(testDir + "/notexisting/*.txt")
            .toArray(function(err, values) {
                assert.equal(values.length, 0)
                next()
            })        
    },
    
    "test glob with * in path": function(next) {
        async.glob(testDir + "/dir*/*.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = [
                    testDir + "/dir1/1.txt", 
                    testDir + "/dir2/2.txt", 
                    testDir + "/dir11/11.txt"
                ]
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })        
    },

    "test glob with ? in path": function(next) {
        async.glob(testDir + "/dir?/*.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = [
                    testDir + "/dir1/1.txt",
                    testDir + "/dir2/2.txt"
                ]
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })        
    },
    
    "test glob with * in path and ? name": function(next) {
        async.glob(testDir + "/dir*/?.txt")
            .get("path")
            .toArray(function(err, values) {
                var expected = [
                    testDir + "/dir1/1.txt", 
                    testDir + "/dir2/2.txt"
                ]
                assert.equal(JSON.stringify(values.sort()), JSON.stringify(expected.sort()))
                next()
            })        
    },    
}

module.exports = require("../lib/test").testcase(Test, "fs")

if (module === require.main)
    module.exports.exec()
