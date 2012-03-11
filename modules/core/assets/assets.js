
var rootpath = process.cwd() + '/',
  path = require('path'),
  Query = require("mongoose").Query,
  mime = require('mime'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  parse = require('url').parse;

exports = module.exports = {
  init: init,
  route: route,
  assetForm: assetForm
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

function handleAsset(req, res, next) {
  var maxAge = 0
    , ranges = req.headers.range
    , head = 'HEAD' == req.method
    , get = 'GET' == req.method
    , done;

  // ignore non-GET requests
  if (!get && !head) return next();

  // parse url
  var url = parse(req.url)
    , pt = decodeURIComponent(url.pathname)
    , type;

  if (!/^\/assets\/show\/.*/.test(pt)) return next();
  
  // join / normalize from optional root dir
  var Asset = calipso.lib.mongoose.model('Asset');
  var s = pt.split('\/');
  s.splice(0, 3); // remove assets/show
  var bucket = s.splice(0, 1)[0];
  pt = s.join('/');
  Asset.findOne({alias:bucket,isbucket:true}, function(err, bucket) {
    if(err || !bucket.isbucket || bucket.isfolder) {
      res.statusCode = 404;
      next();
      return;
    }
    Asset.findOne({alias:pt,bucket:bucket._id}, function(err, asset) {
      if(err || asset.isbucket || asset.isfolder) {
        res.statusCode = 404;
        next();
        return;
      }
      var knox = require('knox').createClient({
        key: calipso.config.get("s3:key"),
        secret: calipso.config.get("s3:secret"),
        bucket: bucket.alias,
        endpoint: "s3.amazonaws.com"
      });
      var fileName = path.basename(asset.alias);
      var contentType = mime.lookup(fileName);
      var range = req.header['Range'];
      var headers = {'response-content-type':contentType};
      if (range)
        headers['Range'] = range;
      knox.get(escape(asset.alias), headers).on('response', function(s3res) {
        var buffer = new Buffer(0);
        if (req.url.substring(req.url.length - fileName.length) !== fileName)
          res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
        if(req.session.user){
          if(!req.cookies.userData){
            res.cookie('userData', JSON.stringify(req.session.user));
          }
        } else {
          res.clearCookie('userData');
        }
        for (var v in s3res.headers) {
          if (/x-amz/.test(v))
            continue;
          res.setHeader(v, s3res.headers[v]);
        }
        res.statusCode = 200;
        s3res.pipe(res);
      }).end();        // Just return the object
    });
  });
}

/*
 * Initialisation
 */
function init(module, app, next) {
  // Initialise administration events - enabled for hook.io  
  calipso.e.addEvent('ASSET_UPDATE',{enabled:true,hookio:true}); 
  calipso.e.addEvent('ASSET_UPDATE_FORM', {enabled:true,hookio:true});
  calipso.e.addEvent('ASSET_CREATE_FORM',{enabled:true,hookio:true});
  calipso.e.addEvent('ASSET_CREATE',{enabled:true,hookio:true});
  // Add listener to config_update
  calipso.e.post('ASSET_UPDATE',module.name,calipso.reloadConfig);

  // Admin routes
  calipso.lib.step(
    function defineRoutes() {
      calipso.app.stack.forEach(function(middleware,key) {
        if (middleware.handle.tag === 'assets') {
          middleware.handle = handleAsset;
        }
      });
      // Admin operations
      module.router.addRoute('POST /asset',createAsset,{admin:true},this.parallel());
      module.router.addRoute('GET /assets/new',createAssetForm,{admin:true,block:'content.create'},this.parallel());
      module.router.addRoute('GET /asset/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?.:format?', listAssets, {
        template: 'listAdmin',
        block: 'content.list',
        admin: true
      }, this.parallel());
      //module.router.addRoute('GET /assets/show/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?',showAliasedAsset,{admin:true},this.parallel());
      module.router.addRoute('GET /assets/:id',editAssetForm,{admin:true,block:'content.edit'},this.parallel());
      module.router.addRoute('GET /assets/delete/:id',deleteAsset,{admin:true},this.parallel());
      module.router.addRoute('POST /assets/:id',updateAsset,{admin:true},this.parallel());
      module.router.addRoute('GET /assets/list.:format?', listAssets,{
        admin:true,
        template:'listAdmin',
        block:'content.list'
      },this.parallel());

    }, function done() {
      // Add dynamic helpers
      calipso.dynamicHelpers.getAsset = function() {
        return getAsset;
      }

      // Get asset list helper
      calipso.dynamicHelpers.getAssetList = function() {
        return getAssetList;
      }

      // Default Asset Schema
      var Asset = new calipso.lib.mongoose.Schema({
        title:{type: String, required: true, "default": ''},
        description:{type: String, required: false, "default": ''},
        taxonomy:{type: String, "default":''},
        bucket:{type: calipso.lib.mongoose.Schema.ObjectId, ref: 'Asset', required: false},
        key: {type: String, required: false, "default": ''},
        isbucket:{type: Boolean, "default":false},
        folder:{type: calipso.lib.mongoose.Schema.ObjectId, ref: 'Asset', required: false},
        isfolder:{type: Boolean, "default":false},
        alias:{type: String, required: true, index: true},
        author:{type: String, required: true},
        etag:{type: String, "default":''},
        tags:[String],
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now },
        ispublic:{type: Boolean, index: true},    // Copy from content type
        issource:{type: Boolean, "default":false, required:true}
      });

      // Set post hook to enable simple etag generation
      Asset.pre('save', function (next) {
        this.etag = calipso.lib.crypto.etag(this.title + this.description + this.bucket + this.key);
        next();
      });

      calipso.lib.mongoose.model('Asset', Asset);

      module.initialised = true;

      next();
    }
  );
}

function getAsset(req,options,next) {
  var path = [];
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i])
      path.push(req.moduleParams['f' + i]);
  }
  var bucket = "";
  if (path.length > 0) {
    bucket = path.splice(0, 1)[0];
    path = path.join('/');
  } else
    path = "";

  // Check to see if we just want content property by alias
  if(typeof options === "string") {
    options = {alias:options, property:"asset", clickCreate:true, clickEdit:true};
  } else {
    var defaults = {alias:'', property:"", clickCreate:true, clickEdit:true};
    options = calipso.lib._.extend(defaults, options);
  }

  var Asset = calipso.lib.mongoose.model('Asset');

  Asset.findOne({alias:options.alias}).populate('bucket').run(function (err, c) {
    if(err || !c) {
      var text;
      if(options.clickCreate) {
        text = "<a title='" + req.t("Click to create") + " ...' href='/assets/new?" +
        "type=Block%20Content" +
        "&alias=" + options.alias +
        "&description=Content%20for%20" + options.alias +
        "&returnTo=" + req.url +
        "'>" + req.t("Click to create asset with alias: {alias} ...",{alias: options.alias}) + "</a>";
      } else {
        text = req.t("Asset with alias {alias} not found ...",{alias: options.alias});
      }
      // Don't throw error, just pass back failure.
      next(null,text);
    } else {
      if(options.property) {
        var text = c.get(options.property) || req.t("Invalid content property: {property}",{property:options.property});
        if(options.clickEdit && req.session && req.session.user && req.session.user.isAdmin) {
          text = "<span title='" + req.t("Double click to edit content block ...") + "' class='content-block' id='" + c._id + "'>" +
          text + "</span>";
        }
        next(null, text);
      } else {
        var knox = require('knox').createClient({
          key: calipso.config.get("s3:key"),
          secret: calipso.config.get("s3:secret"),
          bucket: calipso.config.get("s3:bucket"),
          endpoint: "s3.amazonaws.com"
        });
        if (req.moduleParams.key[0] == '"')
          req.moduleParams.key = req.moduleParams.key.substring(1, req.moduleParams.key.length - 1);
        var fileName = path.basename(req.moduleParams.key);
        knox.get(req.moduleParams.key).on('response', function(s3res) {
          var buffer = new Buffer('');
          res.setHeader('Content-Disposition', 'Download;FileName=' + fileName);
      //    s3res.setEncoding('utf8');
          s3res.on('data', function(chunk){
            buffer += chunk;
          });
          s3res.on('error', function(err){
            next(err, null);
          });
          s3res.on('end', function(err) {
            next(null, buffer);
          });
        }).end();        // Just return the object
      }
    }
  });
}

