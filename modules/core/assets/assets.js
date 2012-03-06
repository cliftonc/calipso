
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),

exports = module.exports = {
  init: init,
  route: route
};

/*
 * Router
 */
function route(req, res, module, app, next) {
  // Menu items
  res.menu.admin.addMenuItem({name:'Asset Management',path:'asset',url:'/asset',description:'Manage assets ...',security:[]});
  res.menu.admin.addMenuItem({name:'Asset',path:'asset/content',url:'/asset',description:'Manage assets ...',security:[]});

  // Routing and Route Handler
  module.router.route(req, res, next);
}


/*
 * Initialisation
 */
function init(module, app, next) {
  // Initialise administration events - enabled for hook.io  
  calipso.e.addEvent('ASSET_UPDATE',{enabled:true,hookio:true}); 

  // Add listener to config_update
  calipso.e.post('ASSET_UPDATE',module.name,calipso.reloadConfig);

  // Admin routes
  calipso.lib.step(
    function defineRoutes() {
      module.router.addRoute('GET /asset', listAssets, {
        template: 'listAdmin',
        block: 'content.list',
        admin: true
      }, this.parallel());
      module.router.addRoute('GET /asset/list.:format?', listAssets,{
        admin:true,
        template:'listAdmin',
        block:'content.list'
      },this.parallel());
      module.router.addRoute('GET /asset/show', getAsset, {
        admin:true
      },this.parallel());
    }, function done() {
      next();
    }
  );
}

function getAsset(req,res,template,block,next) {
  var knox = require('knox').createClient({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret"),
    bucket: calipso.config.get("s3:bucket"),
    endpoint: "s3.amazonaws.com"
  });
  if (req.moduleParams.key[0] == '"')
    req.moduleParams.key = req.moduleParams.key.substring(1, req.moduleParams.key.length - 1);
  var fileName = path.basename(req.moduleParams.key);
  knox.get(req.moduleParams.key).on('response', function(s3res){
    res.setHeader('Content-Disposition', 'Download;FileName=' + fileName);
//    s3res.setEncoding('utf8');
    s3res.on('data', function(chunk){
      res.write(chunk);
    });
    s3res.on('error', function(err){
      res.end(500, {}, "Bad");
    });
    s3res.on('end', function(err) {
      res.end();
    });
  }).end();
}

function listAssets(req,res,template,block,next) {  
  var tag = req.moduleParams.tag ? req.moduleParams.tag : '';
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var sortBy = req.moduleParams.sortBy;

  // TODO : Make this more flexible ...
  var t1 = req.moduleParams.t1 ? req.moduleParams.t1 : '';
  var t2 = req.moduleParams.t2 ? req.moduleParams.t2 : '';
  var t3 = req.moduleParams.t3 ? req.moduleParams.t3 : '';
  var t4 = req.moduleParams.t4 ? req.moduleParams.t4 : '';
  
  //      res.menu.adminToolbar.addMenuItem({name:'Create',weight:1,path:'new',url:'/content/new',description:'Create content ...',security:[]});
  if(req.session.user && req.session.user.isAdmin) {
    // Show all
  } else {
    // Published only if not admin
    query.where('status','published');
  }

  if(tag) {
    res.layout = "tagLanding" // Enable landing page layout to be created for a tag view
    query.where('tags',tag);
  }

  // Taxonomy tags
  var taxonomy = "";
  if(t1) {
    res.layout = t1 + "Landing" // Enable landing page layout to be created for a t1 level;
    taxonomy += t1;
    if(t2) {
      taxonomy += "/" + t2;
      if(t3) {
        taxonomy += "/" + t3;
        if(t4) {
          taxonomy += "/" + t4;
        }
      }
    }
  }

  var params = {req:req,res:res,template:template,block:block,format:format,sortBy:sortBy};

  // Re-retrieve our object
  getAssetList(null,params,next);
};

/**
 * Helper function for link to user
 */
