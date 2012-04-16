/**
 * Setup the bare minimum required for a fully functioning 'calipso' object
 */
var calipso = require('./require')('calipso'),
	path = require('path'),
	fs = require('fs'),
	rootpath = process.cwd() + '/',
	Config = require('./require')('core/Config'),
	http = require('http');

/** 
 * Mock application object
 */

function MockApp(next) {

	var self = this;

	// Configuration - always start with default
	var defaultConfig = path.join(rootpath, 'test', 'helpers', 'defaultConfig.json');

	// Create new
	self.config = new Config({
		env: 'mocha',
		'path': path.join(rootpath, 'tmp'),
		'defaultConfig': defaultConfig
	});

	// Middleware helpers
	self.mwHelpers = {
		staticMiddleware: function() { return {} },
		stylusMiddleware: function() { return {} }
	}

	// Pseudo stack - only middleware that is later overloaded
	self.stack = [{
		handle: {
			name: 'sessionDefault',
			tag: 'session'
		}
	}, {
		handle: {
			name: 'static',
			tag: 'theme.static'
		}
	}, {
		handle: {
			name: 'stylus',
			tag: 'theme.stylus'
		}
	}];

	// Initialise and return
	self.config.init(function (err) {
		next(self);
	})

}

/**
 * Test permissions
 */
calipso.permission.Helper.addPermission("test:permission", "Simple permission for testing purposes.");
calipso.permission.Helper.addPermissionRole("test:permission", "Test");

/**
 * Setup logging
 */
var loggingConfig = {
	"console": {
		"enabled": false,
		"level": "error",
		"timestamp": true,
		"colorize": true
	}
};
calipso.logging.configureLogging(loggingConfig);

/**
 * Request
 */
require('express/lib/request');
require('express/lib/response');

var Request = http.IncomingMessage,
	Response = http.OutgoingMessage;

Request.prototype.t = function (str) {
	return str
};

function CreateRequest(url, method, session) {
	var req = new Request();
	req.method = method || 'GET';
	req.url = url || '/';
	req.session = session || {};
	req.flashMsgs = [];
	req.flash = function (type, msg) {
		req.flashMsgs.push({
			type: type,
			msg: msg
		});
	}
	return req;
}


function CreateResponse() {
	var res = new Response();
	res.redirectQueue = [];
	res.redirect = function (url) {
		res.redirectQueue.push(url);
	}
	return res;
}
/**
 * Default requests and users
 */
var requests = {
	anonUser: CreateRequest('/', 'GET'),
	testUser: CreateRequest('/', 'GET', {
		user: {
			isAdmin: false,
			roles: ['Test']
		}
	}),
	adminUser: CreateRequest('/secured', 'GET', {
		user: {
			isAdmin: true,
			roles: ['Administrator']
		}
	})
}

/**
 * Initialise everything and then export
 */
new MockApp(function (app) {
	module.exports = {
		app: app,
		calipso: calipso,
		testPermit: calipso.permission.Helper.hasPermission("test:permission"),
		requests: requests,
		response: CreateResponse()
	}
})