function assetForm(asset) {
  var url = "";
  if (asset && !asset.isfolder && !asset.isbucket) {
    url = '</br><h5>/assets/show/' + asset.bucket.alias + '/' + asset.alias + '</h5>';
  }
      return {id:'content-form',title:'Create Content ...',type:'form',method:'POST',action:'/assets',tabs:true,
          sections:[{
            id:'form-section-content',
            label:'Content',
            fields:[
                    {label:'Title',name:'asset[title]',type:'text',description:'Title to appear for this piece of content.' + url},
                    {label:'Description',name:'asset[description]',type:'textarea',description:'Enter some short text that describes the content, appears in lists.'},
                   ]
          },{
            id:'form-section-category',
            label:'Categorisation',
            fields:[
                    {label:'Taxonomy',name:'asset[taxonomy]',type:'text',description:'Enter the menu heirarchy, e.g. "welcome/about"'},
                    {label:'Tags',name:'asset[tags]',type:'text',description:'Enter comma delimited tags to help manage this content.'},
                   ]
          }
          ],
          fields:[
            {label:'',name:'returnTo',type:'hidden'}
          ],
          buttons:[
               {name:'submit',type:'submit',value:'Save Content'},
               {name:'cancel',type:'button',href:'/asset', value:'Cancel'}
          ]};
}

