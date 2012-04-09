

var rootpath = process.cwd() + '/';

module.exports = {
    fs: require('fs'),
    path: require('path'),
    express: require('express'),
    step: require('step'),
    util: require('util'),
    mongoose: require('mongoose'), 
    url: require('url'),
    ejs: require('ejs'),
    pager: require(rootpath + 'utils/pager'),
    prettyDate: require(rootpath + 'utils/prettyDate.js'),
    crypto: require(rootpath + 'utils/crypto.js'),
    connect: require('connect'),
    _:require('underscore'),
    async: require('async')
};