
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),

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


/*
 * Initialisation
 */
function init(module, app, next) {
  // Initialise administration events - enabled for hook.io  
  calipso.e.addEvent('ASSET_UPDATE',{enabled:true,hookio:true}); 
  calipso.e.addEvent('ASSET_CREATE_FORM',{enabled:true,hookio:true});
  calipso.e.addEvent('ASSET_CREATE',{enabled:true,hookio:true});
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
      // Admin operations
      module.router.addRoute('POST /asset',createAsset,{admin:true},this.parallel());
      module.router.addRoute('GET /asset/new',createAssetForm,{admin:true,block:'content.create'},this.parallel());
      module.router.addRoute('GET /asset/show/:id.:format?',showAssetByID,{admin:true,template:'show',block:'content.show'},this.parallel());
      module.router.addRoute('GET /asset/edit/:id',editAssetForm,{admin:true,block:'content.edit'},this.parallel());
      module.router.addRoute('GET /asset/delete/:id',deleteAsset,{admin:true},this.parallel());
      module.router.addRoute('POST /asset/:id',updateAsset,{admin:true},this.parallel());

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
        teaser:{type: String, required: false, "default": ''},
        taxonomy:{type: String, "default":''},
        bucket:{type: calipso.lib.mongoose.Schema.ObjectId, ref: 'Asset', required: false},
        key: {type: String, required: false, "default": ''},
        isbucket:{type: Boolean, "default":false},
        alias:{type: String, required: true, index: true},
        author:{type: String, required: true},
        etag:{type: String, "default":''},
        tags:[String],
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now },
        ispublic:{type: Boolean, index: true}    // Copy from content type
      });

      // Set post hook to enable simple etag generation
      Asset.pre('save', function (next) {
        this.etag = calipso.lib.crypto.etag(this.title + this.teaser + this.bucket + this.key);
        next();
      });

      calipso.lib.mongoose.model('Asset', Asset);

      module.initialised = true;

      next();
    }
  );
}

