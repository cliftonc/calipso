var async = require("../async")

async.plugin({}, {
    forEach: function(list, eachFn, callback) {
        async.list(list).each(eachFn).end(callback)
    },

    map: function(list, mapper, callback) {
        async.list(list).map(mapper).toArray(callback)
    },

    chain: function(funcs, context) {
        async.list(funcs.slice(0, -1)).call(context).end(funcs[funcs.length-1])
    }
})