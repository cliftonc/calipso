/**
 * Elastic search module
 * Provides search capabilities automatically to all content types.
 * Relies on : https://github.com/phillro/node-elasticsearch-client
 */
 
var calipso = require('lib/calipso'),
    ElasticSearchClient = require('elasticsearchclient');

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,  
  depends:["content","contentTypes"]
};

/**
 * Globals in this module
 */
var elasticSearchClient, serverOptions;

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  
  res.menu.admin.addMenuItem({name:'Search',path:'cms/search',url:'#',description:'Search ...',security:[]});
  res.menu.admin.addMenuItem({name:'Configure Search',weight:1,path:'cms/search/configure',url:'/admin/search/configure',description:'Configure Search ...',security:[]});
  res.menu.admin.addMenuItem({name:'Reindex Content',weight:2,path:'cms/search/reindex',url:'/admin/search/reindex',description:'Reindex content ...',security:[]});
  res.menu.admin.addMenuItem({name:'Clear Index',weight:3,path:'cms/search/clearindex',url:'/admin/search/clearindex',description:'Clear content index ...',security:[]});

  // Router
  module.router.route(req, res, next);
  
};

/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {

  // Register for events  
  calipso.e.post('CONTENT_CREATE',module.name,indexContent);
  calipso.e.post('CONTENT_UPDATE',module.name,indexContent);  
  calipso.e.post('CONTENT_DELETE',module.name,removeContent);
  
  // Register events
  calipso.e.addEvent('CONTENT_INDEX');
  calipso.e.addEvent('CONTENT_REMOVE_INDEX');  
  
  // Do the init
  calipso.lib.step(

    function defineRoutes() {
  
      // Route on every page for search
      module.router.addRoute(/.*/, showForm, {block: 'search.form'}, this.parallel());
  
      // Page
      module.router.addRoute('POST /search',search,{block: 'content.search.results',template:'results'},this.parallel());
      module.router.addRoute('GET /search',search,{block: 'content.search.results',template:'results'},this.parallel());

      // ADMIN
      module.router.addRoute('GET /admin/search/reindex',reindex,{admin:true},this.parallel());      
      module.router.addRoute('GET /admin/search/clearindex',clearIndex,{admin:true},this.parallel());      

  
    }, function done() {
      
    // COnfigure - need to add to config
    serverOptions = {
        host: 'localhost',
        port: 9200,
    };
    connectAndMonitor(serverOptions);
    
    next();

  });

};


/**
 *  Connect to a server, maintain the connection by monitoring server status
 */
function connectAndMonitor(serverOptions) {
  
  // Create client
  elasticSearchClient = new ElasticSearchClient(serverOptions);  

}

/**
 * Index an object
 */
function indexContent(event,content,next) {
    
  var toIndex = content.toObject();

  // Elastic expects all documents to have an id
  toIndex.id = toIndex._id;
  delete toIndex._id;
  
  calipso.e.pre_emit('CONTENT_INDEX',content);
  
  // Index, content, based on content type
  elasticSearchClient.index('calipso','content', toIndex)
    .on('data', function(data) {
        var result = JSON.parse(data);
        if(!result.ok) {
          calipso.e.post_emit('CONTENT_INDEX',content);
          calipso.error("Error elastic search indexing: " + result); 
        }
    })
    .exec()

  return next();
    
}

/**
 * Remove a single object
 */
function removeContent(content) {      
  
  // Remove
  calipso.e.pre_emit('CONTENT_REMOVE_INDEX',content);
  elasticSearchClient.deleteDocument('calipso', 'content', content._id)
    .on('data',
    function(data) {
        var result = JSON.parse(data);
        if(!result.ok) {
          calipso.e.post_emit('CONTENT_REMOVE_INDEX',content);
          calipso.error("Error elastic search removing: " + result); 
        }
    }).exec();
      
}

/**
 * Empty and reindex all content
 * This kicks off and runs in the back ground
 */
