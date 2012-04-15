
var rootpath = process.cwd() + '/',
  path = require('path'),
  Query = require("mongoose").Query,
  mime = require('mime'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  parse = require('url').parse,
  crypto = require('crypto'),
  fs = require('fs'),
  knox_mod = require('knox');

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

  var mPerm = calipso.permission.Helper.hasPermission("asset:manage:manage"),
      vPerm = calipso.permission.Helper.hasPermission("asset:manage:view");
      
  res.menu.admin.addMenuItem(req, {name:'Asset Management',path:'asset',url:'/asset',description:'Manage assets ...',permit:mPerm});
  res.menu.admin.addMenuItem(req, {name:'Asset',path:'asset/content',url:'/asset',description:'Manage assets ...',permit:vPerm});

  // Routing and Route Handler
  module.router.route(req, res, next);
}

function invalidateBuckets()
{
  bucketCheck = Date().getTime();
}

// Standard knox interface with the correct key and secret.
function knox(options) {
  options = calipso.lib._.extend({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret")
  }, options);
  return knox_mod.createClient(options);
}

var convert = {
  'content-type': 'Content-Type',
  'content-length': 'Content-Length',
  'expect': 'Expect'
};

// Main asset router.
// PUT (project/{path}|bucket|bucket/{path})
// GET (project/{path}|bucket{path}
// DELETE (project/{path}|bucket|bucket/{path})
function handleAsset(req, res, next) {
  // parse url
  var url = parse(req.url)
    , pt = decodeURIComponent(url.pathname)
    , type;
  if (!/^\/(proj|s3)\//.test(pt)) {
    return next();
  }
  // Pause incoming stream for now. We might need to read it for POST or PUT.
  req.pause();
  // Completion for Asset.find()
  var maxAge = 0
    , ranges = req.headers.range
    , head = 'HEAD' == req.method
    , get = 'GET' == req.method
    , put = 'PUT' == req.method
    , post = 'POST' == req.method
    , del = 'DELETE' == req.method
    , done;
  // ignore non-GET requests
  if (!get && !head && !put && !post && !del) {
    return next();
  }
  
  // parse url
  var url = parse(req.url)
    , alias = decodeURIComponent(url.pathname).substring(1)
    , type;
  var paths = alias.split('/');
  var isFolder = paths[paths.length - 1] === '';
  var root = paths[0];
  if (isFolder)
    paths.splice(paths.length - 1, 1);
  var fileName = paths[paths.length - 1];
  var isBucket = (root === 's3') && (paths.length == 2);
  var parentFolder = '';
  for (var i = 0; i < (paths.length - 1); i++) {
    parentFolder += paths[i] + '/';
  }
  if (put && isBucket) {
    //TODO need to reimplement this so buckets get created by admin package.
    // Create a new bucket
    // This is a PUT with no alias.
    var k = knox({
      'bucket': fileName,
    });
    var Asset = calipso.db.model('Asset');
    if (alias[alias.length - 1] !== '/')
      alias += '/';
    Asset.findOne({isfolder:true,alias:alias}, function (err, asset) {
      var author = (req.session && req.session.user) || 'testing';
      if (!asset) {
        asset = new Asset();
        calipso.debug('create new bucket ' + alias);
      } else
        calipso.debug('found bucket ' + alias);
      asset.isfolder = true;
      asset.alias = alias;
      asset.title = paths[1];
      asset.key = paths[1] + '/';
      asset.author = author;
      asset.save(function (err) {
        if (err) {
          res.statusCode = 500;
          req.flash('error', 'Unable to save bucket ' + err.message);
          next();
          return;
        }
        var sreq = k.request(req.method, '', {
          'Content-Length': '0',
          'x-amz-acl': 'private'
        });
        sreq.on('error', function(err) {
          asset.remove(function () {
            res.statusCode = 500;
            req.flash('error', 'Unable to create bucket ' + err.message);
            next();
            return;
          });
        }).on('response', function(s3res) {
          for (var v in s3res.headers) {
            if (/x-amz/.test(v) || v === 'server')
              continue;
            res.setHeader(v, s3res.headers[v]);
          }
          res.statusCode = s3res.statusCode;
          s3res.pipe(res);
          req.resume();
        }).end();
      });
    });
    return;
  }
  function handleAssetInteractWithS3(asset, req, res, next) {
    var copy = req.headers['x-amz-copy-source'];
    if (copy && /(proj|s3)\//.test(copy)) {
      Asset.findOne({alias:copy}, function (err, copyAsset) {
        if (err || !copyAsset) {
          req.resume();
          res.statusCode = 500;
          req.flash('error', 'Unable to resolve copy source ' + copy);
          next();
          return;
        }
        req.headers['x-amz-copy-source'] = '/' + escape(copyAsset.key);
        handleAssetInteractWithS3(asset, req, res, next);
      });
      return;
    }
    var paths = asset.key.split('/');
    var fileName = paths[paths.length - 1];
    var bucket = paths.splice(0, 1)[0];
    var k = knox({
      bucket: bucket
    });
    var s3key = paths.join('/');
    var contentType = mime.lookup(fileName);
    var headers = {'Content-Type':contentType,Expect: '100-continue'};
    for (var v in req.headers) {
      if (/x-amz-/i.test(v)) {
        headers[v] = req.headers[v];
      } else if (convert[v]) {
        headers[convert[v]] = req.headers[v];
      }
    }
    var s3req = k.request(req.method, escape(s3key), headers)
      .on('error', function(err) {
        next(null, err);
      })
      .on('response', function(s3res) {
        for (var v in s3res.headers) {
          if (/x-amz/.test(v) || v === 'server')
            continue;
          res.setHeader(v, s3res.headers[v]);
        }
        res.statusCode = s3res.statusCode;
        s3res.pipe(res);
      });
    if (!get && !del && !head) {
      req
        .on('abort', function() {
          calipso.debug('abort');
          next(null);
        })
        .on('error', function(err){
          calipso.debug('error');
          next(null, err);
        })
        .on('data', function(chunk){
          s3req.write(chunk);
        })
        .on('end', function(){
          calipso.debug('end');
          s3req.end();
        });
    } else {
      s3req.end();
    }
    // Now we're setup to read the rest of the request and stream it to S3.
    req.resume();
  }
  var Asset = calipso.db.model('Asset');
  // Search for the folder first
  Asset.findOne({alias:parentFolder}, function(err, folder) {
    if(err || !folder) {
      // If we didn't find the folder then it has not been created yet.
      req.resume();
      res.statusCode = 404;
      req.flash('error', 'Unable to find parent folder ' + parentFolder);
      next();
      return;
    }
    // Search for the asset with this alias.
    Asset.findOne({alias:alias, folder:folder._id}).run(function(err, asset) {
      if(err || !asset) {
        if (put || post) {
          if (isFolder && (folder.key === '')) {
            res.statusCode = 500;
            req.flash('error', 'This folder is rooted and not storage allocated for parent folder ' + parentFolder);
            next();
            return;
          }
          var s3path = folder.key + fileName;
          var author = (req.session && req.session.user) || 'testing';
          if (isFolder)
            s3path += '/';
          if (!asset) {
            calipso.debug('new asset ' + alias);
            asset = new Asset({isfolder:isFolder,
              key:s3path, folder:folder._id, alias:alias, title:fileName, author:author});
          } else {
            calipso.debug('existing asset ' + alias);
          }
          var match = s3path.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
          var project = null;
          if (match) {
            asset.isroot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == s3path;
            if (asset.isroot) {
              project = match[2];
              asset.isroot = false;
              asset.title = match[3];
              var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
              calipso.debug("rewriting uri from " + s3path + " to " + newUri);
              asset.alias = newUri;
            } else {
              // For a normal asset that's part of a project rewrite it to say
              // {project}/{rootfolder}/{restofuri}
              var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
              calipso.debug("rewriting uri from " + asset.key + " to " + newUri);
              asset.alias = newUri;
            }
          }
          function handleAssetSaveAsset() {
            asset.save(function (err) {
              calipso.lib.assets.updateParents(asset, author, function (err) {
                if (err) {
                  req.resume();
                  res.statusCode = 500;
                  req.flash('error', 'Unable to save asset ' + asset.alias + ': ' + err.message);
                  next();
                  return;
                }
                if (isFolder) {
                  req.resume();
                  res.send(200, 'created folder ' + alias);
                } else
                  handleAssetInteractWithS3(asset, req, res, next);
              });
            });
          }
          if (project) {
            // Search and create project first
            var q = {isproject:true, alias:'proj/' + project + '/'};
            Asset.findOne(q, function (err, proj) {
              if (!proj) {
                calipso.debug('new project proj/' + project + '/');
                proj = new Asset(q);
              } else
                calipso.debug('existing project proj/' + project + '/');
              proj.key = '';
              proj.author = author;
              proj.title = project;
              proj.isfolder = true;
              proj.save(function (err) {
                if (err) {
                  req.resume();
                  res.statusCode = 500;
                  req.flash('error', 'Unable to create corresponding project: ' + err.message);
                  next();
                  return;
                }
                asset.folder = proj._id;
                handleAssetSaveAsset();
              })
            });
          } else
            handleAssetSaveAsset();
          return; // done putting new file
        } else {
          req.resume();
          res.statusCode = 404;
          req.flash('error', 'Unable to find file ' + alias);
          next();
          return; // this file doesn't exist but it's not a put...
        }
      }
      if (asset.isfolder) {
        req.resume();
        req.flash('error', 'This folder already exists ' + alias);
        res.statusCode = 500;
        next();
        return; // This is a bucket or folder...
      }
      handleAssetInteractWithS3(asset, req, res, next);
      return;
    });
  });
}