/**
 * Default home page, only specify the layout.
 */
function homePage(req,res,template,block,next) {
    res.layout = "home";
    next();
}

/**
 * Create content - processed after create form submission.
 */
function createAsset(req,res,template,block,next) {

  calipso.form.process(req,function(form) {

    if(form) {

          var Asset = calipso.lib.mongoose.model('Asset');

          var c = new Asset(form.asset);

          c.alias = c.alias ? c.alias : titleAlias(c.title);
          c.tags = form.content.tags ? form.content.tags.split(",") : [];
          c.author = req.session.user.username;

          var returnTo = form.returnTo ? form.returnTo : "";

          // Emit event pre-save, this DOES NOT Allow you to change
          // The content item (yet).
          calipso.e.pre_emit('ASSET_CREATE',c,function(c) {
            c.save(function(err) {
              if(err) {
                calipso.debug(err);
                // TODO : err.errors is an object that contains actual fields, can pass back actual errors
                // To the form
                req.flash('error',req.t('Could not save asset because {msg}.',{msg:err.message}));
                if(res.statusCode != 302) {
                    res.redirect('/assets/new?type='+form.content.contentType);
                }
                next();
              } else {
                req.flash('info',req.t('Content saved.'));

                // Raise CONTENT_CREATE event
                calipso.e.post_emit('ASSET_CREATE',c,function(c) {

                  if(returnTo) {
                    res.redirect(returnTo);
                  } else {
                    res.redirect('/assets/show/' + c._id);
                  }
                  next();
                });

              }

            });
         });
      }
  });
}

/**
 * Enable creation of the title alias based on the title.
 * TODO : Turn into a setter??
 * @param title
 * @returns
 */
function titleAlias(title) {
  return title
    .toLowerCase() // change everything to lowercase
    .replace(/^\s+|\s+$/g, "") // trim leading and trailing spaces
    .replace(/[_|\s]+/g, "-") // change all spaces and underscores to a hyphen
    .replace(/[^a-z\u0400-\u04FF0-9-]+/g, "") // remove all non-cyrillic, non-numeric characters except the hyphen
    .replace(/[-]+/g, "-") // replace multiple instances of the hyphen with a single instance
    .replace(/^-+|-+$/g, "") // trim leading and trailing hyphens
    .replace(/[-]+/g, "-")
}

/**
 * Create the form based on the fields defined in the content type
 * Enable switching of title etc. from create to edit
 */
function getForm(req,action,title,asset,next) {

  // Create the form
  var form = exports.assetForm(asset); // Use exports as other modules may alter the form function
  form.action = action;
  form.title = title;

  // Add any fields
  // Process any additional fields
  form = calipso.form.processFields(form,[]);

  next(form);
}

/**
 * Create Content Form
 * Create and render the 'New Content' page.
 * This allows some defaults to be passed through (e.g. from missing blocks).
 */
function createAssetForm(req,res,template,block,next) {

  var type = req.moduleParams.type ? req.moduleParams.type : "Article";         // Hard coded default TODO fix

  // Allow defaults to be passed in
  var alias = req.moduleParams.alias ? req.moduleParams.alias : "";
  var description = req.moduleParams.description ? req.moduleParams.description : "";
  var taxonomy = req.moduleParams.taxonomy ? req.moduleParams.taxonomy : "";
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  // Create the form
  getForm(req,"/asset",req.t("Create Bucket ..."),null,function(form) {

    // Default values
    var values = {
        asset: {
          title:alias,  // Default the title to the alias
          alias:alias,
          description:description,
          taxonomy:taxonomy,
          returnTo: returnTo
        }
    }

    res.layout = 'admin';

    calipso.e.pre_emit('ASSET_CREATE_FORM',form,function(form) {
      calipso.form.render(form,values,req,function(form) {
          calipso.theme.renderItem(req,res,form,block,{},next);
      });
    });
  });

}


