/*!
 * async.js
 * Copyright(c) 2010 Fabian Jakobs <fabian.jakobs@web.de>
 * MIT Licensed
 */

var async = require("../lib/async")

var even = async.range(0, null, 2)
var odd = async.range(1, null, 2)

async.list([1,2,3,4])
    .expand(function(val, next) {        
        next(null, async.list([val, val, val]))
    })
    .toArray(function(err, result) {
        console.log("expanded " + result)
    })

even.slice(0, 4)
    .reverse()
    .toArray(function(err, result) {
        console.log("reverse " + result)
    })

odd.slice(2, 6)
    .join(" - ")
    .end(function(err, result) {
        console.log(result)
    })

even.zip(odd)
    .slice(0, 4)
    .toArray(function(err, arr) {
        console.log("zip " + JSON.stringify(arr))
    })
    
even.slice(0, 3).concat(odd.slice(0, 3))
    .toArray(function(err, arr) {
        console.log(arr)
    })

async.list([4, 2, 3, 9])
    .sort()
    .join(" < ")
    .end(function(err, result) {
        console.log("sorted " + result)
    })

async.list([1, 8, 3, 5])
    .some(function odd(item) {
        return item % 2 == 0
    })
    .end(function(err, result) {
        console.log("Any odd? " + result)
    })

async.list([1, 8, 3, 5])
    .every(function odd(item) {
        return item % 2 == 0
    })
    .end(function(err, result) {
        console.log("All odd? " + result)
    })

async.range(1, 5)
    .reduce(function(previousValue, currentValue) {        
        return previousValue + currentValue;
    })
    .end(function(err, value) {
        console.log("Sum over 1..4: " + value);
    })

async.range(1, 5)
    .reduce(function(previousValue, currentValue, index, next) {
        next(null, previousValue + currentValue);
    }, 10)
    .end(function(err, value) {        
        console.log("Sum over 1..4 + 10: " + value);
    })

async.range(1, 10)
    .delay(200)
    .each(function(item, next) {
        console.log(item);
        next();
    })
    .end(function(err) {
        console.log("end")
    })

async.range(10, null, 1)
    .slice(3, 9)
    .toArray(function(err, arr) {
        console.log(arr);
    })

async.list([2, 4, 1, 3])
    .filter(function(item, next) {
        next(null, item % 2 == 0);
    })
    .map(function(item, next) {
        next(null, item*2);
    })
    .map(function(item) {
        return item*2;
    })
    .toArray(function(err, arr) {
        console.log(arr);
    })
    
async.list([
    function sync() {
        console.log("first")
        return "juhu"
    },
    
    function async(next) {
        console.log("second")
        next(null, "kinners")
    }
]).call()
    .toArray(function(err, arr) {
        console.log(arr)
    })