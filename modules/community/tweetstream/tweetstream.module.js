var calipso = require("lib/calipso"), http=require("http");      

exports = module.exports = {init: init, route: route, depends: ['content']};

/**
 * Base tag cloud module to create a cloud block
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next,counter) {      
      
      // Wait for the dependencies to be met   
      if(!calipso.socket) {
        
        counter = (counter ? counter : 0) + 1; 
        
        if(counter < 1000) {
          process.nextTick(function() { route(req,res,module,app,next,counter); });  
          return;
        } else {
          calipso.error("Tweetstream couldn't route as dependencies not met.")
          next();
          return;
        }        
      }
  
      res.menu.primary.push({name:'Tweets',url:'/tweets',regexp:/tweets/});
      
      /**
       * Routes
       */            
      module.router.route(req,res,next);
      
};

function init(module,app,next,counter) {      
  
  if(!calipso.modules.content.initialised) {
    // Wait for the dependencies to be met
    process.nextTick(function() { init(module,app,next); });
    return;
  }
  
  // Any pre-route config  
  calipso.lib.step(
      function defineRoutes() {
        module.router.addRoute("GET /tweets",tweetStream,{template:'tweetstream',block:'content'},this.parallel());
        module.router.addRoute("GET /tweets/:keyword",tweetStream,{template:'tweetstream',block:'content'},this.parallel());
      },
      function done() {         

        next();               
      }        
  );    
    
};

function tweetStream(req,res,template,block,next) {     

  // Define our tag clouds
  var USERNAME = "clifcunn";
  var PASSWORD = "Fri3nd123";
  var KEYWORD  = req.moduleParams.keyword ? req.moduleParams.keyword : "calipso";

  var twitter = new (require("twitter-node").TwitterNode)({
    user: USERNAME, 
    password: PASSWORD, 
    track: [ KEYWORD ]
  });
    
  //Set up the tweet stream
  twitter.addListener('tweet', function (tweet) {
    calipso.socket.broadcast(tweet);
  });
  twitter.stream();
  
  calipso.theme.renderItem(req,res,template,block,{keyword:KEYWORD});                     
    
  next();    
  
};