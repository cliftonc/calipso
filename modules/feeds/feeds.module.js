var calipso = require("../../lib/calipso"), sys = require('sys'), events = require('events');      

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
  
  var taxonomy = args.taxonomy ? args.taxonomy : "feeds";
  var contentType = args.contentType ? args.contentType : "Article";
  
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
          processAtom(data,taxonomy,contentType,next);
          break;
        case "rss":
          processRss(data,taxonomy,contentType,next);
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
  this.parse = function(data,taxonomy,contentType) {        
    calipso.lib.step(
        function processItems() {
          var group = this.group();
          data.entry.forEach(function(item) {        
            parser.emit("item", item, taxonomy, contentType, group);    
          });
        },
        function processItemsDone() {
          parser.emit("done");    
        }        
    )              
  }
  
};

function processAtom(data,taxonomy,contentType, next) {
  
  var parser = new AtomParser();
  
  parser.on('item', function(item,taxonomy,contentType, next) {
      processAtomItem(item,taxonomy,contentType, next);
  });      

  parser.on('done', function(err) {
    next(err);
  });
  
  parser.parse(data,taxonomy, contentType);
  
};


/**
 * Process a single atom feed item
 * @param item
 */
function processAtomItem(item,taxonomy,contentType, next) {
  
  var Content = calipso.lib.mongoose.model('Content');
  var ContentType = calipso.lib.mongoose.model('ContentType');
  
  var alias = calipso.modules['content'].fn.titleAlias(item.title.text);
    
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
      var c = new Content();    
    
      c.title=item.title.text;
      c.teaser=item.title.text;
      c.content=item.content.text;
      c.tags=[]; 
      c.status='published';
      c.alias = alias;                    
      c.author = "feeds";    
      c.taxonomy = taxonomy;
      
      if(item.updated.text) {
        c.updated=new Date(item.updated.text);
        c.created=new Date(item.updated.text);        
      }     
      
      // Get content type        
      ContentType.findOne({contentType:contentType}, function(err, contentType) {
                
          if(err || !contentType) {        

            next(err);             
            
          } else {
            
            // Copy over content type data            
            c.meta.contentType = contentType.contentType;
            c.meta.layout = contentType.layout;
            c.meta.ispublic = contentType.ispublic;            
                          
            // Asynch save
            c.save(function(err) {
              if(err) {
                next(err);
              } else {
                next();
              }
            });
         }
          
      });
      
    }
  });
  
};

/**
 * RSS Parser
 * @param data
 * @returns
 */
var RssParser = function() {
  
  var parser = this;  
  
  this.parse = function(data,taxonomy,contentType) {        

    if(data.channel.item) {
      calipso.lib.step(
          function processItems() {
            var group = this.group();
            data.channel.item.forEach(function(item) {        
              parser.emit("item", item, taxonomy,contentType, group);    
            });
          },
          function processItemsDone() {
            parser.emit("done");    
          }        
      )
    }
    
  }
  
};

function processRss(data,taxonomy,contentType,next) {
  
  var parser = new RssParser();
  
  parser.on('item', function(item,taxonomy,contentType,next) {
      processRssItem(item,taxonomy,contentType,next);
  });

  parser.on('done', function(err) {
    next();
  });
  
  parser.parse(data,taxonomy,contentType);
  
};


function processRssItem(item,taxonomy,contentType, next) {
    
  var Content = calipso.lib.mongoose.model('Content');
  var ContentType = calipso.lib.mongoose.model('ContentType');

  var alias = calipso.modules['content'].fn.titleAlias(item.title.text);
      
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
    
      var c = new Content();        
      
      c.title=item.title.text;
      
      if(item['content:encoded']) {        
        c.teaser=item.description.text;
        c.content=item['content:encoded'].text;
      } else {
        c.teaser=item.title.text;
        c.content=item.description.text;  
      }      
      
      c.status='published';
      c.taxonomy=taxonomy; // TODO : Pass through
      
      if(item.category) {                
        try { 
          item.category.forEach(function(category) {
            c.tags.push(category.text);
          });  
        } catch(e) {
          calipso.error("Error parsing RSS Feed: " + e.message);
        }                
      }
      
      c.alias = alias;                    
      c.author = "feeds";       
    
      if(item.pubDate.text) {
        c.updated=new Date(item.pubDate.text);
        c.created=new Date(item.pubDate.text);
        c.published=new Date(item.pubDate.text);
      }           

      // Get content type        
      ContentType.findOne({contentType:contentType}, function(err, contentType) {
                
          if(err || !contentType) {        

            next(err);             
            
          } else {
            
            // Copy over content type data            
            c.meta.contentType = contentType.contentType;
            c.meta.layout = contentType.layout;
            c.meta.ispublic = contentType.ispublic;            
                          
            // Asynch save
            c.save(function(err) {
              if(err) {
                next(err);
              } else {
                next();
              }
            });
         }
      });
      
    }
    
  });

 
};

sys.inherits(AtomParser, events.EventEmitter);
sys.inherits(RssParser, events.EventEmitter);