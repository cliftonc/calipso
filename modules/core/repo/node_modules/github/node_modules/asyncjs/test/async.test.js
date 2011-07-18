var async = require("../index")
var assert = require("assert")

var Test = {
    
    name: "async",
    
    setUpSuite: function(next) {
        console.log("set up suite")
        next();
    },
    
    "test toArray": function(next) {
        async.range(0, 3)
            .toArray(function(err, values) {
                assert.equal(JSON.stringify(values), JSON.stringify([0, 1, 2]))
                next()
            })
    },
    
    "test toArray with break on error": function(next) {
        async.range(0, 3)
            .each(function(value, next) {
                if (value == 1)
                    next("ERROR")
                else
                    next()
            })
            .toArray(function(err, values) {
                assert.ok(err)
                assert.ok(!values)
                next()
            })        
    },
    
    "test toArray with continue on error": function(next) {
        async.range(0, 3)
            .each(function(value, next) {
                if (value == 1)
                    next("ERROR")
                else
                    next()
            })
            .toArray(false, function(err, arr) {
                assert.equal(err.length, 3)
                assert.equal(arr.length, 3)
                assert.equal(err[0], null)
                assert.equal(err[1], "ERROR")
                assert.equal(err[2], null)
                next()
            })
    },

    "test end": function(next) {
        async.range(0, 3)
            .end(function(err, last) {
                assert.equal(err, undefined)
                assert.equal(last, 2)
                next()
            })
    },
    
    "test end with break on error": function(next) {
        async.range(0, 3)
            .each(function(value, next) {
                if (value == 1)
                    next("ERROR")
                else
                    next()
            })
            .end(function(err, last) {
                //assert.ok(err)
                next()
            })
    },
    
    "test end with continue on error": function(next) {
        async.range(0, 3)
            .each(function(value, next) {
                if (value == 1)
                    next("ERROR")
                else
                    next()
            })
            .end(false, function(err, last) {
                assert.strictEqual(err, "ERROR")
                assert.equal(last, 2)
                next()
            })
    },
    
    "test call": function(next) {
        var context = {}
        async.list([
            function(next) {
                next(null, "juhu")
            },
            function() {
                assert.equal(this, context)
                return "kinners"
            }
        ]).call(context)
            .toArray(function(err, values) {
                assert.equal(JSON.stringify(values), JSON.stringify(["juhu", "kinners"]))
                next()
            })
    },
    
    "test timeout error": function(next) {
        async.range(0, 4)
            .map(function(value, next) {
                // don't call next!
            })
            .timeout(20)
            .end(function(err, value) {
                assert.ok(err)
                next()
            })
    },

    "test no timeout error": function(next) {
        async.range(0, 3)
            .timeout()
            .toArray(function(err, values) {
                assert.equal(JSON.stringify(values), JSON.stringify([0, 1, 2]))
                next()
            })            
    }
}

module.exports = require("../lib/test").testcase(Test)

if (module === require.main)
    module.exports.exec()