function reindex(req, res, template, block, next) {   

  var Content = calipso.lib.mongoose.model('Content');

  // Clear down the existing index
  var qryObj = {"match_all" : {}};
  
  // Index
  elasticSearchClient.deleteByQuery('calipso', 'content', qryObj)
    .on('data', function(data) {
        var result = JSON.parse(data);
        if(result.ok) {
                     
         // Select all content                
         Content.count({}, function (err, count) {
  
          var total = count;
          calipso.log("Reindexing " + total + " documents ...");
  
          Content.find({},function (err, contents) {
            
              contents.forEach(function(item) {
                 indexContent(item);
              });                          
              
              req.flash('info',req.t('Re-indexing {msg} content items ... this may take some time!',{msg:total}));
              next();
              
          });
          
        });
         
      }
         
    })
    .on('error',function(error) {
        calipso.error(error);
    })
    .exec()  
  
};

/**
 * Empty search index completely 
 */
function clearIndex(req, res, template, block, next) {   

    var Content = calipso.lib.mongoose.model('Content');

    // Clear down the existing index
    var qryObj = {"match_all" : {}};
    
    // Index
    elasticSearchClient.deleteByQuery('calipso', 'content', qryObj)
      .on('data', function(data) {
          var result = JSON.parse(data);
          if(result.ok) {             
             req.flash('info',req.t("Calipso / content index being cleared ..."));
             res.redirect("/");
             next();
          } else {
             req.flash('error',req.t("There was an error clearing the index ..."));
             res.redirect("/");
             next();
          }
      })      
      .on('error',function(error) {
          calipso.error(error);
      })
      .exec()  
      
};

/**
 * Search form
 */
var searchForm = {
  id:'search-form',cls:'search',title:'',enctype:'application/x-www-form-urlencoded',method:'GET',action:'/search',
  fields:[
    {label:'', name:'query', type:'text'}
  ],
  buttons:[
    {name:'search', type:'submit', value:'Search'}
  ]
};

/**
 * Search block on every page
 */
function showForm(req, res, template, block, next) {   
   
  var query = req.moduleParams.query || "";

  var values = {query:query};
  
  calipso.form.render(searchForm, values, req, function(form) {
      calipso.theme.renderItem(req, res, form, block, {}, next);    
  });
  
};

/**
 * Search results
 */
function search(req, res, template, block, next) {
      
    var query = req.moduleParams.query || "*";    
    var from = req.moduleParams.from ? parseInt(req.moduleParams.from) - 1 : 0;
    var limit = req.moduleParams.from ? parseInt(req.moduleParams.limit) : 10;          
        
    // Default query shows only public & published items
    var qryObj = {
        "from" : from, "size" : limit,
        "query" : { "query_string" : {"query" : query} },
        "filter" : {
          "term" : {
            "status":"published",
            "ispublic":true
          }
        },
        "facets" : {
          "Tags" : { "terms" : {"field" : "tags"} },
          "Type" : { "terms" : {"field" : "contentType"} },
          "Status" : { "terms" : {"field" : "status"} },          
          "Created" : { "date_histogram" : {
                "field" : "created",
                "interval" : "month"
            }
          }
        }
    };                            
          
    // TODO - add paging and faceting
    elasticSearchClient.search('calipso', 'content', qryObj)
        .on('data', function(data) {

            var results = JSON.parse(data);
            
            if(results.hits && results.hits.total) {
                          
              var total = results.hits.total;
              var hits = results.hits.hits ? results.hits.hits : [];
              var facets = results.facets;            
              var pagerHtml = calipso.lib.pager.render(from,limit,total,req.url);            
  
              calipso.theme.renderItem(req, res, template, block, {query:query,hits:hits,facets:facets,pager:pagerHtml},next);

            } else {
              res.statusCode = 500;
              res.errorMsg = "Error executing search: " + results;
              next();
            }
        })
        .on('error', function(error){              
            res.statusCode = 500;
            res.errorMsg = error;
            next();
        })
        .exec()
         
};
