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
  about: {
    description: 'Module to provide search capabilities via Elastic Search.',
    author: 'cliftonc',
    version: '0.0.1',
    home: 'http://github.com/cliftonc/calipso'
  },
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

  // Router
  module.router.route(req, res, next);
  
};

/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {


  calipso.lib.step(

    function defineRoutes() {
  
      // Route on every page for search
      module.router.addRoute(/.*/, showForm, {block: 'search.form'}, this.parallel());
  
      // Page
      module.router.addRoute('POST /search',search,{block: 'content.search.results',template:'results'},this.parallel());
      module.router.addRoute('GET /search',search,{block: 'content.search.results',template:'results'},this.parallel());

      // ADMIN
      module.router.addRoute('GET /admin/search/reindex',reindex,{admin:true},this.parallel());      
  
    }, function done() {
      
    // COnfigure - need to add to config
    serverOptions = {
        host: 'localhost',
        port: 9200,
    };
    elasticSearchClient = new ElasticSearchClient(serverOptions);    

    // Add a post save hook to content
    var Content = calipso.lib.mongoose.model('Content');
    
    // Save event
    Content.schema.post('save',function() {
      indexContent(this);
    });    
 
    // Remove event (doesn't seem to work)
    Content.schema.post('remove',function() {
      console.dir('REMOVE!');
    });        
    
    next();

  });

};


/**
 * Index an object
 */
function indexContent(content) {
    
    var toIndex = content.toObject();
    
    // Elastic expects all documents to have an id
    toIndex.id = toIndex._id;
    delete toIndex._id;
    
    // Index, content, based on content type
    elasticSearchClient.index('calipso','content', toIndex)
      .on('data', function(data) {
          var result = JSON.parse(data);
          if(!result.ok) {
            calipso.error("Error elastic search indexing: " + result); 
          }
      })
      .exec()
  
}

/**
 * Empty and reindex all content
 * This kicks off and runs in the back ground
 */
function reindex(req, res, template, block, next) {   
 
  // TODO
  
  
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
          
    // Default query shows only public & published items
    var qryObj = {
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
          "Created" : { "date_histogram" : {
                "field" : "created",
                "interval" : "day"
            }
          }
        }
    };                            
          
    // TODO - add paging and faceting
    elasticSearchClient.search('calipso', 'content', qryObj)
        .on('data', function(data) {
            var results = JSON.parse(data);            
            var hits = results.hits.hits ? results.hits.hits : [];
            var facets = results.facets;
            calipso.theme.renderItem(req, res, template, block, {query:query,hits:hits,facets:facets},next);
        })
        .on('error', function(error){              
            res.statusCode = 500;
            res.errorMsg = error;
            next(error);
        })
        .exec()
        
   
};