function getAsset(req,res,template,block,next) {
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
        text = "<a title='" + req.t("Click to create") + " ...' href='/asset/new?" +
        "type=Block%20Content" +
        "&alias=" + options.alias +
        "&teaser=Content%20for%20" + options.alias +
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
          var buffer = new Buffer();
          res.setHeader('Content-Disposition', 'Download;FileName=' + fileName);
      //    s3res.setEncoding('utf8');
          s3res.on('data', function(chunk){
            buffer.write(chunk);
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

function assetForm() {
      return {id:'content-form',title:'Create Content ...',type:'form',method:'POST',action:'/asset',tabs:true,
          sections:[{
            id:'form-section-content',
            label:'Content',
            fields:[
                    {label:'Title',name:'asset[title]',type:'text',description:'Title to appear for this piece of content.'},
                    {label:'Permanent URL / Alias',name:'asset[alias]',type:'text',description:'Permanent url (no spaces or invalid html characters), if left blank is generated from title.'},
                    {label:'Teaser',name:'asset[teaser]',type:'textarea',description:'Enter some short text that describes the content, appears in lists.'},
                    {label:'Key',name:'asset[key]',type:'textarea',description:'Enter the full content text.'}
                   ]
          },{
            id:'form-section-category',
            label:'Categorisation',
            fields:[
                    {label:'Taxonomy',name:'asset[taxonomy]',type:'text',description:'Enter the menu heirarchy, e.g. "welcome/about"'},
                    {label:'Tags',name:'asset[tags]',type:'text',description:'Enter comma delimited tags to help manage this content.'},
                   ]
          },{
            id:'form-section-status',
            label:'Status',
            fields:[
                    {label:'Status',name:'asset[status]',type:'select',options:["draft","scheduled","published"],description:'Select the status (published is visible to all public).'},
                    {label:'Published',name:'asset[published]',type:'datetime',description:'Date to appear as published.'},
                    {label:'Scheduled',name:'content[scheduled]',type:'datetime',description:'Date to be published (if scheduled).'},
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
                    res.redirect('/asset/new?type='+form.content.contentType);
                }
                next();
              } else {
                req.flash('info',req.t('Content saved.'));

                // Raise CONTENT_CREATE event
                calipso.e.post_emit('ASSET_CREATE',c,function(c) {

                  if(returnTo) {
                    res.redirect(returnTo);
                  } else {
                    res.redirect('/asset/show/' + c._id);
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
function getForm(req,action,title,isBucket,next) {

  // Create the form
  var form = exports.assetForm(); // Use exports as other modules may alter the form function
  form.action = action;
  form.title = title;

  // Add any fields
  var fields = isBucket ? ['Bucket'] : ['Key'];
  // Process any additional fields
  form = calipso.form.processFields(form,fields);

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
  var teaser = req.moduleParams.teaser ? req.moduleParams.teaser : "";
  var taxonomy = req.moduleParams.taxonomy ? req.moduleParams.taxonomy : "";
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  // Create the form
  getForm(req,"/asset",req.t("Create Bucket ..."),type,function(form) {

    // Default values
    var values = {
        asset: {
          title:alias,  // Default the title to the alias
          alias:alias,
          teaser:teaser,
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
  res.menu.adminToolbar.addMenuItem({name:'View',weight:2,path:'show',url:'/asset/show/' + id,description:'Show current ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Edit',weight:3,path:'edit',url:'/asset/edit/' + id,description:'Edit asset ...',security:[]});
  res.menu.adminToolbar.addMenuItem({name:'Delete',weight:4,path:'delete',url:'/asset/delete/' + id,description:'Delete asset ...',security:[]});


  Asset.findById(id, function(err, c) {

    if(err || c === null) {

      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      next();

    } else {

      // Create the form
      getForm(req,"/asset/" + id,req.t("Edit Asset ..."),c.isbucket,function(form) {

        // Default values
        var values = {content: c};

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
                          res.redirect('/asset/show/' + id);
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

  var allowedFormats = ["html","json"];
  var format = req.moduleParams.format;
  var alias = req.moduleParams.alias;

  // Check type
  if(calipso.lib._.any(allowedFormats,function(value) { return value === format; })) {

    var Asset = calipso.lib.mongoose.model('Asset');

    Asset.findOne({alias:alias},function (err, asset) {

        if(err || !asset) {
          // Create asset if it doesn't exist
          if(req.session.user && req.session.user.isAdmin) {
            res.redirect("/asset/new?alias=" + alias + "&type=Article") // TODO - make this configurable
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

    // Invalid format, just return nothing
    next();

  }

}

/**
 * Show asset based on its ID
 */
function showAssetByID(req,res,template,block,next) {

  var Asset = calipso.lib.mongoose.model('Asset');
  var id = req.moduleParams.id;
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  Asset.findById(id, function(err, asset) {

    // Error locating asset
    if(err) {
      res.statusCode = 500;
      errorMessage = err.message;
      next();
      return;
    }

    // Asset found
    if(asset) {

      calipso.modules.user.fn.userDisplay(req,asset.author,function(err, userDetails) {
          if(err) {
            next(err);
          } else {
            // Add the user display details to asset
            asset.set('displayAuthor',userDetails);
            showAsset(req,res,template,block,next,err,asset,format);
          }

      });

    } else {
      // Show a 404
      res.statusCode = 404;
      next();

    }

  });

}

/***
 * Show asset - called by ID or Alias functions preceeding
 */
function showAsset(req,res,template,block,next,err,asset,format) {

  if(err || !asset) {

    asset = {title:"Not Found!",content:"Sorry, I couldn't find that content!",displayAuthor:{name:"Unknown"}};

  } else {

    res.menu.adminToolbar.addMenuItem({name:'Create',weight:3,path:'new',url:'/asset/new',description:'Create Bucket ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'List',weight:1,path:'list',url:'/asset/',description:'List all ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'View',weight:2,path:'show',url:'/asset/show/' + asset.id,description:'Show current ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'Edit',weight:4,path:'edit',url:'/asset/edit/' + asset.id,description:'Edit asset ...',security:[]});
    res.menu.adminToolbar.addMenuItem({name:'Delete',weight:5,path:'delete',url:'/asset/delete/' + asset.id,description:'Delete asset ...',security:[]});

  }

  // Set the page layout to the asset type
  if(format === "html") {
    if(asset) {

      // Change the layout
      res.layout = asset.layout ? asset.layout : "default";

      // Override of the template
      //template = ''

    }
    calipso.theme.renderItem(req,res,template,block,{content:asset.toObject()},next);

  }

  if(format === "json") {
    res.format = format;
    res.send(asset.toObject());
    next();
  }


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
    
  res.menu.adminToolbar.addMenuItem({name:'Create Bucket',weight:1,path:'new',url:'/asset/new',description:'Create Bucket ...',security:[]});
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
function assetLink(req,asset) {
  if (asset.IsFile)
    return calipso.link.render({id:asset.Key,title:req.t('View {asset}',{asset:asset.Key}),label:asset.Key,url:'/asset/show?key=&quot;' + asset.Key + '&quot;'});
  else
    return asset.Key;
}

function formatSize(req,asset) {
  if (asset.IsDirectory)
    return "DIR";
  return asset.Size;
}

/**
 * Take a query and parameters, return or render asset lists
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

        console.log(items);
        items = items.slice(from, from + limit);

        var pagerHtml = "";
        if (pager) {
          pagerHtml = calipso.lib.pager.render(from,limit,total,out.req.url);
        }
        if (out && out.res) {
          // Render the item into the response
          if (out.format === 'html') {
            var table = {id:'content-list',sort:true,cls:'table-admin',
              columns:[{name:'Key',sort:'Key',label:'Key',fn:assetLink},
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
            var newTemplate = calipso.modules["asset"].templates["rss"];
            if(newTemplate) {
              calipso.theme.renderItem(out.req, out.res, newTemplate, out.block, {assets:items}, next);
            } else {
              res.statusCode = 404;
              next();
            }
          }
        } else {
          // We are being called as a helper, hence return raw data & the pager.
          var output = {
            assets:items,
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