function testAssets(req, res, route, next) {
  calipso.debug('testing');
  calipso.lib.assets.createAsset({path:'proj/project1/archive/testing/',author:'andy'}, function (err, asset) {
    if (err) {
      return res.send(500, err.message);
    }
    res.write(JSON.stringify(asset) + '\n');
    calipso.lib.assets.createAsset({path:'proj/project1/archive/testing/badfile.coffee',copySource:'proj/project1/archive/badFile.coffee',author:'andy'}, function (err, asset) {
      calipso.debug('deleting');
      calipso.lib.assets.deleteAsset('proj/project1/archive/testing/badfile.coffee', function (err) {
        if (err) {
          res.write("unable to delete file badfile.coffee " + err.message);
          res.end();
          return;
        }
        calipso.debug('deleting');
        calipso.lib.assets.deleteAsset('proj/project1/archive/testing/', function (err) {
          if (err) {
            res.write("unable to delete folder " + err.message);
            res.end();
            return;
          }
          res.write("folder deleted\n");
          calipso.lib.assets.createAsset({path:'s3/ai-test2/project:newproject:archive/',author:'andy'}, function (err, asset) {
            if (err) {
              res.write("unable to create project " + err.message);
              res.end();
              return;
            }
            res.write("created project and root folder\n");
            calipso.lib.assets.createAsset({path:'proj/newproject/archive/something.txt',copyStream:fs.createReadStream(path.join(__dirname, 'assets.js'))}, function (err, asset) {
              if (err) {
                res.write("unable to create sample file " + err.message);
                res.end();
                return;
              }
              res.write("created sample file using stream\n");
              calipso.lib.assets.deleteAsset('proj/newproject/', function (err, asset) {
                res.write("deleted project\n")
                res.write(JSON.stringify(asset) + '\n');
                res.end();
              })
            })
          });
        });
      });
    })
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
      module.router.addRoute('GET /assettest', testAssets, {admin:true}, this.parallel());
      module.router.addRoute('GET /asset/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?.:format?', listAssets, {
        template: 'listAdmin',
        block: 'content.list',
        admin: true
      }, this.parallel());
      module.router.addRoute('GET /assets/sync/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?', syncAssets, {admin:true}, this.parallel());
      module.router.addRoute('GET /assets/:id',editAssetForm,{admin:true,block:'content.edit'},this.parallel());
      module.router.addRoute('GET /assets/delete/:id',deleteAsset,{admin:true},this.parallel());
      module.router.addRoute('POST /assets/:id',updateAsset,{admin:true},this.parallel());
    }, function done() {
      // Get asset list helper
      calipso.helpers.addHelper('getAssetList', function() { return getAssetList; });
      calipso.lib.assets = {
        knox: knox,
        assetModel: function () {
          return calipso.db.model('Asset');
        },
        findAssets: function () {
          var Asset = calipso.db.model('Asset');
          return Asset.find.apply(Asset, arguments);
        },
        updateAssets: function () {
          var Asset = calipso.db.model('Asset');
          return Asset.update.apply(Asset, arguments);
        },
        listProjects: function (callback) {
          var Asset = calipso.db.model('Asset');
          var query = Asset.find({isproject:true});
          process.nextTick(function() { callback(null, query); });
        },
        syncFolder: function (folder, callback) {
          var Asset = calipso.db.model('Asset');
          var info = null;
          var result = [];
          function realContent(info, asset, atRoot, callback, next) {
            var bucket = '';
            if (asset) {
              var s = asset.key.split('/');
              bucket = s[0];
            }
            var expat = require('node-expat');
            var knox = require('knox').createClient({
              key: calipso.config.get("s3:key"),
              secret: calipso.config.get("s3:secret"),
              bucket: bucket
            });
            if (info && info.bucket && asset && bucket !== info.bucket) {
              return next();
            }
            knox.get((info && info.prefix) ? ('?prefix=' + info.prefix) : '').on('response', function(s3res){
              s3res.setEncoding('utf8');
              var parser = new expat.Parser();
              var items = [];
              var item = null;
              var dirs = {};
              var property = null;
              var owner = null;
              var message = null;
              var code = null;
              var Asset = calipso.db.model('Asset');
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
                  property = 'key';
                } else if (name === 'CreationDate') {
                  property = 'created';
                } else if (name === 'LastModified') {
                  property = 'updated';
                } else if (name === 'ETag') {
                  property = 'etag';
                } else if (name === 'Name') {
                  property = 'key';
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
                  if (item.key.substring(item.key.length - 1) === '/')
                    dirs[item.key] = true;
                  else if (asset) {
                    var paths = item.key.split('/');
                    paths.splice(paths.length - 1, 1);
                    paths = paths.join('/') + '/';
                    if (!dirs[paths] && paths !== '/') {
                      var fakeItem = {key:paths,size:0,isfolder:true,author:item.author};
                      items.push(fakeItem);
                      dirs[paths] = true;
                    }
                  }
                  items.push(item);
                  item = null;
                } else if (name === 'ListBucketResult' || name === 'ListAllMyBucketsResult') {
                  callback(null, items, asset, atRoot, next);
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
                  if (property === 'key') {
                    if (asset)
                      item[property] = bucket + '/' + s;
                    else
                      item[property] = s + '/';
                  } else if (property === 'Size') {
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
          function snarfBucketContent(err, items, parent, atRoot, next) {
            if (err) {
              return;
            }
            var asset = items.splice(0, 1)[0]; // take the first item
            if (!asset) {
              if (next)
                next(null);
              return;
            }
            var query = {key:asset.key};
            Asset.findOne(query, function (err, assetFound) {
              var isNew = false;
              if (!assetFound) {
                assetFound = new Asset();
                isNew = true;
              }
              var paths = asset.key.split('/');
              if (paths[paths.length - 1] === '')
                paths.splice(paths.length - 1, 1);
              var fileName = paths[paths.length - 1] || 'Untitled';
              paths.splice(paths.length - 1, 1);
              var folderPath = null;
              if (paths.length > 0)
                folderPath = paths.join('/') + '/';
              if (!assetFound.title || assetFound.title === 'undefined') {
                assetFound.title = (parent === null) ? asset.key : fileName;
              }
              assetFound.isfolder = asset.key.substring(asset.key.length - 1) === '/';
              assetFound.isroot = false;
              if (!assetFound.isfolder)
                assetFound.size = asset.size;
              else
                assetFound.size = null;
              assetFound.key = asset.key; // S3 name
              var project = null;
              var match = assetFound.key.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
              assetFound.alias = 's3/' + asset.key;
              if (match) {
                assetFound.isroot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == assetFound.key;
                if (assetFound.isroot) {
                  project = match[2];
                  assetFound.isroot = false;
                  assetFound.title = match[3];
                  var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
                  calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
                  assetFound.alias = newUri;
                } else {
                  // For a normal asset that's part of a project rewrite it to say
                  // {project}/{rootfolder}/{restofuri}
                  var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
                  calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
                  assetFound.alias = newUri;
                }
              } else if (/s3\/[^\/]*\/$/.test(assetFound.alias)) {
                assetFound.isroot = true;
              }
              assetFound.author = asset.author;
              if (assetFound.isbucket) {
                if (!info || !info.bucket || info.bucket === assetFound.alias) {
                  var log = (isNew ? 'new ' : 'update ') + ' bucket "' + asset.key + '"';
                  calipso.debug(log);
                  result.push(log);
                }
              } else if (parent && assetFound.isfolder) {
                var log = (isNew ? 'new ' : 'update ') + '"' + asset.key + '"';
                calipso.debug(log);
                result.push(log);
              }
              function saveAsset() {
                assetFound.save(function (err) {
                  if (err) {
                    calipso.error("error:", err)
                    next();
                    return;
                  }
                  if (parent) {
                    snarfBucketContent(err, items, parent, atRoot, function (err) {
                      snarfBucketContent(err, items, parent, false, next);
                    });
                  } else {
                    realContent(info, assetFound, false, snarfBucketContent, function (err) {
                      snarfBucketContent(err, items, parent, false, next);
                    });
                  }
                });
              }
              if (project) {
                var pq = {isproject:true,alias:'proj/' + project + '/',key:'',isvirtual:true};
                Asset.findOne(pq, function (e, proj) {
                  var newProj = false;
                  if (e || !proj) {
                    newProj = true;
                    proj = new Asset(pq);
                  }
                  proj.author = asset.author;
                  proj.title = project;
                  proj.isroot = true;
                  proj.isfolder = true;
                  calipso.debug((newProj ? 'new project ' : 'update project ') + proj.title);
                  proj.save(function (err) {
                    if (err) {
                      calipso.error("error:", err);
                      next();
                      return;
                    }
                    assetFound.folder = proj._id;
                    assetFound.isvirtual = true;
                    saveAsset();
                  });
                });
              } else
                saveAsset();
            });
          }
          Asset.findOne({alias:folder}, function (err, root) {
            if (!root) {
              if (folder !== '') {
                if (/^proj\/.*\//.test(folder))
                  return callback(new Error('unable to find ' + folder + ' for sync.'));
                if (!/^s3\/.*\//.test(folder))
                  return callback(new Error('unable to recognize ' + folder + ' as a s3 resource.'));
                var match = folder.match(/^s3\/([^\/]*)\/(.*)$/);
                if (match) {
                  info = {bucket:match[1], prefix:match[2]};
                }
              }
            } else
              folder = root.key;
            if (p.length > 0) {
              info = {
                bucket: p.splice(0, 1)[0],
                prefix: p.join('/')
              };
            } else {
              info = null;
            }
            realContent(info, null, true, snarfBucketContent, function () {
              Asset.find({isfolder:true}, function (e, folders) {
                if (e || folders.length == 0) {
                  doNext();
                  return;
                }
                var wasDone = false;
                function doNext() {
                  if (!wasDone) {
                    callback(null, result);
                    wasDone = true;
                  }
                }
                function updateFolder(index) {
                  var folder = folders[index];
                  var query = folder.isfolder
                    ? { key:{ $regex:'^' + folder.key + '[^/]+/?$' }, isvirtual:false, isfolder:false }
                    : { key:{ $regex:'^[^/]+/?$' }, isvirtual: false, isfolder:false };
                  Asset.update(query, { folder: folder._id }, { multi: true }, function (e, c) {
                    var log = 'searching "' + folder.key + '" - ' + c;
                    calipso.debug(log);
                    result.push(log);
                    if ((folders.length - 1) == index) {
                      doNext();
                    } else {
                      updateFolder(index + 1);
                    }
                  });
                }
                updateFolder(0);
              });
            });
          });
        },
        listFiles: function (project, folder, callback) {
          var Asset = calipso.db.model('Asset');
          var url = 'proj/' + project + '/' + folder;
          if (url[url.length - 1] !== '/')
            url += '/';
          Asset.findOne({isfolder:true, alias:url }, function (err, project) {
            if (err) {
              return callback(err, null);
            }
            var query = Asset.find({folder:project._id}).sort('isfolder', -1).sort('title', 1);
            callback(err, query);
          });
        },
        deleteAsset: function (path, callback) {
          var Asset = calipso.db.model('Asset');
          Asset.findOne({alias:path}, function (err, asset) {
            if (err)
              return callback(err, null);
            if (!asset)
              return callback(new Error('unable to find asset to delete ' + path), null);
            if (asset.key !== '') {
              if (asset.key.indexOf('/') === (asset.key.length - 1)) {
                // This is a bucket!
                return callback(new Error("can't delete a bucket for now"), null);
              }
              var paths = asset.key.split('/');
              // TODO: Implement delete.
              if (asset.isfolder) {
                var k = knox({
                  'bucket': paths[0]
                });
                var assetsToDelete = [asset];
                var folders = [asset];
                function multiDelete() {
                  var list = assetsToDelete.splice(0, 1000); // We can only support 1000 at a time.
                  if (list.length === 0) {
                    // All done!
                    return callback(null, asset);
                  }
                  var xml = ['<?xml version="1.0" encoding="UTF-8"?>\n','<Delete>'];
                  var query = [];
                  list.forEach(function (item) {
                    xml.push('<Object><Key>', item.key, '</Key></Object>');
                    query.push(item._id);
                  });
                  xml.push('</Delete>');
                  xml = xml.join('');
                  var s3req = k.request('POST', '/?delete', {
                    'Content-Length': xml.length,
                    'Content-MD5': crypto.createHash('md5').update(xml).digest('base64'),
                    'Accept:': '*/*',
                  })
                    .on('error', function (err) {
                      return callback(new Error('unable to delete ' + err.message), null);
                    })
                    .on('response', function (s3res) {
                      if (s3res.statusCode !== 200) {
                        var data = '';
                        s3res.on('data', function (chunk) {
                          data += chunk;
                        });
                        s3res.on('end', function () {
                          return callback(new Error('unable to delete file ' + data))
                        });
                        s3res.on('error', function (err) {
                          return callback(new Error('unable to delete file ' + err.message));
                        });
                        return;
                      }
                      Asset.remove({'_id':{$in:query}}, function (err) {
                        if (err) {
                          return callback(new Error('unable to delete folder ' + err.message));
                        }
                        multiDelete();
                      });
                    });
                  s3req.write(xml);
                  s3req.end();
                }
                function addFiles() {
                  var folder = folders.splice(0, 1)[0];
                  if (!folder) {
                    // We're all done adding files to the paths list
                    return multiDelete();
                  }
                  Asset.find({folder:folder._id}, function (err, files) {
                    files.forEach(function (file) {
                      if (file.isfolder) {
                        folders.push(file);
                      }
                      assetsToDelete.add(file);
                    });
                    addFiles();
                  });
                }
                addFiles();
              } else {
                var k = knox({
                  'bucket': paths[0],
                });
                var s3req = k.request('DELETE', escape(asset.key))
                  .on('error', function(err) {
                    return callback(new Error('unable to delete ' + err.message), null);
                  })
                  .on('response', function(s3res) {
                    if (s3res.statusCode !== 204) {
                      var data = '';
                      s3res.on('data', function (chunk) {
                        data += chunk;
                      });
                      s3res.on('end', function () {
                        return callback(new Error('unable to delete file ' + data))
                      });
                      s3res.on('error', function (err) {
                        return callback(new Error('unable to delete file ' + err.message));
                      });
                      return;
                    }
                    asset.remove(function (err) {
                      return callback(err, asset);
                    });
                  });
                  s3req.end();
              }
            } else {
              asset.remove(function (err) {
                return callback(err, asset);
              });
            }
          });
        },
        updateParents: function (asset, author, callback) {
          if (asset.folder) {
            var Asset = calipso.db.model('Asset');
            Asset.findOne({_id:asset.folder}, function (err, folder) {
              if (err || !folder) {
                return callback(new Error('unable to find parent folder ' + (err ? err.message : '')), folder);
              }
              folder.updated = new Date();
              folder.author = author;
              folder.save(function (err) {
                if (err) {
                  return callback(new Error('unable to update parent folder ' + err.message), folder);
                }
                updateParents(folder, author, callback);
              })
            })
          } else
            callback(null, null);
        },
        // Arguments
        // path: The destination path ('s3/<bucket>/<key>' or 'proj/<projectname>/<rootfolder>/<key>')
        //  Alternative for s3 URL
        //   bucket: The name of the bucket
        //   key: The file key
        //  Alternative for project URL
        //   project: The name of the project
        //   root: The name of the root folder
        //   key: The file key (within the root '[<subfolder>/]<filename>')
        // copyStream: Stream to copy asset from
        //  copyStreamSize: Size of stream or we'll stat stream.path
        //  copyStreamPaused: True if the stream is already paused (otherwise we'll pause it)
        // copySource: asset alias to copy the file from (resolved to s3 URL)
        // author: the author to use
        createAsset: function (options, callback) {
          var Asset = calipso.db.model('Asset');
          var path = options.path;
          if (!path) {
            if (options.bucket) {
              path = 's3/' + options.bucket + '/' + options.key;
            } else if (options.project) {
              path = 'proj/' + options.project + '/' + options.root + '/' + options.key;
            }
          }
          if (!path) return callback(new Error("Could not create asset. No path specified"), null);
          var copySource = options.copySource;
          var copyStream = options.copyStream;
          var copyStreamSize = options.copyStreamSize;
          if (copyStream && !options.copyStreamPaused)
            copyStream.pause();
          var author = options.author || 'testing';
          var paths = path.split('/');
          var isFolder = paths[paths.length - 1] === '';
          var root = paths[0];
          if (isFolder)
            paths.splice(paths.length - 1, 1);
          var fileName = paths[paths.length - 1];
          var isBucket = (root === 's3') && (paths.length == 2);
          var parentFolder = '';
          var filesize;
          for (var i = 0; i < (paths.length - 1); i++) {
            parentFolder += paths[i] + '/';
          }
          if (isBucket) {
            // Create a new bucket
            // This is a PUT with no alias.
            var k = knox({
              'bucket': fileName,
            });
            var Asset = calipso.db.model('Asset');
            if (path[alias.length - 1] !== '/')
              path += '/';
            Asset.findOne({isfolder:true, alias:alias}, function (err, asset) {
              var author = (req.session && req.session.user) || 'testing';
              if (!asset) {
                asset = new Asset();
                asset.title = paths[1];
                asset.author = author;
                calipso.debug('create new bucket ' + alias);
              } else
                calipso.debug('found bucket ' + alias);
              asset.isfolder = true;
              asset.alias = alias;
              asset.key = paths[1] + '/';
              asset.save(function (err) {
                if (err) {
                  return callback(new Error("unable to save bucket " + err.message), null);
                }
                var sreq = k.request('PUT', '', {
                  'Content-Length': '0',
                  'x-amz-acl': 'private'
                });
                sreq.on('error', function(err) {
                  asset.remove(function () {
                    return callback(new Error("unable to create bucket " + err.message), null);
                  });
                }).on('response', function(s3res) {
                  //s3res.end();
                  return callback(null, asset);
                }).end();
              });
            });
            return;
          }
          function interactWithS3(asset, hasSize, headers) {
            headers = headers || {};
            if (copyStream) {
              if (copyStreamSize) {
                headers['Content-Length'] = copyStreamSize;
              } else if (!hasSize) {
                fs.stat(copyStream.path, function (err, stat) {
                  if (err)
                    return callback(new Error('unable to stat stream path ' + copyStream.path));
                  calipso.debug('Uploading from stream ' + copyStream.path + ' with length ' + stat.size);
                  headers['Content-Length'] = stat.size;
                  interactWithS3(asset, true, headers);
                });
                return;
              }
            } else {
              headers['x-amz-copy-source'] = copySource;
              if (copySource && /(proj|s3)\//.test(copySource)) {
                Asset.findOne({alias:copySource}, function (err, copyAsset) {
                  if (err || !copyAsset) {
                    return callback(new Error('unable to resolve copy source'));
                  }
                  calipso.debug('Rewriting copySource from ' + copySource + ' to /' + copyAsset.key);
                  copySource = '/' + escape(copyAsset.key);
                  headers['x-amz-copy-source'] = copySource;
                  filesize = copyAsset.size;
                  interactWithS3(asset);
                });
                return;
              }
              if (copySource)
                headers['Content-Length'] = 0;
            }
            var paths = asset.key.split('/');
            var fileName = paths[paths.length - 1];
            var bucket = paths.splice(0, 1)[0];
            var k = knox({
              bucket: bucket
            });
            var s3key = paths.join('/');
            var contentType = mime.lookup(fileName);
            headers['Content-Type'] = contentType;
            headers['Expect'] = '100-continue';
            calipso.debug('Putting ' + s3key + " with " + JSON.stringify(headers));
            var s3req = k.request('PUT', escape(s3key), headers)
              .on('error', function(err) {
                callback(err, null);
                calipso.debug(err);
              })
              .on('response', function(s3res) {
                var data = "";
                s3res.on('data', function (chunk) {
                  data += chunk;
                });
                s3res.on('end', function () {
                  if (s3res.statusCode != 200)
                    return callback(new Error(data), asset, data);
                  return callback(null, asset, data);
                });
              });
              if (copyStream) {
                copyStream.on('data', function (chunk) {
                  s3req.write(chunk);
                });
                copyStream.on('end', function () {
                  s3req.end();
                });
                copyStream.on('error', function (err) {
                  callback(new Error('Unable to send stream ' + err.message));
                });
                copyStream.resume();
              } else
                s3req.end();
          }
          var Asset = calipso.db.model('Asset');
          // Search for the folder first
          Asset.findOne({alias:parentFolder}, function(err, folder) {
            if(err || !folder) {
              // If we didn't find the folder then it has not been created yet.
              return callback(new Error('unable to find parent folder ' + parentFolder), null);
            }
            // Search for the asset with this alias.
            Asset.findOne({alias:path, folder:folder._id}).run(function(err, asset) {
              if(err || !asset) {
                if (isFolder && (folder.key === '')) {
                  return callback(new Error("this folder is rooted and not storage allocated for parent folder " + parentFolder), null);
                }
                var s3path = folder.key + fileName;
                if (isFolder)
                  s3path += '/';
                if (!asset) {
                  calipso.debug('new asset ' + path);
                  asset = new Asset({isfolder:isFolder,
                    key:s3path, folder:folder._id, alias:path, title:fileName, author:author});
                } else {
                  calipso.debug('existing asset ' + path);
                }
                if (filesize !== undefined)
                  asset.size = filesize;
                var match = s3path.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
                var project = null;
                if (match) {
                  asset.isroot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == s3path;
                  if (asset.isroot) {
                    project = match[2];
                    asset.isroot = false;
                    asset.title = match[3];
                    var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
                    calipso.debug("rewriting uri from " + s3path + " to " + newUri);
                    asset.alias = newUri;
                  } else {
                    // For a normal asset that's part of a project rewrite it to say
                    // {project}/{rootfolder}/{restofuri}
                    var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
                    calipso.debug("rewriting uri from " + asset.key + " to " + newUri);
                    asset.alias = newUri;
                  }
                }
                function saveAsset() {
                  asset.save(function (err) {
                    if (err) {
                      return callback(new Error("unable to save asset " + err.message), null);
                    }
                    if (isFolder) {
                      return callback(null, asset);
                    } else
                      interactWithS3(asset);
                  });
                }
                if (project) {
                  // Search and create project first
                  var q = {isproject:true, alias:'proj/' + project + '/'};
                  Asset.findOne(q, function (err, proj) {
                    if (!proj) {
                      calipso.debug('new project proj/' + project + '/');
                      proj = new Asset(q);
                    } else
                      calipso.debug('existing project proj/' + project + '/');
                    proj.key = '';
                    proj.author = author;
                    proj.title = project;
                    proj.isfolder = true;
                    proj.save(function (err) {
                      if (err) {
                        return callback(new Error("unable to create corresponding project " + err.message), null);
                      }
                      asset.folder = proj._id;
                      saveAsset();
                    })
                  });
                } else
                  saveAsset();
                return; // done putting new file
              }
              if (asset.isfolder) {
                return callback(null, asset);
              }
              return interactWithS3(asset);
            });
          });
        }
      };

      // Default Asset Schema TODO -gajohnson add assetpath property, isProject boolean property
      var Asset = new calipso.lib.mongoose.Schema({
        title: {type: String, required: true, "default": ''},
        description: {type: String, required: false, "default": ''},
        taxonomy: {type: String, "default":''},
        key: {type: String, required: false, "default": ''}, // This is the undelying S3 key (or path to file or folder)
        size: {type: Number, required: false},
        folder: {type: calipso.lib.mongoose.Schema.ObjectId, ref: 'Asset', required: false},
        isfolder: {type: Boolean, "default":false},
        isroot: {type: Boolean, "default":false},
        isproject:{type: Boolean, "default":false},
        isvirtual: {type: Boolean, "default":false},
        alias: {type: String, required: true}, // This is the user visible path
        author: {type: String, required: true},
        etag: {type: String, "default":''},
        tags: [String],
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now },
      });
      var AssetPermissions = new calipso.lib.mongoose.Schema({
        project: {type: String, required: true},
        user: {type: String, required: true},
        action: {type: String, required: true}
      });

      // Set post hook to enable simple etag generation
      Asset.pre('save', function (next) {
        this.etag = calipso.lib.crypto.etag(this.title + this.description + this.key);
        next();
      });

      calipso.db.model('Asset', Asset);
      calipso.db.model('AssetPermissions', AssetPermissions);
      module.initialised = true;

      next();
    }
  );
}

function assetForm(asset) {
  var url = "";
  if (asset && !asset.isfolder) {
    var alias = asset.alias;
    url = '<h5></br><a href="' + alias + '">' + alias + '</a>';
    if (!asset.isproject)
      url += '</br>s3://' + asset.key + '</h5>';
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
 * Edit Content Form
 * Edit an existing piece of asset.
 */
function editAssetForm(req,res,template,block,next) {

  var Asset = calipso.db.model('Asset');
  var id = req.moduleParams.id;
  var item;

  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";

  var aPerm = calipso.permission.Helper.hasPermission("admin:user");

  res.menu.adminToolbar.addMenuItem(req, {name:'List',weight:1,path:'list',url:'/asset/',description:'List all ...',permit:aPerm});
  res.menu.adminToolbar.addMenuItem(req, {name:'View',weight:2,path:'show',url:'/s3/' + id,description:'Download actual file ...',permit:aPerm});
  res.menu.adminToolbar.addMenuItem(req, {name:'Edit',weight:3,path:'edit',url:'/assets/' + id,description:'Edit asset ...',permit:aPerm});
  res.menu.adminToolbar.addMenuItem(req, {name:'Delete',weight:4,path:'delete',url:'/assets/delete/' + id,description:'Delete asset ...',permit:aPerm});


  Asset.findById(id).populate('folder').run(function(err, c) {

    if(err || c === null) {

      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      req.flash('error', req.t('Unable to find this asset'));
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

        var Asset = calipso.db.model('Asset');

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
                      calipso.lib.assets.updateParents(c.folder, function (err) {
                        req.flash('info',req.t('Content saved.'));

                        // Raise CONTENT_CREATE event
                        calipso.e.post_emit('CONTENT_UPDATE',c,function(c) {
                          if(returnTo) {
                            res.redirect(returnTo);
                          } else {
                            // use the reference to the originally id deifned by req.moduleParams.id
                            res.redirect('/s3/' + id);
                          }
                          next();
                        });
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

/***
 * Show asset - called by ID or Alias functions preceeding
 */
function showAsset(req,res,template,block,next,err,asset,format) {
  if(asset.isfolder) {
    req.flash('error', req.t('This asset refers to a folder and not a file.'));
    res.statusCode = 404;
    next();
    return;
  }
  var k = require('knox').createClient({
    key: calipso.config.get("s3:key"),
    secret: calipso.config.get("s3:secret"),
    bucket: asset.bucket.alias
  });
  var fileName = path.basename(asset.alias);
  var contentType = mime.lookup(fileName);
  var range = req.header['Range'];
  var headers = {'response-content-type':contentType};
  if (range)
    headers['Range'] = range;
  knox.get(escape(asset.alias), headers).on('response', function(s3res) {
    var buffer = new Buffer(0);
    var headers = {};
    if (req.url.substring(req.url.length - fileName.length) !== fileName)
      headers['Content-Disposition'] = 'inline; filename="' + fileName + '"';
    for (var v in s3res.headers) {
      headers[v] = s3res.headers[v];
    }
    s3res.on('error', function(err) {
      next();
    });
    s3res.on('end', function (chunk) {
      next();
    });
    res.statusCode = 200;
    res.writeHead(200, headers);
    s3res.pipe(res);
  }).end();        // Just return the object
}

function listAssets(req,res,template,block,next) {  
  var tag = req.moduleParams.tag ? req.moduleParams.tag : '';
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var sortBy = req.moduleParams.sortBy;
  var params = {req:req,res:res,template:template,block:block,format:format,sortBy:sortBy,limit:req.moduleParams.limit,from:req.moduleParams.from};
  var Asset = calipso.db.model('Asset');

  var aPerm = calipso.permission.Helper.hasPermission("admin:user");
  res.menu.adminToolbar.addMenuItem(req, {name:'Create',weight:1,path:'new',url:'/content/new',description:'Create content ...',permit:aPerm});

  // alias is the path into the asset
  var alias = [];
  var root = null;
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i])
      alias.push(req.moduleParams['f' + i]);
  }
  if (alias.length > 0) {
    if (alias.length > 0)
      alias = alias.join('/') + '/';
    else
      alias = null;
  } else
    alias = null;

  var query = new Query();
  
  function finish() {
    res.menu.adminToolbar.addMenuItem(req, {name:'Create Bucket',weight:1,path:'new',url:'/assets/new',description:'Create Bucket ...',permit:aPerm});
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

    // Re-retrieve our object
    getAssetList(query,params,next);
  }
  if (alias) {
    Asset.findOne({alias:alias,isfolder:true}).populate('folder').run(function (err, folder) {
      if (!err && folder) {
        // query for the parent folder
        query.where('folder', folder._id);
        // Also return the folder itself to be able to display this as a link to the parent folder.
        query._conditions = {$or:[query._conditions,{_id:folder.id}]};
        params.folder = folder;
        finish();
      } else {
        res.statusCode = 404;
        req.flash('error', req.t('Unable to find parent folder {alias}: {error}', {alias:alias, error:(err && err.message) || 'Unknown error'}));
        next();
        return;
      }
    });
  } else {
    // at the root of the system we just see the buckets
    query.or([{'isroot':true},{'isproject':true}]);
    finish();
  }
};

function syncAssets(req, res, route, next) {
  var Asset = calipso.db.model('Asset');
  var info;
  function realContent(info, asset, atRoot, callback, next) {
    var bucket = '';
    if (asset) {
      var s = asset.key.split('/');
      bucket = s[0];
    }
    var expat = require('node-expat');
    var knox = require('knox').createClient({
      key: calipso.config.get("s3:key"),
      secret: calipso.config.get("s3:secret"),
      bucket: bucket
    });
    if (info && info.bucket && asset && bucket !== info.bucket) {
      return next();
    }
    knox.get((info && info.prefix) ? ('?prefix=' + info.prefix) : '').on('response', function(s3res){
      s3res.setEncoding('utf8');
      var parser = new expat.Parser();
      var items = [];
      var item = null;
      var dirs = {};
      var property = null;
      var owner = null;
      var message = null;
      var code = null;
      var Asset = calipso.db.model('Asset');
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
          property = 'key';
        } else if (name === 'CreationDate') {
          property = 'created';
        } else if (name === 'LastModified') {
          property = 'updated';
        } else if (name === 'ETag') {
          property = 'etag';
        } else if (name === 'Name') {
          property = 'key';
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
          if (item.key.substring(item.key.length - 1) === '/')
            dirs[item.key] = true;
          else if (asset) {
            var paths = item.key.split('/');
            paths.splice(paths.length - 1, 1);
            paths = paths.join('/') + '/';
            if (!dirs[paths] && paths !== '/') {
              var fakeItem = {key:paths,size:0,isfolder:true,author:item.author};
              items.push(fakeItem);
              dirs[paths] = true;
            }
          }
          items.push(item);
          item = null;
        } else if (name === 'ListBucketResult' || name === 'ListAllMyBucketsResult') {
          callback(null, items, asset, atRoot, next);
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
          if (property === 'key') {
            if (asset)
              item[property] = bucket + '/' + s;
            else
              item[property] = s + '/';
          } else if (property === 'Size') {
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
  function snarfBucketContent(err, items, parent, atRoot, next) {
    if (err) {
      return;
    }
    var asset = items.splice(0, 1)[0]; // take the first item
    if (!asset) {
      if (next)
        next(null);
      return;
    }
    var query = {key:asset.key};
    Asset.findOne(query, function (err, assetFound) {
      var isNew = false;
      if (!assetFound) {
        assetFound = new Asset();
        isNew = true;
      }
      var paths = asset.key.split('/');
      if (paths[paths.length - 1] === '')
        paths.splice(paths.length - 1, 1);
      var fileName = paths[paths.length - 1] || 'Untitled';
      paths.splice(paths.length - 1, 1);
      var folderPath = null;
      if (paths.length > 0)
        folderPath = paths.join('/') + '/';
      if (!assetFound.title || assetFound.title === 'undefined') {
        assetFound.title = (parent === null) ? asset.key : fileName;
      }
      assetFound.isfolder = asset.key.substring(asset.key.length - 1) === '/';
      assetFound.isroot = false;
      if (!assetFound.isfolder)
        assetFound.size = asset.size;
      else
        assetFound.size = null;
      assetFound.key = asset.key; // S3 name
      var project = null;
      var match = assetFound.key.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
      assetFound.alias = 's3/' + asset.key;
      if (match) {
        assetFound.isroot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == assetFound.key;
        if (assetFound.isroot) {
          project = match[2];
          assetFound.isroot = false;
          assetFound.title = match[3];
          var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
          calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
          assetFound.alias = newUri;
        } else {
          // For a normal asset that's part of a project rewrite it to say
          // {project}/{rootfolder}/{restofuri}
          var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
          calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
          assetFound.alias = newUri;
        }
      } else if (/s3\/[^\/]*\/$/.test(assetFound.alias)) {
        assetFound.isroot = true;
      }
      assetFound.author = asset.author;
      if (assetFound.isbucket) {
        if (!info || !info.bucket || info.bucket === assetFound.alias)
          res.write((isNew ? 'new ' : 'update ') + ' bucket "' + asset.key + '"\n');
      } else if (parent && assetFound.isfolder) {
        res.write((isNew ? 'new ' : 'update ') + '"' + asset.key + '"\n');
      }
      function saveAsset() {
        assetFound.save(function (err) {
          if (err) {
            calipso.error("error:", err)
            next();
            return;
          }
          if (parent) {
            snarfBucketContent(err, items, parent, atRoot, function (err) {
              snarfBucketContent(err, items, parent, false, next);
            });
          } else {
            realContent(info, assetFound, false, snarfBucketContent, function (err) {
              snarfBucketContent(err, items, parent, false, next);
            });
          }
        });
      }
      if (project) {
        var pq = {isproject:true,alias:'proj/' + project + '/',key:'',isvirtual:true};
        Asset.findOne(pq, function (e, proj) {
          var newProj = false;
          if (e || !proj) {
            newProj = true;
            proj = new Asset(pq);
          }
          proj.author = asset.author;
          proj.title = project;
          proj.isroot = true;
          proj.isfolder = true;
          calipso.debug((newProj ? 'new project ' : 'update project ') + proj.title);
          proj.save(function (err) {
            if (err) {
              calipso.error("error:", err);
              next();
              return;
            }
            assetFound.folder = proj._id;
            assetFound.isvirtual = true;
            saveAsset();
          });
        });
      } else
        saveAsset();
    });
  }

  var p = [];
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i])
      p.push(req.moduleParams['f' + i]);
  }
  
  if (p.length > 0) {
    info = {
      bucket: p.splice(0, 1)[0],
      prefix: p.join('/')
    };
  } else {
    info = null;
  }
  
  realContent(info, null, true, snarfBucketContent, function () {
    Asset.find({isfolder:true}, function (e, folders) {
      if (e || folders.length == 0) {
        doNext();
        return;
      }
      var wasDone = false;
      function doNext() {
        if (!wasDone) {
          res.end();
          next();
          wasDone = true;
        }
      }
      function updateFolder(index) {
        var folder = folders[index];
        var query = folder.isfolder
          ? { key:{ $regex:'^' + folder.key + '[^/]+/?$' }, isvirtual:false, isfolder:false }
          : { key:{ $regex:'^[^/]+/?$' }, isvirtual: false, isfolder:false };
        Asset.update(query, { folder: folder._id }, { multi: true }, function (e, c) {
          res.write('searching "' + folder.key + '" - ' + c + '\n');
          if ((folders.length - 1) == index) {
            doNext();
          } else {
            updateFolder(index + 1);
          }
        });
      }
      updateFolder(0);
    });
  });
}

/**
 * Helper function for link to user
 */
function formatSize(req,asset) {
  if (asset.IsDirectory)
    return "DIR";
  return asset.Size;
}

function assetType(req,asset) {
  if (asset.isbucket)
    return "S3 Bucket";
  if (asset.isproject)
    return "Project";
  if (asset.isfolder)
    return "Folder";
  return asset.size;
}

/**
 * Take a query and parameters, return or render asset lists
 * This has been refactored so it can be called as a helper (e.g. views)
 * From a theme
 */
function getAssetList(query,out,next) {
  var pager = out.hasOwnProperty('pager') ? out.pager : true;

  var Asset = calipso.db.model('Asset');

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
    qry = calipso.table.sortQuery(qry, out.sortBy);
    qry.options.sort = qry.options.sort || [];
    qry.options.sort.splice(0, 0, ['isfolder',-1]);
    qry.options.sort.splice(0, 0, ['isproject',-1]);
    qry.find(function (err, assets) {
       if(out && out.res) {
         // Render the item into the response
         if(out.format === 'html') {
           // This is where the asset table is rendered for HTML.
           // We might need a folder like view composed of a bunch of <div> instead.
           var table = {id:'content-list',sort:true,cls:'table-admin',
               columns:[{name:'title',sort:'title',label:'Title',fn:function(req, asset) {
                   if (asset.id === (out.folder && out.folder.id)) {
                     if (out.folder.isroot)
                       return calipso.link.render({id:asset.alias,title:req.t('View root folder list'),label:'Root',url:'/asset/'});
                     else if (out.folder.folder && out.folder.folder.isproject)
                       return calipso.link.render({id:out.folder.alias,title:req.t('View parent project {parent}', {parent:out.folder.folder.title}),label:'Parent Folder',url:'/asset/' + out.folder.folder.alias});
                     else if (out.folder.folder && out.folder.folder.isfolder)
                       return calipso.link.render({id:out.folder.alias,title:req.t('View parent folder {parent}', {parent:out.folder.folder.title}),label:'Parent Folder',url:'/asset/' + asset.bucket.alias + '/' + out.folder.folder.alias});
                   }
                   if (asset.isproject)
                     return calipso.link.render({id:asset.alias,title:req.t('View project {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.alias});
                   if (asset.isfolder)
                     return calipso.link.render({id:asset.alias,title:req.t('View folder {asset}',{asset:asset.title}),label:asset.title,url:'/asset/' + asset.alias});
                   return calipso.link.render({id:asset.alias,title:req.t('Edit file {asset}',{asset:asset.title}),label:asset.title,url:'/assets/' + asset._id});
                 }},
                 {name:'alias',label:'Alias',fn:function(req, asset) {
                    var file = asset.alias;
                    if (out.path)
                      file = file.replace(out.path, '');
                    if (asset.isbucket)
                      return file;
                    if (asset.isproject)
                      return asset.title;
                    else
                      return calipso.link.render({id:file,title:req.t('View file {asset}',{asset:asset.title}),label:file,url:'/'+asset.alias});
                  }},
                 {name:'isfolder',label:'Type',fn:assetType},
                 {name:'key',label:'S3 Key'},
                 {name:'author',label:'Author'},
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

           var tableHtml = calipso.table.render(out.req, table);

           calipso.theme.renderItem(out.req,out.res,tableHtml,out.block,null,next);
         }
         if(out.format === 'json') {
           out.res.format = out.format;
           out.res.end(contents.map(function(u) {
             return u.toObject();
           }));
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
             req.flash('error', req.t('Unable to find rss template.'));
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

