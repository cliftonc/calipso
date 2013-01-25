/**
 * Setup the bare minimum required for a fully functioning 'calipso' object
 */
var calipso = require('./require')('calipso'),
  Config = require('./require')('core/Configuration'),
  path = require('path'),
  fs = require('fs'),
  colors = require('colors'),
  rootpath = process.cwd() + '/',
  http = require('http'),
  mochaConfig = path.join(rootpath, 'tmp', 'mocha.json');

// Create the tmp folder if it doesnt' exist
try {
  fs.mkdirSync(path.join(rootpath, 'tmp'))
} catch (ex) {
}
;

/**
 * Mock application object
 */
function MockApp(next) {

  var self = this;

  // Configuration - always start with default
  var defaultConfig = path.join(rootpath, 'test', 'helpers', 'defaultConfig.json');

  var statusMsg = '\r\nBase path: '.grey + rootpath.cyan + '\r\nUsing config: '.grey + defaultConfig.cyan + '\r\nIn environment: '.grey + (process.env.NODE_ENV || 'development').cyan;
  if (!process.env.CALIPSO_COV) {
    console.log(statusMsg);
  }

  // Always delete any left over config
  try {
    fs.unlinkSync(mochaConfig);
  } catch (ex) { /** ignore **/
  }

  // Create new
  self.config = new Config({
    'env':'mocha',
    'path':path.join(rootpath, 'tmp'),
    'defaultConfig':defaultConfig
  });

  // Middleware helpers
  self.mwHelpers = {
    staticMiddleware:function () {
      return {}
    },
    stylusMiddleware:function () {
      return {}
    }
  }

  // Pseudo stack - only middleware that is later overloaded
  self.stack = [
    {
      handle:{
        name:'sessionDefault',
        tag:'session'
      }
    },
    {
      handle:{
        name:'static',
        tag:'theme.static'
      }
    },
    {
      handle:{
        name:'stylus',
        tag:'theme.stylus'
      }
    }
  ];

  // Initialise and return
  self.config.init(function (err) {

    if (err) {
      console.log('Config error: '.grey + err.message.red);
    }
    if (!process.env.CALIPSO_COV) {
      console.log('Config loaded: '.grey + self.config.file.cyan);
    }
    next(self);

  })

}

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
      type:type,
      msg:msg
    });
  }
  return req;
}


function CreateResponse() {
  var res = new Response();
  res.redirectQueue = [];
  res.redirect = function (url) {
    res.redirectQueue.push(url);
    res.finished = false;
  }
  res.end = function (content, type) {
    res.body = content;
  }
  res.send = function (content) {
    res.body = content;
  }
  return res;
}
/**
 * Default requests and users
 */
var requests = {
  anonUser:CreateRequest('/', 'GET'),
  testUser:CreateRequest('/', 'GET', {
    user:{
      isAdmin:false,
      roles:['Test']
    }
  }),
  adminUser:CreateRequest('/secured', 'GET', {
    user:{
      isAdmin:true,
      roles:['Administrator']
    }
  })
}

/**
 * Initialise everything and then export
 */
module.exports.finalize = function (next) {
  if (module.exports.app) {
    return next(null, module.exports);
  }
  new MockApp(function (app) {
    module.exports.app = app;
    module.exports.calipso = calipso;
    module.exports.testPermit = calipso.permission.Helper.hasPermission("test:permission"),
      module.exports.requests = requests;
    module.exports.response = CreateResponse();

    /**
     * Test permissions
     */
    calipso.permission.Helper.addPermission("test:permission", "Simple permission for testing purposes.");
    calipso.permission.Helper.addPermissionRole("test:permission", "Test");

    /**
     * Setup logging
     */
    var loggingConfig = {
      "console":{
        "enabled":false,
        "level":"error",
        "timestamp":true,
        "colorize":true
      }
    };
    
    calipso.logging.configureLogging(loggingConfig);
    next(null, module.exports);
  });
};