/**
 * Edit Content Form
 * Edit an existing piece of asset.
 */
function editAssetForm(req,res,template,block,next) {

  var Asset = calipso.lib.mongoose.model('Asset');
  var id = req.moduleParams.id;
  var item;

  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  res.menu.adminToolbar.addMenuItem({name:'List',weight:1,path:'list',url:'/asset/',description:'List all ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'View',weight:2,path:'show',url:'/assets/show/' + id,description:'Download actual file ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Edit',weight:3,path:'edit',url:'/assets/' + id,description:'Edit asset ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Delete',weight:4,path:'delete',url:'/assets/delete/' + id,description:'Delete asset ...',security:[]});


  Asset.findById(id).populate('bucket').run(function(err, c) {

    if(err || c === null) {

      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      next();

    } else {

      // Create the form
      getForm(req,"/assets/" + id,req.t("Edit Asset ... "),c,function(form) {
        // Default values
        var values = {asset: c};

        // Fix for content type being held in meta field
        // TODO this has a bad smell
        values.returnTo = returnTo;

        res.layout = 'admin';

        // Test!
        calipso.e.pre_emit('ASSET_UPDATE_FORM', form, function(form) {
          calipso.form.render(form,values,req,function(form) {
            calipso.theme.renderItem(req,res,form,block,{},next);
          });
        });

      });

    }

  });

}

/**
 * Update Asset - from form submission
 */
function updateAsset(req,res,template,block,next) {

   calipso.form.process(req,function(form) {

      if(form) {

        var Asset = calipso.lib.mongoose.model('Asset');

        var returnTo = form.returnTo ? form.returnTo : "";
        var id = req.moduleParams.id;

        Asset.findById(id, function(err, c) {
          if (c) {

              // Default mapper
              calipso.form.mapFields(form.asset,c);

              // Fields that are mapped specifically
              c.updated = new Date();
              c.alias = form.asset.alias ? form.asset.alias : titleAlias(c.title);
              c.tags = form.asset.tags ? form.asset.tags.replace(/[\s]+/g, "").split(",") : [];

              if(err || c.isbucket === undefined) {
                req.flash('error',req.t('Could not save content as I was unable to locate content type {type}.',{type:form.content.contentType}));
                res.redirect('/asset');
                next();
              } else {

                // Emit pre event
                // This does not allow you to change the content
                calipso.e.pre_emit('CONTENT_CREATE',c,function(c) {

                  c.save(function(err) {
                    if(err) {

                      var errorMsg = '';
                      if(err.errors) {
                        for(var error in err.errors) {
                          errorMessage = error + " " + err.errors[error] + '\r\n';
                        }
                      } else {
                        errorMessage = err.message;
                      }
                      req.flash('error',req.t('Could not update content because {msg}',{msg:errorMessage}));
                      if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
                        res.redirect('back');
                      }
                      next();

                    } else {

                      req.flash('info',req.t('Content saved.'));

                      // Raise CONTENT_CREATE event
                      calipso.e.post_emit('CONTENT_UPDATE',c,function(c) {
                        if(returnTo) {
                          res.redirect(returnTo);
                        } else {
                          // use the reference to the originally id deifned by req.moduleParams.id
                          res.redirect('/assets/show/' + id);
                        }
                        next();
                      });

                    }

                  });

                });

              }
          } else {
            req.flash('error',req.t('Could not locate asset, it may have been deleted by another user or there has been an error.'));
            res.redirect('/asset');
            next();
          }
        });

      }

    });

}

/**
 * Locate asset based on its alias
 */
function showAliasedAsset(req, res, template, block, next) {
  var path = [];
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i])
      path.push(req.moduleParams['f' + i]);
  }
  var bucket = "";
  if (path.length > 0) {
    bucket = path.splice(0, 1)[0];
    path = path.join('/');
  } else
    path = null;

  var allowedFormats = ["html","json"];
  var format = req.moduleParams.format;
  if (!format)
    format = 'html';
  
  // Check type
  var Asset = calipso.lib.mongoose.model('Asset');

  Asset.findOne({_id:bucket}).populate('bucket').run(function(err, asset) {
    if (err || !asset) {
      Asset.findOne({alias:bucket}, function (err, bucket) {
        if (!bucket || err) {
          res.statusCode = 404;
          next();
          return;
        }
        if (path) {
          Asset.findOne({alias:path,bucket:bucket._id}).populate('bucket').run(function (err, asset) {
            if(err || !asset) {
              // Create asset if it doesn't exist
              if(req.session.user && req.session.user.isAdmin) {
                res.redirect("/assets/new?alias=" + alias + "&type=Article") // TODO - make this configurable
              } else {
                res.statusCode = 404;
              }
              next();
            } else {
              calipso.modules.user.fn.userDisplay(req,asset.author,function(err, userDetails) {
                if(err) {
                  next(err);
                } else {
                  // Add the user display details to asset
                  asset.set('displayAuthor',userDetails);
                  showAsset(req,res,template,block,next,err,asset,format);
                }
              });
            }
          });
        } else {
           calipso.modules.user.fn.userDisplay(req,bucket.author,function(err, userDetails) {
              if(err) {
                next(err);
              } else {
                // Add the user display details to asset
                bucket.set('displayAuthor',userDetails);
                showAsset(req,res,template,block,next,err,bucket,format);
              }
           });
        }
      });
    } else {
      calipso.modules.user.fn.userDisplay(req,asset.author,function(err, userDetails) {
        if(err) {
          next(err);
        } else {
          // Add the user display details to asset
          asset.set('displayAuthor',userDetails);
          showAsset(req,res,template,block,next,err,asset,format);
        }
      });
    }
  });
}