function contentLink(req,content) {
  if (content.IsFile)
    return calipso.link.render({id:content.Key,title:req.t('View {content}',{content:content.Key}),label:content.Key,url:'/asset/show?key=&quot;' + content.Key + '&quot;'});
  else
    return content.Key;
}

function formatSize(req,content) {
  if (content.IsDirectory)
    return "DIR";
  return content.Size;
}

/**
 * Take a query and parameters, return or render content lists
 * This has been refactored so it can be called as a helper (e.g. views)
 * From a theme
 */
function getAssetList(items,out,next) {
  var pager = out.hasOwnProperty('pager') ? out.pager : true;

  // If pager is enabled, ignore any override in from
  var from;
  if (pager) {
    from = out.req.moduleParams.from ? parseInt(out.req.moduleParams.from) - 1 : 0;
  } else {
    var from = out.from ? out.from - 1 : 0;
  }

  var limit = out.limit ? out.limit : (out.req.moduleParams.limit ? parseInt(out.req.moduleParams.limit) : 20);

  var expat = require('node-expat');
  var knox = require('knox').createClient({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret"),
    bucket: calipso.config.get("s3:bucket"),
    endpoint: "s3.amazonaws.com"
  });
  knox.get("").on('response', function(s3res){
    s3res.setEncoding('utf8');
    var parser = new expat.Parser();
    var items = [];
    var item = null;
    var property = null;
    parser.addListener('startElement', function(name, attrs) {
      if (name === 'Contents') {
        item = {};
      } else if (name === 'Key'
        || name === 'LastModified'
        || name === 'ETag'
        || name === 'Size') {
        property = name;
      } else if (name === 'DisplayName')
        property = 'Owner';
    });
    parser.addListener('endElement', function(name) {
      if (name === 'Contents') {
        items.push(item);
        item = null;
      } else if (name === 'ListBucketResult') {
        // Initialise the block based on our content
        var total = items.length;

        items = items.slice(from, from + limit);

        var pagerHtml = "";
        if (pager) {
          pagerHtml = calipso.lib.pager.render(from,limit,total,out.req.url);
        }
        if (out && out.res) {
          // Render the item into the response
          if (out.format === 'html') {
            var table = {id:'asset-list',sort:true,cls:'table-admin',
              columns:[{name:'Key',sort:'Key',label:'Key',fn:contentLink},
                      {name:'Size',label:'Size',fn:formatSize},
                      {name:'Owner',label:'Owner'}
              ],
              data:items,
              view:{
                pager:true,
                from:from,
                limit:limit,
                total:total,
                url:out.req.url,
                sort:calipso.table.parseSort(out.sortBy)
              }
            };

            var tableHtml = calipso.table.render(table,out.req);

            //calipso.theme.renderItem(out.req,out.res,out.template,out.block,{contents:contents, pager: pagerHtml},next);
            calipso.theme.renderItem(out.req, out.res, tableHtml, out.block, null, next);

          }

          if (out.format === 'json') {
            out.res.format = out.format;
            out.res.end(items);
          }

          // This really needs to be pluggable
          // WIP!
          if (out.format === 'rss') {
            // Override the template
            out.res.layout = "rss";
            var newTemplate = calipso.modules["content"].templates["rss"];
            if(newTemplate) {
              calipso.theme.renderItem(out.req, out.res, newTemplate, out.block, {contents:items}, next);
            } else {
              res.statusCode = 404;
              next();
            }
          }
        } else {
          // We are being called as a helper, hence return raw data & the pager.
          var output = {
            contents:items,
            pager:pagerHtml
          }
          next (null,output);
        }
      }
    });
    parser.addListener('text', function(s) {
      if (property) {
        if (property === 'Size') {
          if (/\/$/.test(item.Key))
            item.IsDirectory = true;
          else {
            item.IsFile = true;
          }
          item[property] = s;
        } else
          item[property] = s;
        property = null;
      }
    });
    s3res.on('data', function(chunk){
      parser.parse(chunk);
    });
  }).end();
};
