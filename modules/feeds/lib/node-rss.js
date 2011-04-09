/**********************************************************************
 node-rss - an RSS parser for node.
 http://github.com/ibrow/node-rss

 Copyright (c) 2010 Rob Searles
 http://www.robsearles.com
 
 node-rss is released under the MIT license
  - see LICENSE for more info

 *********************************************************************
 node-rss makes heavy use of the node-xml module written by 
 Rob Righter - @robrighter
 http://github.com/robrighter/node-xml
**********************************************************************/
var sys = require('sys'), http = require('http');
var xml = require("./node-xml");

// variable for holding the callback function which is passed to the
// exported function. This callback is passed the articles array
var callback = function() {};

// The main "meat" of this module - parses an rss feed and triggers
// the callback when done.
// using node-xml: http://github.com/robrighter/node-xml
var parser = new xml.SaxParser(function(cb) {
  
    var articles = Array();
    var current_element = false;
    var article_count = 0;
    var in_item = false;
    var current_chars = '';


    cb.onStartDocument(function() { });

    // when finished parsing the RSS feed, trigger the callback
    cb.onEndDocument(function() {	    
        callback(articles);
    });


    //track what element we are currently in. If it is an <item> this is
    // an article, add container array to the list of articles
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
	current_element = elem.toLowerCase();
	if(current_element == 'item' || current_element == 'entry') {
	    in_item = true;
	    articles[article_count] = Array();
	}
    });
    // when we are at the end of an element, save its related content
    cb.onEndElementNS(function(elem, prefix, uri) {
	if(in_item) {
	    switch(current_element) 
	    {
	    case 'description':
	    case 'summary':
		articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		break;
	    case 'content':
	    case 'encoded': // feedburner is <content:encoded>, node-xml reads as <encoded>
		current_element = 'content';
		articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		break;
	    case 'link':
	    case 'title':
		articles[article_count][current_element] = current_chars.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		break;
	    }
	    
	    current_element = false;
	    current_chars = '';
	    if(elem.toLowerCase() == 'item' || elem.toString() == 'entry') {
		in_item = false;
		article_count ++;   
	    }
	}
    });
    
    cb.onCharacters(addContent);
    cb.onCdata(addContent);
    function addContent(chars) {
	if(in_item) {
	    current_chars += chars;
	}
    };

    // @TODO handle warnings and errors properly
    cb.onWarning(function(msg) {
	sys.puts('<WARNING>'+msg+"</WARNING>");
    });
    cb.onError(function(msg) {
	sys.puts('<ERROR>'+JSON.stringify(msg)+"</ERROR>");
    });
});


/**
 * parseFile()
 * Parses an RSS feed from a file. 
 * @param file - path to the RSS feed file
 * @param cb - callback function to be triggered at end of parsing
 */
exports.parseFile = function(file, cb) {
    callback = cb;
    parser.parseFile(file);
}
/**
 * parseURL()
 * Parses an RSS feed from a URL. 
 * @param url - URL of the RSS feed file
 * @param cb - callback function to be triggered at end of parsing
 *
 * @TODO - decent error checking
 */
exports.parseURL = function(url, cb) {
    callback = cb;

    get_rss(url);
    function get_rss(url) {
	var u = require('url'), http = require('http');
	var parts = u.parse(url);
	//sys.puts(JSON.stringify(parts));

	// set the default port to 80
	if(!parts.port) { parts.port = 80; }
	

	var redirection_level = 0;
       	var client = http.createClient(parts.port, parts.hostname);
	var request = client.request('GET', parts.pathname, {'host': parts.hostname});
	request.addListener('response', function (response) {
	    //sys.puts('STATUS: ' + response.statusCode);
	    //sys.puts('HEADERS: ' + JSON.stringify(response.headers));

	    // check to see the type of status
	    switch(response.statusCode) {
		// check for ALL OK
	    case 200:
		var body = ''; 
		response.addListener('data', function (chunk) {
		    body += chunk;
		});
		response.addListener('end', function() {
		    // console.log(sys.inspect(body));
		    parser.parseString(body);
		});
		break;
		// redirect status returned
	    case 301:
	    case 302:
		if(redirection_level > 10) {
		    sys.puts("too many redirects");
		}
		else {
		    sys.puts("redirect to "+response.headers.location);
		    get_rss(response.headers.location);
		}
		break;
	    default:
		/*
		response.setEncoding('utf8');
		response.addListener('data', function (chunk) {
		    //sys.puts('BODY: ' + chunk);
		});
*/
		break;
	    }	  
	});
	request.end();	
    }
};