/**
 * Setup the bare minimum required for a fully functioning 'calipso' object
 */
var calipso = require('./require')('calipso'),
	http = require('http');

// Include the express 
require('express/lib/request');
require('express/lib/response');

var Request = http.IncomingMessage,
	Response = http.OutgoingMessage;

/**
 * Test permissions
 */
calipso.permission.Helper.addPermission("test:permission","Simple permission for testing purposes.");
calipso.permission.Helper.addPermissionRole("test:permission","Test");

/**
 * Setup logging
 */
var loggingConfig = {"console": {
      "enabled": false,
      "level": "error",
      "timestamp": true,
      "colorize": true
    }};
calipso.logging.configureLogging(loggingConfig);

/**
 * Request 
 */
Request.prototype.t = function(str) { return str };

/**
 * Request helper
 */
function CreateRequest(url, session) {
	var req = new Request();
	req.url = url || '/';
	req.session = session || {};
	return req;
}

/**
 * Default requests and users
 */
var requests = {
	anonUser: CreateRequest('/'),
	testUser: CreateRequest('/', {user: {isAdmin: false, roles: ['Test']}}),
	adminUser: CreateRequest('/', {user: {isAdmin: true, roles: ['Administrator']}})
}

/**
 * Export all our helpers
 */
module.exports = {
  calipso: calipso,
  testPermit: calipso.permission.Helper.hasPermission("test:permission"),
  requests: requests,
  response: new Response()
}