/***
 * Show asset - called by ID or Alias functions preceeding
 */
function showAsset(req,res,template,block,next,err,asset,format) {
  if(asset.isbucket || asset.isfolder) {
    res.statusCode = 404;
    next();
    return;
  }
  var knox = require('knox').createClient({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret"),
    bucket: asset.bucket.alias,
    endpoint: "s3.amazonaws.com"
  });
  var fileName = path.basename(asset.alias);
  var contentType = mime.lookup(fileName);
  var range = req.header['Range'];
  var headers = {'response-content-type':contentType};
  if (range)
    headers['Range'] = range;
  knox.get(escape(asset.alias), headers).on('response', function(s3res) {
    var buffer = new Buffer(0);
    if (req.url.substring(req.url.length - fileName.length) !== fileName)
      res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
    for (var v in s3res.headers) {
      res.setHeader(v, s3res.headers[v]);
      console.log(v, s3res.headers[v]);
    }
    s3res.on('error', function(err) {
      next();
    });
    s3res.on('end', function (chunk) {
      next();
    });
    res.statusCode = 200;
    s3res.pipe(res);
  }).end();        // Just return the object
}

function listAssets(req,res,template,block,next) {  
  var tag = req.moduleParams.tag ? req.moduleParams.tag : '';
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var sortBy = req.moduleParams.sortBy;
  var params = {req:req,res:res,template:template,block:block,format:format,sortBy:sortBy,limit:req.moduleParams.limit,from:req.moduleParams.from};
  var Asset = calipso.lib.mongoose.model('Asset');

  res.menu.adminToolbar.addMenuItem({name:'Create',weight:1,path:'new',url:'/content/new',description:'Create content ...',security:[]});

  // TODO : Make this more flexible ...
  var path = [];
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i])
      path.push(req.moduleParams['f' + i]);
  }
  var bucket = "";
  if (path.length > 0) {
    bucket = path.splice(0, 1)[0];
    path = path.join('/');
  } else
    path = "";

  var query = new Query();
  
  function finish() {
    res.menu.adminToolbar.addMenuItem({name:'Create Bucket',weight:1,path:'new',url:'/assets/new',description:'Create Bucket ...',security:[]});
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

    // Folder levels tags
    var taxonomy = "";
    if(path) {
      var q = {$regex:'^' + path + '/[^/]*/?$'};
      query.where('alias',q);
      params.path = path + '/';
    } else
      params.path = null;
    // Re-retrieve our object
    getAssetList(query,params,next);
  }
  if (bucket) {
    Asset.findOne({alias:bucket,isbucket:true}, function(err, bucket) {
      if (!err && bucket) {
        query.where('bucket', bucket._id);
        if (!path) {
          var q = {$regex:'^[^/]*/?$'};
          query.where('alias',q);
        }
      } else {
        res.statusCode = 404;
        next();
        return;
      }
      finish();
    });
  } else {
    query.where('isbucket',true);
    finish();
  }
};

