var ncms = require("../../lib/ncms"), sys = require('sys'), events = require('events');      

exports = module.exports = {init: init, route: route, jobs: {getFeed:getFeed}};

/**
 * Base feeds module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      

  next();
      
};

function init(module,app,next) {      
  
  next();
    
};

function getFeed(args,next) {
    
  try {
    args = JSON.parse(args);
  } catch(ex) {    
    next(new Error("Invalid arguments: " + args));
    return;  
  }
    
  var url = args.url;
  if(!url) {
     next(new Error("Invalid url: " + url));
     return;
  }
    
  // Allow this only to have local scope
  var feed = require('./lib/feed-expat');  
  
  var response = feed.parseURL(url, function(err,data) {        
          
      if(err) {
          next(err);
          return;
      }
      
      var feedType = data['#name'];
      
      switch (feedType) {
        case "feed":
          processAtom(data,next);
          break;
        case "rss":
          processRss(data,next);
          break;
        default:           
           next(new Error("Unidentified feed type: " + feedType));
      }
      
  });
  
};

/**
 * AtomParser
 * @param data
 * @returns
 */
function AtomParser() {  
  
  var parser = this;  
  this.parse = function(data) {        
    ncms.lib.step(
        function processItems() {
          var group = this.group();
          data.entry.forEach(function(item) {        
            parser.emit("item", item, group);    
          });
        },
        function processItemsDone() {
          parser.emit("done");    
        }        
    )              
  }
  
};

function processAtom(data,next) {
  
  var parser = new AtomParser();
  
  parser.on('item', function(item,next) {
      processAtomItem(item,next);
  });      

  parser.on('done', function(err) {
    next(err);
  });
  
  parser.parse(data);
  
};


/**
 * Process a single atom feed item
 * @param item
 */
function processAtomItem(item,next) {
  
  var Content = ncms.lib.mongoose.model('Content');
  
  var alias = ncms.modules['content'].fn.titleAlias(item.title.text);
    
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
      var c = new Content();    
    }
    
    c.title=item.title.text;
    c.teaser=item.title.text;
    c.content=item.content.text;
    c.tags=[]; 
    c.status='published';
    c.alias = alias;                    
    c.author = "feeds";            
  
    // Asynch save
    c.save(function(err) {
      if(err) {
        next(err);        
      } else {
        next();
      }
    });
    
  });
  
};

/**
 * RSS Parser
 * @param data
 * @returns
 */
var RssParser = function() {
  
  var parser = this;  
  
  this.parse = function(data) {        

    if(data.channel.item) {
      ncms.lib.step(
          function processItems() {
            var group = this.group();
            data.channel.item.forEach(function(item) {        
              parser.emit("item", item, group);    
            });
          },
          function processItemsDone() {
            parser.emit("done");    
          }        
      )
    }
    
  }
  
};

function processRss(data,next) {
  
  var parser = new RssParser();
  
  parser.on('item', function(item,next) {
      processRssItem(item,next);
  });

  parser.on('done', function(err) {
    next();
  });
  
  parser.parse(data);
  
};


function processRssItem(item, next) {
    
  var Content = ncms.lib.mongoose.model('Content');  
  var alias = ncms.modules['content'].fn.titleAlias(item.title.text);
      
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
      var c = new Content();    
    }
    
    c.title=item.title.text;
    c.teaser=item.title.text;
    c.content=item.description.text;  
    c.status='published';
    
    // TODO: How do you cleanly update an array in Mongoosejs???
    if(c.tags) {
      var tags = c.tags;
      tags.forEach(function(v,k) {          
        c.tags.remove(v);
      });      
    } else {
      c.tags = [];  
    }  
    
    if(item.category) {
      //item.category.forEach(function(category) {
      //  c.tags.push(category.text);
      //});        
    }
    
    c.alias = alias;                    
    c.author = "feeds";       
        
    // Asynch save
    c.save(function(err) {
      if(err) {
        next(err);
      } else {
        next();
      }
    });
    
  });

 
};

sys.inherits(AtomParser, events.EventEmitter);
sys.inherits(RssParser, events.EventEmitter);