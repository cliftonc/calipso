/**
 * Example tweet streaming via socket.io (pusher module)
 */
var rootpath = process.cwd(),
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  http = require("http");

exports = module.exports = {
  init: init,
  route: route,
  depends: ["pusher"],
  about: {
    description: 'Uses pusher module and twitter-node nodejs module to demonstrate a live websocket stream of tweets. ',
    author: 'cliftonc',
    version: '0.1.1',
    home: 'http://github.com/cliftonc/calipso'
  }
};


/**
 *Route
 */
function route(req, res, module, app, next, counter) {

  // Wait for the dependencies to be met
  if (!calipso.socket) {

    counter = (counter ? counter : 0) + 1;

    if (counter < 1000) {
      process.nextTick(function() {
        route(req, res, module, app, next, counter);
      });
      return;
    } else {
      calipso.error("Tweetstream couldn't route as dependencies not met.")
      next();
      return;
    }
  }

  // Menu  
  res.menu.primary.addMenuItem({name:'Tweet Stream',path:'tweet-stream',url:'/tweets',description:'Example Socket.IO Tweet Stream ...',security:[]});
  
  // ROute
  module.router.route(req, res, next);

};

/**
 *Init
 */
function init(module, app, next, counter) {

  if (!calipso.modules.content.initialised) {
    // Wait for the dependencies to be met
    process.nextTick(function() {
      init(module, app, next);
    });
    return;
  }

  // Any pre-route config
  calipso.lib.step(

  function defineRoutes() {
    module.router.addRoute("GET /tweets", tweetStream, {
      template: 'tweetstream',
      block: 'content'
    }, this.parallel());
    module.router.addRoute("GET /tweets/:keyword", tweetStream, {
      template: 'tweetstream',
      block: 'content'
    }, this.parallel());
  }, function done() {

    next();
  });

};

/**
 *Tweet stream function, connect to twitter
 */
function tweetStream(req, res, template, block, next) {

  // TODO
  // Replace username password with configuration ...
  var USERNAME = "xxxx";
  var PASSWORD = "xxxx";
  var KEYWORD = req.moduleParams.keyword ? req.moduleParams.keyword : "calipso";

  var twitter = new(require("twitter-node").TwitterNode)({
    user: USERNAME,
    password: PASSWORD,
    track: [KEYWORD]
  });

  //Set up the tweet stream
  twitter.addListener('tweet', function(tweet) {
    calipso.socket.broadcast(tweet);
  });
  twitter.stream();

  calipso.theme.renderItem(req, res, template, block, {
    keyword: KEYWORD
  }, next);

};