/*******************************************************************************
 * 
 * An expat based feed converter.
 * Takes a url, retrieves the content (assumes it is XML).
 * Parses it with Expat and then converts it to a JSON object.
 * Sends it back.
 * 
 * I used for inspiration / heavily borrowed from in part:
 * 
 * https://github.com/ibrow/node-rss
 * https://github.com/maqr/node-xml2js
 * 
 ******************************************************************************/
var sys = require('sys'),  
    events = require('events'),
    expat = require('node-expat');


var Parser = function() {
  
  // Store our variables
  var that = this;
  var stack = [];
  
  this.resultObject = null;
  this.EXPLICIT_CHARKEY = false; // always use the '#' key, even if there are no subkeys  
  this.CHARKEY = 'text';
  this.ATTRKEY = '@';
  this.cleaner = /[^\x20-\x7E]/
  
  // Create an expat parser
  this.parser = new expat.Parser();
  
  this.parser.addListener('startElement', function(name, attrs) {          
    var obj = {};
    obj[that.CHARKEY] = "";
    for(var key in attrs) {                                  
        if(typeof obj[that.ATTRKEY] === 'undefined') {
            obj[that.ATTRKEY] = {};
        }
        obj[that.ATTRKEY][key] = attrs[key];            
    }
    obj['#name'] = name; // store the node name
    stack.push(obj);
  });
  
  this.parser.addListener('endElement', function(name) {   
    
    var obj = stack.pop();
    var nodeName = name;    
    var s = stack[stack.length-1];

    // remove the '#' key altogether if it's blank
    if(obj[that.CHARKEY].match(/^\s*$/)) {
        delete obj[that.CHARKEY];
    }
    else {
        // turn 2 or more spaces into one space
        obj[that.CHARKEY] = obj[that.CHARKEY].replace(/\s{2,}/g, " ").trim();

        // also do away with '#' key altogether, if there's no subkeys
        // unless EXPLICIT_CHARKEY is set
        if( Object.keys(obj).length == 1 && that.CHARKEY in obj && !(that.EXPLICIT_CHARKEY) ) {
            obj = obj[that.CHARKEY];
        }
    }
    
    // set up the parent element relationship
    if (stack.length > 0) {
        if (typeof s[nodeName] === 'undefined')
            s[nodeName] = obj;
        else if (s[nodeName] instanceof Array)
            s[nodeName].push(obj);
        else {
            var old = s[nodeName];
            s[nodeName] = [old];
            s[nodeName].push(obj);
        }
    } else {
        that.resultObject = obj;
        that.emit("end", that.resultObject);
    }     
  });
  
  this.parser.addListener('text', function(t) {      
    var s = stack[stack.length-1];
    if(s) { 
        // Clean the text of any invalid characters
        t = t.replace(that.cleaner,"");
        s[that.CHARKEY] += t;
    }
  });
  
}

/**
 * parseURL() Parses an RSS feed from a URL.
 * 
 * @param url -
 *          URL of the RSS feed file
 * @param cb -
 *          callback function to be triggered at end of parsing
 * 
 * @TODO - decent error checking
 */
exports.parseURL = function(url, cb) {

        var u = require('url');        
        var parts = u.parse(url);        
      
        if(parts.protocol === 'https:') {
          client = require('https');           
        } else {
          client = require('http');
          if(!parts.port) {
            parts.port = 80;
          }
        }
        
        client.get({ host: parts.hostname, port: parts.port, path: parts.pathname }, function(res) {
          
          var data = '';                    
          res.setEncoding('utf8');

          res.on('data', function(d) {           
            data += d;
          });
          
          res.on('end', function() {                        
            var parser = new Parser();
            parser.addListener('end', function(data) {
                cb(null,data);
            });
            parser.parse(data);            
          });
          
        }).on('error', function(err) {
          cb(err,null);          
        });
        
}

sys.inherits(Parser, events.EventEmitter);
Parser.prototype.parse = function(str) { this.parser.parse(str); };
exports.Parser = Parser;