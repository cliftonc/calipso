/**
 * Base feeds module
 */
var calipso = require("lib/calipso"), sys = require('sys'), events = require('events');

exports = module.exports = {
  init: init,
  route: route,
  jobs: {getFeed:getFeed} 
};

/**
 * Router
 */
function route(req,res,module,app,next) {
  // this module has no routes - this is pattern
  next(null,module.name);
};

/**
 * Initialisation
 */
function init(module,app,next) {
  next();
};

/**
 * Feeds job function
 * Expects argument of a json object, of the structure:
 *
 *     {"url":"url","taxonomy":"taxonomy","contentType":"contentType"}
 *
 * These arguments cover:
 *
 *   - url : the url to retrieve the feed from
 *   - taxonomy : the taxonomy to create any new content items against (e.g. news/local)
 *   - contentType : the content type to create the content as
 *
 */
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
  var feed = require('./feeds.expat');

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

/**
 * Register event handler for AtomParser
 */
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
 */
function processAtomItem(item,taxonomy,contentType, next) {
  
  var Content = calipso.lib.mongoose.model('Content');
  var ContentType = calipso.lib.mongoose.model('ContentType');

  var alias = calipso.modules['content'].fn.titleAlias(item.title.text);

  Content.findOne({alias:alias},function (err, c) {
      
    if(!c) {
      
      var c = new Content();

      // This is a fixed mapping
      // TODO : Make this configurable so you can map a feed
      // to dynamic properties of a content item
      c.title=item.title.text;
      c.teaser=item.title.text;
      c.content=item.content.text;
      c.tags=[];
      c.status='published';
      c.alias = alias;
      c.author = item.author.name.text || 'feeds';
      c.taxonomy = taxonomy;
      
      // Extension fields (hack for github) - to fix later
      c.set('githubLink',item.link['@'].href);
      c.set('githubImage',item['media:thumbnail']['@'].url);
      c.set('githubAuthorLink',item.author.uri.text);

      if(item.updated.text) {
        c.updated=new Date(item.updated.text);
        c.created=new Date(item.updated.text);
        c.published=new Date(item.updated.text);
      }
      
      // Get content type
      ContentType.findOne({contentType:contentType}, function(err, ct) {
          
          if(err || !ct) {

            next(err);

          } else {

            // Copy over content type data
            c.contentType = ct.contentType;
            c.layout = ct.layout;
            c.ispublic = ct.ispublic;

            // Asynch save
            c.save(function(err) {
              if(err) {
                next(err);
              } else {
                calipso.silly("Added ATOM record: " + c.title + " of type: " + c.contentType);
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

/**
 * Event handler for rss processing
 */
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


/**
 * Process single RSS item
 */
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
      ContentType.findOne({contentType:contentType}, function(err, ct) {

          if(err || !ct) {

            next(err);

          } else {

            // Copy over content type data
            c.contentType = ct.contentType;
            c.layout = ct.layout;
            c.ispublic = ct.ispublic;

            // Asynch save
            c.save(function(err) {
              if(err) {
                next(err);
              } else {
                calipso.silly("Added ATOM record: " + c.title + " of type: " + c.contentType);
                next();
              }
            });
         }
      });

    }

  });


};

/**
 * Parsers are event emitters
 */
sys.inherits(AtomParser, events.EventEmitter);
sys.inherits(RssParser, events.EventEmitter);