/**
 * Helper function for link to user
 */
function assetLink(req,asset) {
  if (asset.isbucket)
    return calipso.link.render({id:asset.alias,title:req.t('View bucket {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.alias});
  if (asset.isfolder) {
    return calipso.link.render({id:asset.alias,title:req.t('View folder {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.bucket.alias + '/' + asset.alias});
  }
  return calipso.link.render({id:asset.alias,title:req.t('View file {asset}',{asset:asset.title}),label:asset.title,url:'/assets/' + asset._id});
}

function formatSize(req,asset) {
  if (asset.IsDirectory)
    return "DIR";
  return asset.Size;
}

function assetType(req,asset) {
  if (asset.isbucket)
    return "S3 Bucket";
  if (asset.isfolder)
    return "Folder";
  return "File";
}
/**
 * Take a query and parameters, return or render asset lists
 * This has been refactored so it can be called as a helper (e.g. views)
 * From a theme
 */
function getAssetList(query,out,next) {
  var pager = out.hasOwnProperty('pager') ? out.pager : true;

  var Asset = calipso.lib.mongoose.model('Asset');

  function snarfBucketContent(err, items, parent, next) {
    if (err) {
      return;
    }
    var asset = items.splice(0, 1)[0]; // take the first item
    if (!asset) {
      if (next)
        next(null);
      return;
    }
    var query = {alias:asset.alias, isbucket:(parent === null)};
    if (parent)
      query.bucket = parent._id;
    Asset.findOne(query, function (err, assetFound) {
      if (err || !assetFound) {
        if (!asset.title)
          asset.title = path.basename(asset.alias);
        asset.isbucket = parent === null;
        asset.isfolder = asset.alias.substring(asset.alias.length - 1) === '/';
        if (parent)
          asset.bucket = parent._id;
        newAsset = new Asset(asset);
        newAsset.save(function (err) {
          if (err)
            console.log("error:", err)
          if (parent) {
            snarfBucketContent(err, items, parent, function (err) {
              snarfBucketContent(err, items, parent, next);
            });
          } else {
            realContent(newAsset, snarfBucketContent, function (err) {
              snarfBucketContent(err, items, parent, next);
            });
          }
        });
      } else {
        if (parent) {
          snarfBucketContent(err, items, parent, next, function (err) {
            snarfBucketContent(err, items, parent, next);
          });
        } else {
          realContent(assetFound, snarfBucketContent, function (err) {
            snarfBucketContent(err, items, parent, next);
          });
        }
      }
    });
  }
  realContent(null, snarfBucketContent);

  var limit = out.limit ? out.limit : (out.req.moduleParams.limit ? parseInt(out.req.moduleParams.limit) : 20);
  // If pager is enabled, ignore any override in from
  var from;
  if (pager) {
    from = out.from ? out.from - 1 : (out.req.moduleParams.from ? parseInt(out.req.moduleParams.from) - 1 : 0);
  } else {
    from = out.from ? out.from - 1 : 0;
  }

  // Initialise the block based on our content
  Asset.count(query, function (err, count) {
    var total = count;

    var pagerHtml = "";
    if(pager) {
      pagerHtml = calipso.lib.pager.render(from,limit,total,out.req.url);
    }

    var qry = Asset.find(query).skip(from).limit(limit).populate('bucket');
    // Add sort
    qry = calipso.table.sortQuery(qry,out.sortBy);
    qry.find(function (err, assets) {
       if(out && out.res) {
         // Render the item into the response
         if(out.format === 'html') {
           // This is where the asset table is rendered for HTML.
           // We might need a folder like view composed of a bunch of <div> instead.
           var table = {id:'content-list',sort:true,cls:'table-admin',
               columns:[{name:'title',sort:'title',label:'Title',fn:function(req, asset) {
                           if (asset.alias === out.path) {
                             if (out.path == null) {
                               return calipso.link.render({id:asset.alias,title:req.t('View parent {asset}',{asset:asset.bucket.title}),label:asset.bucket.title,url:'/asset/' + asset.bucket.alias});
                             } else {
                               var p = '';
                               if (out.path) {
                                 var s = out.path.split('\/');
                                 if (s.length > 0 && s[s.length - 1] === '')
                                  s.splice(-1, 1);
                                 s.splice(-1, 1);
                                 p = s.join('/');
                               }
                               return calipso.link.render({id:p,title:req.t('View parent folder'),label:'Parent Folder',url:'/asset/' + asset.bucket.alias + '/' + p});
                             }
                           }
                           if (asset.isfolder)
                             return calipso.link.render({id:asset.alias,title:req.t('View folder {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.bucket.alias + '/' + asset.alias});
                           if (asset.isbucket)
                            return calipso.link.render({id:asset.alias,title:req.t('View bucket {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.alias});
                           return calipso.link.render({id:asset.alias,title:req.t('Edit file {asset}',{asset:asset.title}),label:asset.title,url:'/assets/' + asset._id});
                        }},
                       {name:'alias',label:'Alias',fn:function(req, asset) {
                          var file = asset.alias;
                          if (out.path)
                            file = file.replace(out.path, '');
                          if (asset.isfolder || asset.isbucket)
                            return file;
                          return calipso.link.render({id:file,title:req.t('View file {asset}',{asset:asset.title}),label:file,url:'/assets/show/' + asset.bucket.alias + '/' + asset.alias});
                        }},
                       {name:'isbucket',label:'Type',fn:assetType},
                       {name:'created',label:'Created'},
                       {name:'updated',label:'Updated'}
               ],
               data:assets,
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
           calipso.theme.renderItem(out.req,out.res,tableHtml,out.block,null,next);
         }
         if(out.format === 'json') {
           out.res.format = out.format;
           out.res.end(contents.map(function(u) {
             return u.toObject();
           }));
           //next();
         }
         // This really needs to be pluggable
         // WIP!
         if(out.format === 'rss') {
           // Override the template
           out.res.layout = "rss";
           var newTemplate = calipso.modules["content"].templates["rss"];
           if(newTemplate) {
             calipso.theme.renderItem(out.req,out.res,newTemplate,out.block,{contents:contents},next);
           } else {
             res.statusCode = 404;
             next();
           }
         }
      } else {
         // We are being called as a helper, hence return raw data & the pager.
         var output = {
             contents:contents,
             pager:pagerHtml
         }
         next(null,output);
      }
    });
  });
}

function realContent(asset, callback, next) {
  var expat = require('node-expat');
  var knox = require('knox').createClient({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret"),
    bucket: (asset && asset.alias) || '',
    endpoint: "s3.amazonaws.com"
  });
  knox.get("").on('response', function(s3res){
    s3res.setEncoding('utf8');
    var parser = new expat.Parser();
    var items = [];
    var item = null;
    var property = null;
    var owner = null;
    var message = null;
    var code = null;
    var Asset = calipso.lib.mongoose.model('Asset');
    parser.addListener('startElement', function(name, attrs) {
      if (name === 'Error') {
        property = 'error';
      } else if (name === 'Code') {
        property = 'code';
      } else if (name === 'Message') {
        property = 'message';
      } else if (name === 'Contents' || name == 'Bucket') {
        item = {};
      } else if (name === 'Key') {
        property = 'alias';
      } else if (name === 'CreationDate') {
        property = 'created';
      } else if (name === 'LastModified') {
        property = 'updated';
      } else if (name === 'ETag') {
        property = 'etag';
      } else if (name === 'Name') {
        property = 'alias';
      } else if (name === 'Size') {
        property = 'size';
      } else if (name === 'DisplayName')
        property = 'author';
    });
    parser.addListener('endElement', function(name) {
      if (name === 'Error') {
        callback({code:code, message:message}, null, asset);
      } else if (name === 'Contents' || name == 'Bucket') {
        if (!item.author)
          item.author = owner;
        items.push(item);
        item = null;
      } else if (name === 'ListBucketResult' || name === 'ListAllMyBucketsResult') {
        callback(null, items, asset, next);
      }
    });
    parser.addListener('text', function(s) {
      if (property === 'code')
        code = s;
      if (property === 'message')
        message = s;
      if (property === 'author')
        owner = s;
      if (property && item) {
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
    s3res.on('error', function(err) {
      callback(err, null, null, next);
    });
    buffer = new Buffer('');
    s3res.on('end', function() {
      parser.parse(buffer);
    });
    s3res.on('data', function(chunk){
      buffer += chunk;
    });
  }).end();
};
