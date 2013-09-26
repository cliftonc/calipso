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
  init:init,
  route:route,
  assetForm:assetForm,
  config:{
    s3key:{
      "default":"",
      "label":"S3 Access Key",
      "type":"text",
      "description":"This is the S3 Access Key the module will use to communicate with S3."
    },
    s3secret:{
      "default":"",
      "label":"S3 Secret Key",
      "type":"password",
      "description":"This is the S3 Secret Key the module will use to communicate with S3."
    }
  }
};

/*
 * Router
 */
function route(req, res, module, app, next) {
  // Menu items

  var mPerm = calipso.permission.Helper.hasPermission("asset:manage:manage"),
    vPerm = calipso.permission.Helper.hasPermission("asset:manage:view");

  res.menu.admin.addMenuItem(req, {name:'Asset Management', path:'asset', url:'/asset', description:'Manage assets ...', permit:mPerm, icon:"icon-file"});
  res.menu.admin.addMenuItem(req, {name:'Asset', path:'asset/content', url:'/asset', description:'Manage assets ...', permit:vPerm, icon:"icon-file"});

  // Routing and Route Handler
  module.router.route(req, res, next);
}

function invalidateBuckets() {
  bucketCheck = Date().getTime();
}

// Standard knox interface with the correct key and secret.
function knox(options) {
  options = calipso.lib._.extend({
    key:calipso.config.getModuleConfig("assets", "s3key"),
    secret:calipso.config.getModuleConfig("assets", "s3secret")
  }, options);
  return knox_mod.createClient(options);
}

function testAssets(req, res, route, next) {
  calipso.debug('testing');
  calipso.lib.assets.createAsset({path:'proj/project1/archive/testing/', author:'andy'}, function (err, asset) {
    if (err) {
      return res.send(500, err.message);
    }
    res.write(JSON.stringify(asset) + '\n');
    calipso.lib.assets.createAsset({path:'proj/project1/archive/testing/badfile.coffee', copySource:'proj/project1/archive/badFile.coffee', author:'andy'}, function (err, asset) {
      calipso.debug('deleting');
      calipso.lib.assets.deleteAsset('proj/project1/archive/testing/badfile.coffee', 'andy', function (err) {
        if (err) {
          res.write("unable to delete file badfile.coffee " + err.message);
          res.end();
          return;
        }
        calipso.debug('deleting');
        calipso.lib.assets.deleteAsset('proj/project1/archive/testing/', 'andy', function (err) {
          if (err) {
            res.write("unable to delete folder " + err.message);
            res.end();
            return;
          }
          res.write("folder deleted\n");
          calipso.lib.assets.createAsset({path:'s3/ai-test2/project:newproject:archive/', author:'andy'}, function (err, asset) {
            if (err) {
              res.write("unable to create project " + err.message);
              res.end();
              return;
            }
            res.write("created project and root folder\n");
            calipso.lib.assets.createAsset({path:'proj/newproject/archive/something.txt', copyStream:fs.createReadStream(path.join(__dirname, 'assets.js'))}, function (err, asset) {
              if (err) {
                res.write("unable to create sample file " + err.message);
                res.end();
                return;
              }
              res.write("created sample file using stream\n");
              calipso.lib.assets.deleteAsset('proj/newproject/', 'andy', function (err, asset) {
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
  calipso.e.addEvent('ASSET_UPDATE', {enabled:true, hookio:true});
  calipso.e.addEvent('ASSET_UPDATE_FORM', {enabled:true, hookio:true});
  calipso.e.addEvent('ASSET_CREATE_FORM', {enabled:true, hookio:true});
  calipso.e.addEvent('ASSET_CREATE', {enabled:true, hookio:true});
  // Add listener to config_update
  calipso.e.post('ASSET_UPDATE', module.name, calipso.reloadConfig);

  // Admin routes
  calipso.lib.step(
    function defineRoutes() {
      var isAdmin = calipso.permission.Helper.hasPermission("admin:user");

      // Admin operations
      //module.router.addRoute('GET /assettest', testAssets, {admin:true, permit:isAdmin}, this.parallel());
      module.router.addRoute('GET /asset/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?.:format?', listAssets, {
        template:'listAdmin',
        block:'content.list'
      }, this.parallel());
      module.router.addRoute('GET /pub/:production?/:filename?', listAssets, {
        template:'listAdmin',
        block:'content.list',
      }, this.parallel());
      module.router.addRoute('PUT /asset/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?.:format?', listAssets, {
        template:'listAdmin',
        block:'content.list',
      }, this.parallel());
      module.router.addRoute('DELETE /asset/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?.:format?', listAssets, {
        template:'listAdmin',
        block:'content.list',
        admin:true,
        permit:isAdmin
      }, this.parallel());
      module.router.addRoute('GET /assets/addfolder/:f1?/:f2?/:f3?/:f4?/:f6?/:f8?/:f9?/:f10?', addFolder, {admin:true, block:'content.list', permit:isAdmin}, this.parallel());
      module.router.addRoute('POST /assets/addfolder/:f1?/:f2?/:f3?/:f4?/:f6?/:f8?/:f9?/:f10?', addFolder, {admin:true, permit:isAdmin}, this.parallel());
      module.router.addRoute('GET /assets/upload/:f1?/:f2?/:f3?/:f4?/:f6?/:f8?/:f9?/:f10?', uploadAsset, {admin:true, block:'content.list', permit:isAdmin}, this.parallel());
      module.router.addRoute('POST /assets/upload/:f1?/:f2?/:f3?/:f4?/:f6?/:f8?/:f9?/:f10?', uploadAsset, {admin:true, permit:isAdmin}, this.parallel());
      module.router.addRoute('GET /assets/sync/:f1?/:f2?/:f3?/:f4?/:f5?/:f6?/:f8?/:f9?/:f10?', syncAssets, {admin:true, permit:isAdmin}, this.parallel());
      module.router.addRoute('GET /assets/:id', editAssetForm, {block:'content.edit'}, this.parallel());
      module.router.addRoute('POST /assets/:id', updateAsset, {block:'content.edit'}, this.parallel());
      module.router.addRoute('GET /assets/delete/:id', deleteAsset, {block:'content.edit'}, this.parallel());
    }, function done() {
      // Get asset list helper
      calipso.helpers.addHelper('getAssetList', function () {
        return getAssetList;
      });
      calipso.lib.assets = {
        knox:knox,
        assetModel:function () {
          return calipso.db.model('Asset');
        },
        findAssets:function () {
          var Asset = calipso.db.model('Asset');
          if (typeof arguments === 'object' && arguments[0]) {
            arguments[0]['hidden'] = {$ne:true};
          }
          return Asset.find.apply(Asset, arguments);
        },
        findOneAsset:function () {
          var Asset = calipso.db.model('Asset');
          return Asset.findOne.apply(Asset, arguments);
        },
        updateAssets:function () {
          var Asset = calipso.db.model('Asset');
          return Asset.update.apply(Asset, arguments);
        },
        listProjects:function (callback) {
          var Asset = calipso.db.model('Asset');
          var query = Asset.find({isproject:true});
          process.nextTick(function () {
            callback(null, query);
          });
        },
        syncFolder:function (folder, callback, progress) {
          var Asset = calipso.db.model('Asset');
          var info = null;

          function realContent(info, asset, atRoot, callback, next) {
            var bucket = '';
            if (asset) {
              var s = asset.key.split('/');
              bucket = s[0];
            }
            var nodeXml = require('node-xml');
            var knox = require('knox').createClient({
              key:calipso.config.getModuleConfig("assets", "s3key"),
              secret:calipso.config.getModuleConfig("assets", "s3secret"),
              bucket:bucket
            });
            if (info && info.bucket && asset && bucket !== info.bucket) {
              return next();
            }
            if (progress) {
              if (bucket) {
                progress('Listing S3 bucket ' + bucket + ' with prefix ' + (info && info.prefix) || '/');
              } else {
                progress('Listing all S3 buckets');
              }
            }
            knox.get((info && info.prefix) ? ('?prefix=' + info.prefix) : '').on('response',function (s3res) {
              s3res.setEncoding('utf8');
              var items = [];
              var item = null;
              var dirs = {};
              var property = null;
              var owner = null;
              var message = null;
              var code = null;
              var Asset = calipso.db.model('Asset');
              parser.addListener('startElement', function (name, attrs) {
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
                } else if (name === 'DisplayName') {
                  property = 'author';
                }
              });
              parser.addListener('endElement', function (name) {
                if (name === 'Error') {
                  callback({code:code, message:message}, null, asset);
                } else if (name === 'Contents' || name == 'Bucket') {
                  if (!item.author) {
                    item.author = owner;
                  }
                  if (item.key.substring(item.key.length - 1) === '/') {
                    dirs[item.key] = true;
                  } else if (asset) {
                    var paths = item.key.split('/');
                    paths.splice(paths.length - 1, 1);
                    paths = paths.join('/') + '/';
                    if (!dirs[paths] && paths !== '/') {
                      var fakeItem = {key:paths, size:0, isfolder:true, author:item.author};
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
              parser.addListener('text', function (s) {
                if (property === 'code') {
                  code = s;
                } else if (property === 'message') {
                  message = s;
                } else if (property === 'author') {
                  owner = s;
                }
                if (property && item) {
                  if (property === 'key') {
                    if (asset) {
                      item[property] = bucket + '/' + s;
                    } else {
                      item[property] = s + '/';
                    }
                  } else if (property === 'Size') {
                    if (/\/$/.test(item.Key)) {
                      item.IsDirectory = true;
                    } else {
                      item.IsFile = true;
                    }
                    item[property] = s;
                  } else {
                    item[property] = s;
                  }
                  property = null;
                }
              });
              s3res.on('error', function (err) {
                callback(err, null, null, next);
              });
              buffer = new Buffer('');
              s3res.on('end', function () {
                parser.parse(buffer);
              });
              s3res.on('data', function (chunk) {
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
              if (next) {
                next(null);
              }
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
              if (paths[paths.length - 1] === '') {
                paths.splice(paths.length - 1, 1);
              }
              var fileName = paths[paths.length - 1] || 'Untitled';
              paths.splice(paths.length - 1, 1);
              var folderPath = null;
              if (paths.length > 0) {
                folderPath = paths.join('/') + '/';
              }
              if (!assetFound.title || assetFound.title === 'undefined') {
                assetFound.title = (parent === null) ? asset.key : fileName;
              }
              assetFound.isfolder = asset.key.substring(asset.key.length - 1) === '/';
              if (!assetFound.isfolder) {
                assetFound.size = asset.size;
              } else {
                assetFound.size = null;
              }
              assetFound.key = asset.key; // S3 name
              var project = null;
              var match = assetFound.key.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
              var newAlias = 's3/' + asset.key;
              if (match) {
                var newRoot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == assetFound.key;
                if (assetFound.isroot !== newRoot) {
                  assetFound.isroot = newRoot;
                }
                if (assetFound.isroot) {
                  project = match[2];
                  assetFound.title = match[3];
                  var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
                  //calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
                  if (newAlias !== newUri) {
                    newAlias = newUri;
                  }
                } else {
                  // For a normal asset that's part of a project rewrite it to say
                  // {project}/{rootfolder}/{restofuri}
                  var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
                  //calipso.debug("rewriting uri from " + assetFound.key + " to " + newUri);
                  if (newAlias !== newUri) {
                    newAlias = newUri;
                  }
                }
              } else if (/s3\/[^\/]*\/$/.test(newAlias)) {
                if (!assetFound.isroot) {
                  assetFound.isroot = true;
                }
              }
              if (newAlias !== assetFound.alias) {
                assetFound.alias = newAlias;
              }
              if (assetFound.author !== asset.author) {
                assetFound.author = asset.author;
              }
              var diffs = assetFound._dirty();
              if (diffs.length != 0) {
                var output = [];
                diffs.forEach(function (diff) {
                  output.push(diff.path + ' = ' + diff.value);
                });
                if (assetFound.isbucket) {
                  if (!info || !info.bucket || info.bucket === assetFound.alias) {
                    var log = (isNew ? 'new ' : 'update ') + ' bucket "' + asset.key + '" ' + output.join(', ');
                    calipso.debug(log);
                    if (progress) {
                      progress(log);
                    }
                  }
                } else if (parent && assetFound.isfolder) {
                  var log = (isNew ? 'new ' : 'update ') + '"' + asset.key + '" ' + output.join(', ');
                  calipso.debug(log);
                  if (progress) {
                    progress(log);
                  }
                }
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
                var pq = {isproject:true, alias:'proj/' + project + '/', key:''};
                Asset.find(pq, function (e, projs) {
                  function removeDupProjs() {
                    if (projs.length > 1) {
                      var proj = projs.splice(1, 1)[0];
                      return proj.remove(function (err) {
                        removeDupProjs();
                      });
                    }
                    saveProj();
                  }

                  function saveProj() {
                    var proj = projs[0];
                    var newProj = false;
                    if (e || !proj) {
                      newProj = true;
                      proj = new Asset(pq);
                    }
                    proj.author = asset.author;
                    proj.title = project;
                    proj.isroot = true;
                    proj.isfolder = true;
                    if (proj._dirty().length !== 0) {
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
                    } else {
                      saveAsset();
                    }
                  }

                  removeDupProjs();
                });
              } else {
                var paths = assetFound.alias.split('/');
                var keys = assetFound.key.split('/');
                if (assetFound.isfolder) {
                  paths.splice(paths.length - 2, 2, '');
                  keys.splice(keys.length - 2, 2, '');
                } else {
                  paths.splice(paths.length - 1, 1, '');
                  keys.splice(keys.length - 1, 1, '');
                }
                if (keys.length < 2) {
                  keys = null;
                }
                if (paths.length > 2) {
                  Asset.findOne({alias:paths.join('/'), isfolder:true}, function (err, ourFolder) {
                    if (err) {
                      if (progress) {
                        progress('Error while looking for parent folder ' + paths.join('/') + ': ' + err.message);
                      }
                      return callback(err, null);
                    }
                    if (!ourFolder) {
                      calipso.debug('Didn\'t find folder ' + paths.join('/') + ' which should contains ' + assetFound.alias);
                      if (progress) {
                        progress('Adding missing folder ' + paths.join('/'));
                      }
                      ourFolder = new Asset({isfolder:true, alias:paths.join('/'), key:keys.join('/'), title:paths[paths.length - 2], author:assetFound.author});
                      return ourFolder.save(function (err) {
                        if (progress && err) {
                          process('Error while saving folder ' + ourFolder.alias + ': ' + err.message);
                        }
                        if (err) {
                          return callback(err, null);
                        }
                        saveAsset();
                      });
                    }
                    saveAsset();
                  });
                } else {
                  saveAsset();
                }
              }
            });
          }

          if (folder && folder.alias) {
            folder = folder.alias;
          }
          if (folder) {
            Asset.findOne({alias:folder}, function (err, root) {
              if (!root) {
                if (folder !== '') {
                  if (/^proj\/.*\//.test(folder)) {
                    console.debug('unable to find ' + folder + ' for sync.');
                    return callback(new Error('unable to find ' + folder + ' for sync.'));
                  }
                  if (!/^s3\/.*\//.test(folder)) {
                    console.debug('unable to find ' + folder + ' as a s3 resource.');
                    return callback(new Error('unable to recognize ' + folder + ' as a s3 resource.'));
                  }
                  var match = folder.match(/^s3\/([^\/]*)\/(.*)$/);
                  if (match) {
                    info = {bucket:match[1], prefix:match[2]};
                  }
                }
              } else {
                folder = root.key;
              }
              if (p.length > 0) {
                info = {
                  bucket:p.splice(0, 1)[0],
                  prefix:p.join('/')
                };
              } else {
                info = null;
              }
              rootSnarfer(info);
            });
          } else {
            rootSnarfer(null);
          }
          function rootSnarfer(info) {
            realContent(info, null, true, snarfBucketContent, function () {
              Asset.find({isfolder:true}).limit(10000).exec(function (e, folders) {
                if (e || folders.length == 0) {
                  doNext();
                  return;
                }
                var wasDone = false;

                function doNext() {
                  if (!wasDone) {
                    callback(null, null);
                    wasDone = true;
                  }
                }

                function updateFolder(index) {
                  var folder = folders[index];
                  var query = { alias:{ $regex:'^' + folder.alias + '[^/]+/?$' } };
                  Asset.count(query, function (e, count) {
                    Asset.update(query, { folder:folder._id }, { multi:true }, function (e, c) {
                      var log = 'updating files in "' + folder.alias + '" - ' + c + ' was ' + count;
                      if (progress && (c !== count)) {
                        progress(log);
                      }
                      if ((folders.length - 1) == index) {
                        doNext();
                      } else {
                        updateFolder(index + 1);
                      }
                    });
                  });
                }

                updateFolder(0);
              });
            });
          }
        },
        listFiles:function (project, folder, callback) {
          var Asset = calipso.db.model('Asset');
          var url = 'proj/' + project + '/' + folder;
          if (url[url.length - 1] !== '/') {
            url += '/';
          }
          Asset.findOne({isfolder:true, alias:url }, function (err, project) {
            if (err) {
              return callback(err, null);
            }
            var query = Asset.find({folder:project._id}).sort('-isfolder title');
            callback(err, query);
          });
        },
        deleteAsset:function (path, author, callback) {
          var Asset = calipso.db.model('Asset');
          var rootFolder = null;
          Asset.findOne({alias:path}).populate('folder').exec(function (err, asset) {
            if (err) {
              return callback(err, null);
            }
            if (!asset) {
              return callback(new Error('unable to find asset to delete ' + path), null);
            }
            // TODO: Implement delete.
            rootFolder = asset.folder;
            var paths = asset.key !== '' ? asset.key.split('/') : [''];
            if (asset.isfolder) {
              // Get the bucket of the folder if there is one.
              var bucket = paths[0];
              var assetsToDelete = {};

              // This is a list of assets just containing the folder
              assetsToDelete[bucket] = [asset];

              // The list of folders is just the one asset for now
              // Accumulate folders here
              var folders = [asset];

              function multiDelete() {
                var bucket = null;
                var list = null;
                for (bucket in assetsToDelete) {
                  if (bucket !== '') {
                    list = assetsToDelete[bucket].splice(0, 1000); // Pop off the first 1000 assets for one of the buckets.
                    if (assetsToDelete[bucket].length == 0) {
                      // If we're done with the bucket then remove it from here.
                      delete assetsToDelete[bucket];
                    }
                    break;
                  }
                }
                if (!list) {
                  bucket = '';
                  if (assetsToDelete['']) {
                    // If we didn't find any bucket related resources anymore then check for non-bucket related ones.
                    list = assetsToDelete[''].splice(0, 1000); // We can only support 1000 at a time.
                    if (assetsToDelete[''].length == 0) {
                      delete assetsToDelete[''];
                    }
                  }
                }
                if (!list || list.length === 0) {
                  if (rootFolder) {
                    rootFolder.updated = new Date();
                    rootFolder.author = author;
                    rootFolder.save(function (err) {
                      calipso.lib.assets.updateParents(rootFolder, author, function (err) {
                        return callback(null, asset);
                      });
                    });
                    return;
                  } else {
                    return callback(null, asset);
                  }
                }
                var xml = ['<?xml version="1.0" encoding="UTF-8"?>\n', '<Delete>'];
                var query = [];
                list.forEach(function (item) {
                  var paths = item.key.split('/');
                  paths.splice(0, 1);
                  paths = paths.join('/');
                  if (bucket !== '') {
                    calipso.debug('Deleting Bucket ' + bucket + ' Key ' + paths);
                    xml.push('<Object><Key>', paths, '</Key></Object>');
                  }
                  query.push(item._id);
                });
                xml.push('</Delete>');
                xml = xml.join('');
                if (bucket !== '') {
                  var k = knox({
                    'bucket':bucket
                  });
                  var s3req = k.request('POST', '/?delete', {
                    'Content-Length':xml.length,
                    'Content-MD5':crypto.createHash('md5').update(xml).digest('base64'),
                    'Accept:':'*/*'
                  }).on('error',function (err) {
                      calipso.debug('Unable to delete file (s3 error) ' + err.message);
                      return callback(new Error('unable to delete ' + err.message), null);
                    }).on('response', function (s3res) {
                      if (s3res.statusCode !== 200) {
                        var data = '';
                        s3res.on('data', function (chunk) {
                          data += chunk;
                        });
                        s3res.on('end', function () {
                          calipso.debug('Unable to delete file (s3 error) ' + data);
                          return callback(new Error('unable to delete file ' + data))
                        });
                        s3res.on('error', function (err) {
                          calipso.debug('Unable to delete file (s3 error) ' + err.message);
                          return callback(new Error('unable to delete file ' + err.message));
                        });
                        return;
                      }
                      Asset.remove({'_id':{$in:query}}, function (err) {
                        if (err) {
                          calipso.debug('Unable to delete folder ' + err.message);
                          return callback(new Error('unable to delete folder ' + err.message));
                        }
                        multiDelete();
                      });
                    });
                  s3req.write(xml);
                  s3req.end();
                } else {
                  Asset.remove({'_id':{$in:query}}, function (err) {
                    if (err) {
                      calipso.debug('Unable to delete folder database items ' + err.message);
                      return callback(new Error('unable to delete folder ' + err.message));
                    }
                    multiDelete();
                  });
                }
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
                    var paths = file.key !== '' ? file.key.split('/') : [''];
                    var bucket = paths[0];
                    if (!assetsToDelete[bucket]) {
                      assetsToDelete[bucket] = [];
                    }
                    assetsToDelete[bucket].push(file);
                  });
                  addFiles();
                });
              }

              addFiles();
            } else {
              var k = knox({
                'bucket':paths[0]
              });
              var s3req = k.request('DELETE', escape(asset.key))
                .on('error', function (err) {
                  return callback(new Error('unable to delete ' + err.message), null);
                })
                .on('response', function (s3res) {
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
          });
        },
        hideAsset:function (path, author, callback) {
          var Asset = calipso.db.model('Asset');
          var rootFolder = null;
          Asset.findOne({alias:path}).populate('folder').exec(function (err, asset) {
            if (err) {
              return callback(err, null);
            }
            if (!asset) {
              return callback(new Error('unable to find asset to hide ' + path), null);
            }
            var query;
            if (asset.isfolder) {
              query = new RegExp('^' + asset.alias);
            } else {
              query = asset.alias;
            }
            calipso.lib.assets.findAssets({alias:query}, function (err, assets) {
              if (err) {
                return callback(err, null);
              }
              function hide(assets) {
                if (!assets || !assets.length) {
                  return callback(null);
                }
                var a = assets.splice(0, 1)[0];
                a.hidden = true;
                calipso.debug("Hiding asset: " + a.alias);
                a.save(function (err) {
                  if (err) {
                    return callback(err, null);
                  }
                  hide(assets);
                });
              }

              hide(assets);
            });
          });
        },
        // This will return an array of "titles" as we traverse the path.
        folderPath:function (folder, callback) {
          var Asset = calipso.db.model('Asset');
          var path = [];

          function searchFolder(folder) {
            Asset.findOne({alias:folder, isfolder:true}).populate('folder').exec(function (err, folderAsset) {
              if (!folderAsset || err) {
                return callback(new Error('Unable to find folder ' + folder), null);
              }
              var title = folderAsset.title;
              if (title[title.length - 1] === '/') {
                title = title.substring(0, title.length - 1);
              }
              path.splice(0, 0, title); // Add the current title to the front of the path.
              if (folderAsset.isproject || folderAsset.isbucket) {
                // We're at the front. Output the joined path.
                callback(null, path);
              } else if (folderAsset.folder) {
                // Search through the parent and add that.
                searchFolder(folderAsset.folder.alias);
              } else {
                // For some odd reason we're not at the project or bucket but didn't find a parent folder.
                callback(new Error('Unable to find root folder'), path);
              }
            });
          }

          searchFolder(folder.alias ? folder.alias : folder);
        },
        assureFolder:function (folderPath, author, callback) {
          var Asset = calipso.db.model('Asset');
          calipso.debug('assureFolder: Searching for ' + folderPath);
          Asset.findOne({alias:folderPath}, function (err, folder) {
            if (err) {
              return callback(err, null);
            }
            if (!folder) {
              var s = folderPath.split('/');
              if (s.length === 3) {
                if (s[0] === 's3') {
                  return calipso.lib.assets.createAsset({path:folderPath, author:author}, callback);
                } else {
                  return callback(new Error('Unable to find root folder ' + parentFolder), null);
                }
              }
              s.splice(-2, 2, ['']);
              var parentFolder = s.join('/');
              calipso.debug('Searching for parent folder ' + parentFolder);
              calipso.lib.assets.assureFolder(parentFolder, author, function (err, superFolder) {
                if (err) {
                  return callback(err, null);
                }
                if (!superFolder) {
                  return callback(new Error('Unable to find or automatically create ' + folderPath));
                }
                var folderName = folderPath.replace(superFolder.alias, '');
                folderName = folderName.substring(0, folderName.length - 1);
                calipso.debug('New folder with title equal to ' + folderName);
                var folder = new Asset({alias:folderPath, key:superFolder.key + folderName + '/', title:folderName, author:author, folder:superFolder._id, isfolder:true});
                folder.save(function (err) {
                  if (err) {
                    return callback(err, null);
                  }
                  callback(null, folder);
                });
              });
            } else if (folder.key === '') {
              return callback(new Error('This is a project root without a root folder path ' + folderPath));
            } else {
              return callback(null, folder);
            }
          });
        },
        encodeUrl:function (asset, session, options) {
          var encrypt = crypto.createCipher('aes-192-ecb', calipso.config.get('session:secret'));
          var str = '' + ((session && session.id) || '') + '|' + asset.id.toString();
          var production = encrypt.update(str, 'utf8', 'hex');
          production += encrypt.final('hex');
          var url = '/pub/' + production;
          var paths = asset.alias.split('/');
          url += '/' + escape(((options && options['filename']) || paths[paths.length - 1]));
          url = calipso.config.get('server:url') + url;
          return url;
        },
        decodeUrl:function (token) {
          var encrypt = crypto.createDecipher('aes-192-ecb', calipso.config.get('session:secret'));
          var output = encrypt.update(token, 'hex', 'utf8');
          output += encrypt.final('utf8');
          var s = output.split('|');
          var info = { sessionId:s[0], id:s[1] };
          return info;
        },
        updateParents:function (asset, author, callback) {
          if (asset.folder) {
            var Asset = calipso.db.model('Asset');
            Asset.findOne({_id:asset.folder}, function (err, folder) {
              if (err || !folder) {
                return callback(new Error('unable to find parent folder ' + (err ? err.message : '')), folder);
              }
              folder.updated = new Date();
              folder.updated_by = author;
              folder.save(function (err) {
                if (err) {
                  return callback(new Error('unable to update parent folder ' + err.message), folder);
                }
                calipso.lib.assets.updateParents(folder, author, callback);
              })
            })
          } else {
            callback(null, null);
          }
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
        createAsset:function (options, callback) {
          var Asset = calipso.db.model('Asset');
          var path = options.path;
          if (!path) {
            if (options.bucket) {
              path = 's3/' + options.bucket + '/' + options.key;
            } else if (options.project) {
              path = 'proj/' + options.project + '/' + options.root + '/' + options.key;
            }
          }
          if (!path) {
            return callback(new Error("Could not create asset. No path specified"), null);
          }
          var copySource = options.copySource;
          var copyStream = options.copyStream;
          var copyStreamSize = options.copyStreamSize;
          if (copyStream && !options.copyStreamPaused) {
            copyStream.pause();
          }
          var author = options.author || 'testing';
          var paths = path.split('/');
          var isFolder = paths[paths.length - 1] === '';
          var root = paths[0];
          var headers = {};
          if (isFolder) {
            paths.splice(paths.length - 1, 1);
          }
          var fileName = paths[paths.length - 1];
          var isBucket = (root === 's3') && (paths.length == 2);
          var parentFolder = '';
          var assetCopy = null;
          var fileType = null;
          for (var i = 0; i < (paths.length - 1); i++) {
            parentFolder += paths[i] + '/';
          }
          if (isBucket) {
            // Create a new bucket
            // This is a PUT with no alias.
            var k = knox({
              'bucket':fileName
            });
            var Asset = calipso.db.model('Asset');
            if (path[path.length - 1] !== '/') {
              path += '/';
            }
            Asset.findOne({isfolder:true, alias:path}, function (err, asset) {
              if (!asset) {
                asset = new Asset();
                asset.title = paths[1];
                asset.author = author;
                calipso.debug('create new bucket ' + path);
              } else {
                calipso.debug('found bucket ' + path);
              }
              asset.isfolder = true;
              asset.alias = path;
              asset.key = paths[1] + '/';
              asset.save(function (err) {
                if (err) {
                  return callback(new Error("unable to save bucket " + err.message), null);
                }
                var sreq = k.request('PUT', '', {
                  'Content-Length':'0',
                  'x-amz-acl':'private'
                });
                sreq.on('error',function (err) {
                  asset.remove(function () {
                    return callback(new Error("unable to create bucket " + err.message), null);
                  });
                }).on('response',function (s3res) {
                    //s3res.end();
                    return callback(null, asset);
                  }).end();
              });
            });
            return;
          }
          function interactWithS3(asset) {
            var paths = asset.key.split('/');
            var fileName = paths[paths.length - 1];
            var bucket = paths.splice(0, 1)[0];
            var k = knox({
              bucket:bucket
            });
            var s3key = paths.join('/');
            headers['Content-Type'] = asset.fileType;
            headers['Expect'] = '100-continue';
            calipso.debug('Putting ' + s3key + " with " + JSON.stringify(headers));
            var s3req = k.request('PUT', escape(s3key), headers)
              .on('error', function (err) {
                callback(err, null);
                calipso.debug(err);
              })
              .on('response', function (s3res) {
                var data = "";
                s3res.on('data', function (chunk) {
                  data += chunk;
                });
                s3res.on('end', function () {
                  if (s3res.statusCode != 200) {
                    return callback(new Error(data), asset, data);
                  }
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
            } else {
              s3req.end();
            }
          }

          function finalize() {
            var Asset = calipso.db.model('Asset');
            // Search for the folder first
            calipso.lib.assets.assureFolder(parentFolder, author, function (err, folder) {
              if (err || !folder) {
                // If we didn't find the folder then it has not been created yet.
                return callback(new Error('unable to find parent folder ' + parentFolder), null);
              }
              // Search for the asset with this alias.
              Asset.findOne({alias:path, folder:folder._id}).exec(function (err, asset) {
                if (err) {
                  return callback(err, asset);
                }
                if (asset) {
                  if (asset.isfolder) {
                    return callback(null, asset);
                  }
                }
                if (isFolder && (folder.key === '')) {
                  return callback(new Error("this folder is rooted and not storage allocated for parent folder " + parentFolder), null);
                }
                var s3path = folder.key + fileName;
                if (isFolder) {
                  s3path += '/';
                }
                if (!asset) {
                  calipso.debug('new asset ' + path);
                  asset = new Asset({isfolder:isFolder,
                    key:s3path, folder:folder._id, alias:path, title:fileName, author:author});
                } else {
                  calipso.debug('existing asset ' + path);
                }
                if (assetCopy) {
                  for (var v in assetCopy) {
                    if (v === 'id' || v === '_id' || v === 'alias' || v === 'key' || v === 'folder' || assetCopy[v] === undefined) {
                      continue;
                    }
                    asset[v] = assetCopy[v];
                  }
                }
                if (!fileType) {
                  fileType = mime.lookup(fileName);
                }
                asset.fileType = fileType;
                var match = s3path.match(/^([^\/]*)\/project:([^\-\/]*):([^\-\/]*)(\/.*)?$/);
                var project = null;
                if (match) {
                  asset.isroot = (match[1] + '/project:' + match[2] + ':' + match[3] + '/') == s3path;
                  if (asset.isroot) {
                    project = match[2];
                    if (!asset.isroot) {
                      asset.isroot = true;
                    }
                    asset.title = match[3];
                    var newUri = 'proj/' + match[2] + '/' + match[3] + '/';
                    //calipso.debug("rewriting uri from " + s3path + " to " + newUri);
                    if (asset.alias !== newUri) {
                      asset.alias = newUri;
                    }
                  } else {
                    // For a normal asset that's part of a project rewrite it to say
                    // {project}/{rootfolder}/{restofuri}
                    asset.isroot = false;
                    var newUri = 'proj/' + match[2] + '/' + match[3] + (match[4] ? match[4] : '');
                    //calipso.debug("rewriting uri from " + asset.key + " to " + newUri);
                    if (asset.alias !== newUri) {
                      asset.alias = newUri;
                    }
                  }
                }
                function saveAsset(ignoreWidth) {
                  if (/image\//.test(fileType) && !ignoreWidth) {
                    if (!asset.width && !asset.height && !copySource) {
                      if (copyStream && copyStream.path) {
                        try {
                          var imagemagick = require('imagemagick');
                          imagemagick.identify(copyStream.path, function (err, info) {
                            if (err) {
                              calipso.debug('Unable to analyze image ' + err.message);
                            }
                            if (info) {
                              if (asset.width !== info.width) {
                                asset.width = info.width;
                              }
                              if (asset.height !== info.height) {
                                asset.height = info.height;
                              }
                              if (asset.depth !== info.depth) {
                                asset.depth = info.depth;
                              }
                              if (asset.format !== info.format) {
                                asset.format = info.format;
                              }
                            }
                            saveAsset(true);
                          });
                          return;
                        }
                        catch (e) {
                          calipso.error('Unable to analyze image ' + e.message);
                        }
                      }
                    }
                  }
                  asset.updated = new Date();
                  if (!asset.author) {
                    asset.author = author;
                  }
                  if (asset.updated_by !== author) {
                    asset.updated_by = author;
                  }
                  asset.save(function (err) {
                    if (err) {
                      return callback(new Error("unable to save asset " + err.message), null);
                    }
                    calipso.lib.assets.updateParents(asset, author, function (err) {
                      if (isFolder) {
                        return callback(null, asset);
                      } else {
                        interactWithS3(asset);
                      }
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
                    } else {
                      calipso.debug('existing project proj/' + project + '/');
                    }
                    proj.key = '';
                    if (!proj.author) {
                      proj.author = author;
                    }
                    proj.updated_by = author;
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
                } else {
                  saveAsset();
                }
                return; // done putting new file
              });
            });
          }

          if (copyStream) {
            if (copyStreamSize) {
              headers['Content-Length'] = copyStreamSize;
              filesize = copyStreamSize;
            } else {
              var stat = fs.statSync(copyStream.path);
              headers['Content-Length'] = stat.size;
              filesize = stat.size;
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
                assetCopy = copyAsset.toObject();
                delete assetCopy.id;
                delete assetCopy.folder;
                delete assetCopy.key;
                delete assetCopy.alias;
                fileType = assetCopy.fileType;
                calipso.debug('Copying file size from original resource ' + assetCopy.size);
                headers['Content-Length'] = 0;
                finalize();
              });
              return;
            }
            if (copySource) {
              headers['Content-Length'] = 0;
            }
          }
          finalize();
        },
        handleFormUpload:function (req, res, form, redirect, next) {
          // req.files.file[0].name - Original filename
          // req.files.file[0].path - Path to tmp
          // req.files.url - Path to destination
          var author = ((req.session.user && req.session.user.username) || 'nobody');
          var Asset = calipso.lib.assets.assetModel();
          calipso.lib.assets.findAssets({isfolder:true, alias:form.url}).findOne(function (err, folder) {
            if (err || !folder) {
              res.statusCode = 500;
              req.flash('error', req.t('Problem finding root folder {folder}: {error}', {folder:form.url, error:err ? err.message : "Unknown error"}));
              return next();
            }
            var paths = folder.key.split('/');
            var bucket = paths.splice(0, 1)[0];
            var client = calipso.lib.assets.knox({ bucket:bucket });
            if (!(req.files.file instanceof Array)) {
              req.files.file = [req.files.file];
            }
            function sendFile() {
              if (req.files.file.length === 0) {
                res.redirect(redirect);
                return;
              }
              var file = req.files.file.splice(0, 1)[0];
              if (typeof file.name === 'string' && file.name.search(/\/\.$/) != -1) {
                sendFile();
                return;
              }
              var stream = fs.createReadStream(file.path);
              // Refactor to use createAsset routine.
              calipso.lib.assets.createAsset({path:folder.alias + file.name, copyStream:stream, author:author}, function (err, asset) {
                if (err) {
                  res.statusCode = 500;
                  calipso.debug('unable to write file ' + file.name);
                  req.flash('error', req.t('Unable to write file {file}: {error}', {file:file.name, error:err.message}));
                  next();
                  return;
                }
                sendFile(); // send the next file
              });
            }

            sendFile();
          });
        },
        checkPermission:function (alias, username, action, callback) {
          if (!username) {
            return callback(null, false);
          }
          var User = calipso.db.model('User');
          User.findOne({username:username}, function (err, u) {
            if (err) {
              return callback(err, false);
            }
            var isAdmin = false;
            u.roles.forEach(function (role) {
              if (calipso.data.roles[role] && calipso.data.roles[role].isAdmin) {
                isAdmin = true;
              }
            });
            if (/^s3\//.test(alias)) {
              callback(null, isAdmin);
            } else if (/^proj\//.test(alias)) {
              var paths = alias.split('/');
              if (action === 'delete') {
                if (paths[2] === 'Archive') {
                  // Can't delete anything in the archive folder.
                  return callback(null, false);
                }
              }
              paths = paths.splice(0, 3);
              paths[2] = '';
              if (action === 'delete') {
                if (paths.join('/') === alias) {
                  // Can't delete the whole project since it's not really a folder.
                  return callback(null, false);
                }
                action = 'modify';
              }
              calipso.lib.assets.findOneAsset({isproject:true, alias:paths.join('/')}, function (err, project) {
                if (project.author === username || isAdmin || !project.isPrivate) {
                  return callback(null, true);
                } else {
                  var AssetPermissions = calipso.db.model('AssetPermissions');
                  AssetPermissions.findOne({project:project.title, user:username, action:action}, function (err, entry) {
                    if (err) {
                      return callback(err, false);
                    }
                    callback(null, !!entry);
                  });
                }
              });
            } else {
              callback(new Error('Invalid type of alias ' + alias), false);
            }
          });
        },
        // options.source (for example proj/<projectname>/<rootfolder>/<folder...>/ or proj/<projectname>/<rootfolder>/<folder...>/<file>)
        // options.destination (for example proj/<projectname>/<rootfolder>/<folder...>/)
        // options.maxDepth (undefined or number)
        // callback(err, {source:[array of source assets], destination:[array of destination assets]} or null on error);
        // optional progress callback (err, ['copy', sourceAsset, destinationAsset]);
        // optional progress callback (err, ['gather', sourceFolderAsset, [sourceAssets in folder]]);
        copyAssets:function (options, callback, progress) {
          if (!options.source) {
            return callback(new Error('You must specify the source.'));
          }
          if (!options.destination) {
            return callback(new Error('You must specify the destination'));
          }
          if (!options.author) {
            return callback(new Error('You must specify the author'));
          }
          var destination = options.destination;
          if (options.source[options.source.length - 1] === '/') {
            if (options.destination[options.destination.length - 1] !== '/') {
              return callback(new Error('When copying multiple items the destination must be a folder.'));
            }
            var sourcePaths = options.source.split('/');
            destination = destination + sourcePaths[sourcePaths.length - 2] + '/';
          }
          var sourceDepth = options.source.split('/').length;
          var Asset = calipso.db.model('Asset');
          var itemsToCopy = [];
          var sourceFolders = [];
          var itemsCopied = [];
          var oldAssets = [];

          function doCopy() {
            if (!itemsToCopy) {
              return callback(null, {"destination":itemsCopied, "source":oldAssets});
            }
            var item = itemsToCopy.splice(0, 1)[0];
            if (!item) {
              return callback(null, {"destination":itemsCopied, "source":oldAssets});
            }
            var dest = item.alias.replace(options.source, destination);
            calipso.lib.assets.createAsset({copySource:item.alias, path:dest, author:options.author}, function (err, newAsset) {
              itemsCopied.push(newAsset);
              oldAssets.push(item);
              doCopy();
              calipso.debug('copyAssets copied ' + item.alias + ' to ' + newAsset.alias);
              if (typeof progress === 'function') {
                progress(null, ['copy', item, newAsset]);
              }
            });
          }

          function doGather() {
            var hasFolder = false;
            if (!sourceFolders) {
              return doCopy();
            }
            var sourceFolder = sourceFolders.splice(0, 1)[0];
            if (!sourceFolder) {
              return doCopy();
            }
            Asset.find({folder:sourceFolder._id}, function (err, items) {
              if (err) {
                return callback(err, null);
              }
              calipso.debug('copyAssets gathered ' + items.count + ' assets in folder ' + sourceFolder.alias);
              if (typeof progress === 'function') {
                progress(null, ['gather', asset, items]);
              }
              items.forEach(function (item) {
                if (item.isfolder) {
                  if ((options.maxDepth === undefined) || (item.alias.split('/').length - sourceDepth) < options.maxDepth) {
                    sourceFolders.push(item);
                  } else {
                    calipso.debug('copyAssets skipping folder ' + item.alias + ' because of depth limit');
                  }
                } else {
                  itemsToCopy.push(item);
                }
              });
              doGather();
            });
          }

          Asset.findOne({alias:options.source}, function (err, asset) {
            if (err) {
              return callback(err, null);
            }
            if (asset.isfolder) {
              sourceFolders.push(asset);
              doGather();
            } else {
              itemsToCopy.push(asset);
              doCopy();
            }
          });
        },
        checkBasicAuth:function (req, res, callback) {
          // If header exists.
          if ("authorization" in req.headers) {
            var header = req.headers.authorization;
            var clientUserString = header.split(" ")[1];

            // Searching for user in user list.
            if (clientUserString) {
              var clientUser = (new Buffer(clientUserString, 'base64')).toString('utf8').split(":");
              var clientUserName = clientUser[0];
              var clientPasswordHash = clientUser[1];

              var User = calipso.db.model('User');

              return User.findOne({username:clientUserName}, function (err, user) {
                if (err) {
                  return callback(new Error('Unable to authenticate user'), null);
                }
                if (user) {
                  calipso.lib.crypto.check(clientPasswordHash, user.hash, function (err, ok) {
                    if (!user.locked && ok) {
                      calipso.e.post_emit('USER_LOGIN', user);
                      return calipso.lib.user.createUserSession(req, res, user, function (err) {
                        if (err) {
                          calipso.error("Error saving session: " + err);
                        }
                        callback(err, user);
                      });
                    }
                    callback(new Error('Unable to authenticate user'), user);
                  });
                }
              });
            }
          }
          callback(new Error('No authentication provided'), null);
        },
        askBasicAuth:function (req, res) {
          var header = "Basic realm=\"" + this.realm + "\"";
          res.setHeader("WWW-Authenticate", header);
          res.writeHead(401);
          res.end("<!DOCTYPE html>\n<html><head><title>401 Unauthorized</title></head><body><h1>401 "
            + "Unauthorized</h1><p>This page requires authorization.</p></body></html>");
        }
      };

      // Default Asset Schema TODO -gajohnson add assetpath property, isProject boolean property
      var Asset = new calipso.lib.mongoose.Schema({
        title:{type:String, required:true, "default":''},
        description:{type:String, required:false, "default":''},
        taxonomy:{type:String, "default":''},
        key:{type:String, required:false, "default":''}, // This is the undelying S3 key (or path to file or folder)
        size:{type:Number, required:false},
        folder:{type:calipso.lib.mongoose.Schema.ObjectId, ref:'Asset', required:false},
        isfolder:{type:Boolean, "default":false},
        isroot:{type:Boolean, "default":false},
        isproject:{type:Boolean, "default":false},
        isvirtual:{type:Boolean, "default":false},
        alias:{type:String, required:true}, // This is the user visible path
        author:{type:String, required:true},
        etag:{type:String, "default":''},
        tags:[String],
        isPrivate:{type:Boolean, required:true, "default":true},
        hidden:{type:Boolean, required:true, "default":false},
        fileType:{type:String, required:false},
        created:{ type:Date, "default":Date.now },
        updated:{ type:Date, "default":Date.now },
        updated_by:{type:String},
        width:{type:Number},
        height:{type:Number},
        format:{type:String},
        depth:{type:Number},
        showupAs:{type:String},
        customType:{type:String},
        customSort:{type:String},
        customLink:{type:String, "default":""},
        customFlag1:{type:Boolean, "default":false},
        customFlag2:{type:Boolean, "default":false},
        customFlag3:{type:Boolean, "default":false},
        customFlag4:{type:Boolean, "default":false}
      });
      var AssetPermissions = new calipso.lib.mongoose.Schema({
        project:{type:String, required:true},
        user:{type:String, required:true},
        action:{type:String, required:true}
      });

      // Set post hook to enable simple etag generation
      Asset.pre('save', function (next) {
        this.etag = calipso.lib.crypto.etag(this.title + this.description + this.key);
        if (!this.customSort) {
          this.customSort = this.title;
        }
        if (!this.customType && this.fileType) {
          this.customType = this.fileType.split('/')[0];
        }
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
    url = '<h5></br><a href="/asset/' + alias + '">/asset/' + alias + '</a>';
    url += '</br>s3://' + asset.key + '</h5>';
  }
  return {id:'content-form', title:'Create Content ...', type:'form', method:'POST', action:'/assets', tabs:true,
    sections:[
      {
        id:'form-section-content',
        label:'Content',
        fields:asset.isfolder ? [
          {label:'Parent Tag', name:'asset[showupAs]', type:'text', description:'XML tag or tag field to add to parent items when aliasing contents of this folder into the parent.'},
          {label:'Title', name:'asset[title]', type:'text', description:'Title to appear for this piece of content.' + url},
          {label:'Description', name:'asset[description]', type:'textarea', description:'Enter some short text that describes the content, appears in lists.'}
        ] : [
          {label:'Title', name:'asset[title]', type:'text', description:'Title to appear for this piece of content.' + url},
          {label:'Description', name:'asset[description]', type:'textarea', description:'Enter some short text that describes the content, appears in lists.'}
        ]
      },
      {
        id:'form-section-category',
        label:'Categorisation',
        fields:[
          {label:'Taxonomy', name:'asset[taxonomy]', type:'text', description:'Enter the menu heirarchy, e.g. "welcome/about"'},
          {label:'Tags', name:'asset[tags]', type:'text', description:'Enter comma delimited tags to help manage this content.'}
        ]
      },
      {
        id:'form-section-custom',
        label:'Custom Fields',
        fields:[
          {label:'Custom Type', name:'asset[customType]', type:'text', description:'Value of customType field.'},
          {label:'Custom Sort', name:'asset[customSort]', type:'text', description:'Value of customSort field.'},
          {label:'Custom Link', name:'asset[customLink]', type:'text', description:'Value of customLink field.'},
          {label:'Custom Flag 1', name:'asset[customFlag1]', type:'checkbox', description:'Value of customFlag1 field.'},
          {label:'Custom Flag 2', name:'asset[customFlag2]', type:'checkbox', description:'Value of customFlag2 field.'},
          {label:'Custom Flag 3', name:'asset[customFlag3]', type:'checkbox', description:'Value of customFlag3 field.'},
          {label:'Custom Flag 4', name:'asset[customFlag4]', type:'checkbox', description:'Value of customFlag4 field.'}
        ]
      },
      {
        id:'form-section-mediaInfo',
        label:'Media Information',
        fields:[
          {label:'File Type', name:'asset[fieldType]', type:'text', description:'Mime type (fileType field)'},
          {label:'Image Type', name:'asset[format]', type:'text', description:'Image type (format field from imagemagick)'},
          {label:'Width', name:'asset[width]', type:'text', description:'Width of image (width field from imagemagick)'},
          {label:'Height', name:'asset[height]', type:'text', description:'Height of image (height field from imagemagick)'},
          {label:'Depth', name:'asset[depth]', type:'text', description:'Depth of image (depth field from imagemagick)'}
        ]
      }
    ],
    fields:[
      {label:'', name:'returnTo', type:'hidden'}
    ],
    buttons:[
      {name:'submit', type:'submit', value:'Save Content'},
      {name:'cancel', type:'button', href:'/asset', value:'Cancel'}
    ]};
}

/**
 * Default home page, only specify the layout.
 */
function homePage(req, res, template, block, next) {
  res.layout = "home";
  next();
}

/**
 * Enable creation of the title alias based on the title.
 * TODO : Turn into a setter??
 * @param title
 * @returns trimmed title
 */
function titleAlias(title) {
  return title
    .toLowerCase()// change everything to lowercase
    .replace(/^\s+|\s+$/g, "")// trim leading and trailing spaces
    .replace(/[_|\s]+/g, "-")// change all spaces and underscores to a hyphen
    .replace(/[^a-z\u0400-\u04FF0-9-]+/g, "")// remove all non-cyrillic, non-numeric characters except the hyphen
    .replace(/[-]+/g, "-")// replace multiple instances of the hyphen with a single instance
    .replace(/^-+|-+$/g, "")// trim leading and trailing hyphens
    .replace(/[-]+/g, "-")
}

/**
 * Put up form to add a folder
 */
function addFolder(req, res, template, block, next) {
  // alias is the path into the asset
  var alias = [];
  var root = null;
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i]) {
      alias.push(req.moduleParams['f' + i]);
    }
  }
  var postFilename = '';
  var outputList = null;
  if (alias.length > 0) {
    if (alias.length > 0) {
      if (alias[alias.length - 1] === '_list') {
        alias[alias.length - 1] = '';
        alias = alias.join('/');
        isfolder = true;
        if (req.moduleParams.format) {
          outputList = req.moduleParams.format;
        } else {
          outputList = 'json';
        }
      } else {
        alias = alias.join('/') + (req.moduleParams.format ? '.' + req.moduleParams.format : '');
        if (req.url.substring(req.url.length - 1) == '/') {
          alias += '/';
          isfolder = true;
        }
      }
    } else {
      alias = "";
    }
  } else {
    alias = "";
  }

  var perm = 'add';
  calipso.lib.assets.findOneAsset({alias:alias}, function (err, asset) {
    if (asset) {
      perm = 'modify';
    }

    calipso.lib.assets.checkPermission(alias, req.session.user.username, perm, function (err, allowed) {
      if (allowed) {
        if (req.method === 'POST') {
          calipso.form.process(req, function (form) {
            if (form) {
              calipso.lib.assets.createAsset({path:alias + form.name + '/', author:req.session.user.username}, function (err, asset) {
                res.redirect('/asset/' + alias + form.name + '/');
              });
            } else {
              req.flash('info', req.t('Woah there, slow down. You should stick with the forms ...'));
              next();
            }
          });
          return;
        }
        var form = {
          id:'content-type-form',
          title:'Add new folder ...',
          type:'form',
          method:'POST',
          action:'/assets/addfolder/' + alias,
          tabs:false,
          fields:[
            {
              label:'Name',
              name:'name',
              type:'text',
              description:'The name of your folder ...', required:true, placeholder:"myFolderName"
            }
          ],
          buttons:[
            {
              name:'submit',
              type:'submit',
              value:'Add Folder'
            }
          ]
        };
        calipso.form.render(form, null, req, function (form) {
          calipso.theme.renderItem(req, res, form, block, {}, next);
        });
      } else {
        res.statusCode = 403;
        req.flash('error', req.t('You don\' have permissions to access this project.'));
        next();
      }
    });
  });
}

/**
 * Upload file or files
 */
function uploadAsset(req, res, template, block, next) {
  // alias is the path into the asset
  var alias = [];
  var root = null;
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i]) {
      alias.push(req.moduleParams['f' + i]);
    }
  }
  var postFilename = '';
  var outputList = null;
  if (alias.length > 0) {
    if (alias.length > 0) {
      if (alias[alias.length - 1] === '_list') {
        alias[alias.length - 1] = '';
        alias = alias.join('/');
        isfolder = true;
        if (req.moduleParams.format) {
          outputList = req.moduleParams.format;
        } else {
          outputList = 'json';
        }
      } else {
        alias = alias.join('/') + (req.moduleParams.format ? '.' + req.moduleParams.format : '');
        if (req.url.substring(req.url.length - 1) == '/') {
          alias += '/';
          isfolder = true;
        }
      }
    } else {
      alias = "";
    }
  } else {
    alias = "";
  }
  var perm = 'add';
  calipso.lib.assets.findOneAsset({alias:alias}, function (err, asset) {
    if (asset) {
      perm = 'modify';
    }

    calipso.lib.assets.checkPermission(alias, req.session.user.username, perm, function (err, allowed) {
      if (allowed) {
        if (req.method === 'POST') {
          calipso.form.process(req, function (form) {
            if (form) {
              var redirect = '/asset/' + form.container;
              calipso.lib.assets.handleFormUpload(req, res, form, redirect, next);
            } else {
              req.flash('info', req.t('Woah there, slow down. You should stick with the forms ...'));
              next();
            }
          });
          return;
        }
        if (req.moduleParams.directory) {
          fields = [
            {
              label:'File',
              name:'file',
              type:'file',
              description:'The folder to be uploaded ...',
              directory:'true'
            },
            {
              name:'url',
              type:'hidden',
              value:alias
            },
            {
              name:'container',
              type:'hidden',
              value:alias
            },
            { // If we send a filename in here then we prefer this filename to the one in the upload mime file.
              name:'name',
              type:'hidden',
              value:''
            }
          ];
        } else {
          fields = [
            {
              label:'File',
              name:'file',
              type:'file',
              description:'The file(s) to be uploaded ...',
              multiple:'true'
            },
            {
              name:'url',
              type:'hidden',
              value:alias
            },
            {
              name:'container',
              type:'hidden',
              value:alias
            },
            { // If we send a filename in here then we prefer this filename to the one in the upload mime file.
              name:'name',
              type:'hidden',
              value:''
            }
          ];
        }
        var form = {
          id:'content-type-form',
          title:'Add new asset ...',
          type:'form',
          method:'POST',
          action:'/assets/upload/' + alias,
          tabs:false,
          fields:fields,
          buttons:[
            {
              name:'upload',
              type:'submit',
              value:'Upload'
            }
          ]
        };
        // Default values
        var values = {
          content:{
            contentType:"Asset"
          },
          owner:req.session.user.username
        };

        calipso.form.render(form, values, req, function (form) {
          calipso.theme.renderItem(req, res, form, block, {}, next);
        });
      } else {
        res.statusCode = 403;
        req.flash('error', req.t('You don\' have permissions to access this project.'));
        next();
      }
    });
  });
}

/**
 * Create the form based on the fields defined in the content type
 * Enable switching of title etc. from create to edit
 */
function getForm(req, action, title, asset, next) {

  // Create the form
  var form = exports.assetForm(asset); // Use exports as other modules may alter the form function
  form.action = action;
  form.title = title;

  // Add any fields
  // Process any additional fields
  form = calipso.form.processFields(form, []);

  next(form);
}

/**
 * Edit Content Form
 * Edit an existing piece of asset.
 */
function editAssetForm(req, res, template, block, next) {

  var Asset = calipso.db.model('Asset');
  var id = req.moduleParams.id;
  if (id === 'sync') {
    return next();
  }
  var item;

  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "/assets/" + id;

  var aPerm = calipso.permission.Helper.hasPermission("admin:user");

  Asset.findById(id).populate('folder').exec(function (err, c) {
    if (err || c === null) {
      // TODO : REDIRECT TO 404
      res.statusCode = 404;
      req.flash('error', req.t('Unable to find this asset'));
      return next();
    } else {
      calipso.lib.assets.checkPermission(c.alias, req.session.user.username, 'modify', function (err, allowed) {
        if (!allowed) {
          res.status = 403;
          req.flash('error', req.t('You\'re not allowed to edit this asset'));
          return next();
        }
        var parent = c.folder ? c.folder.alias : '';
        if (calipso.modules['projects']) {
          var paths = parent.split('/');
          paths[0] = '/project';
          parent = paths.join('/');
        } else {
          parent = '/asset/' + parent;
        }
        res.menu.adminToolbar.addMenuItem(req, {name:'List', weight:1, path:'list', url:parent, description:'List all ...', permit:aPerm, icon:"icon-list-3"});
        res.menu.adminToolbar.addMenuItem(req, {name:'View', weight:2, path:'show', url:'/asset/' + c.alias, description:'Download actual file ...', permit:aPerm, icon:"icon-file-download"});
        res.menu.adminToolbar.addMenuItem(req, {name:'Edit', weight:3, path:'edit', url:'/assets/' + c.id, description:'Edit asset ...', permit:aPerm, icon:"icon-pencil-3"});
        res.menu.adminToolbar.addMenuItem(req, {name:'Delete', weight:4, path:'delete', url:'/assets/delete/' + id, description:'Delete asset ...', permit:aPerm, icon:"icon-delete"});
        // Create the form
        getForm(req, "/assets/" + id, req.t("Edit Asset ... "), c, function (form) {
          // Default values
          var values = {asset:c};

          // Fix for content type being held in meta field
          // TODO this has a bad smell
          values.returnTo = returnTo;

          res.layout = 'admin';

          // Test!
          calipso.e.pre_emit('ASSET_UPDATE_FORM', form, function (form) {
            calipso.form.render(form, values, req, function (form) {
              calipso.theme.renderItem(req, res, form, block, {}, next);
            });
          });
        });
      });
    }
  });

}

/**
 * Update Asset - from form submission
 */
function updateAsset(req, res, template, block, next) {
  calipso.form.process(req, function (form) {

    if (form) {
      var Asset = calipso.db.model('Asset');

      var returnTo = form.returnTo ? form.returnTo : "";
      var id = req.moduleParams.id;

      Asset.findById(id, function (err, c) {
        if (c) {
          calipso.lib.assets.checkPermission(c.alias, req.session.user.username, 'modify', function (err, allowed) {
            if (!allowed) {
              res.statusCode = 403;
              req.flash('error', req.t('You\'re not allowed to edit this asset.'));
              return next();
            }
            // Default mapper
            calipso.form.mapFields(form.asset, c);
            // Fields that are mapped specifically
            c.updated = new Date();
            c.updated_by = req.session.user.username;
//              c.alias = form.asset.alias ? form.asset.alias : titleAlias(c.title);
//              c.tags = form.asset.tags ? form.asset.tags.replace(/[\s]+/g, "").split(",") : [];

            // Emit pre event
            // This does not allow you to change the content
            calipso.e.pre_emit('ASSET_UPDATE', c, function (c) {

              c.save(function (err) {
                if (err) {

                  var errorMsg = '';
                  if (err.errors) {
                    for (var error in err.errors) {
                      errorMessage = error + " " + err.errors[error] + '\r\n';
                    }
                  } else {
                    errorMessage = err.message;
                  }
                  req.flash('error', req.t('Could not update content because {msg}', {msg:errorMessage}));
                  if (res.statusCode != 302) {
                    // Don't redirect if we already are, multiple errors
                    res.redirect('back');
                  }
                  next();

                } else {
                  calipso.lib.assets.updateParents(c.folder, req.session.user.username, function (err) {
                    req.flash('info', req.t('Content saved.'));

                    // Raise CONTENT_CREATE event
                    calipso.e.post_emit('CONTENT_UPDATE', c, function (c) {
                      if (returnTo) {
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
          });
        } else {
          req.flash('error', req.t('Could not locate asset, it may have been deleted by another user or there has been an error.'));
          res.redirect('/asset');
          next();
        }
      });
    }
  });

}

function deleteAsset(req, res, template, block, next) {
  calipso.form.process(req, function (form) {

    if (form) {
      var Asset = calipso.db.model('Asset');

      var returnTo = form.returnTo ? form.returnTo : "";
      var id = req.moduleParams.id;

      Asset.findById(id).populate('folder').exec(function (err, c) {
        if (c) {
          calipso.lib.assets.checkPermission(c.alias, req.session.user.username, 'delete', function (err, allowed) {
            if (!allowed) {
              res.statusCode = 403;
              req.flash('error', req.t('You\'re not allowed to delete this asset.'));
              return next();
            }
            calipso.lib.assets.deleteAsset(c.alias, function (err) {
              if (err) {
                req.flash('error', req.t('Could not delete assets because {msg}', {msg:err.message}));
                if (res.statusCode != 302) {
                  res.redirect('back');
                }
                return next();
              }
              req.flash('info', req.t('Asset deleted'));
              if (c.folder) {
                res.redirect('/assets/' + c.folder.id);
              } else {
                res.redirect('/assets/');
              }
              next();
            });
          });
        } else {
          req.flash('error', req.t('Could not locate asset, it may have been deleted by another user or there has been an error.'));
          res.redirect('/assets/');
          next();
        }
      });
    }
  });

}

function listAssets(req, res, template, block, next) {
  var tag = req.moduleParams.tag ? req.moduleParams.tag : '';
  var format = req.moduleParams.format ? req.moduleParams.format : 'html';
  var sortBy = req.moduleParams.sortBy;
  var params = {req:req, res:res, template:template, block:block, format:format, sortBy:sortBy, limit:req.moduleParams.limit, from:req.moduleParams.from};
  var Asset = calipso.db.model('Asset');

  var user = req.session && req.session.user && req.session.user.username;
  var productionId = null;
  var isfolder = false;
  var perm = 'view';
  var postFilename = '';
  var outputList = null;
  if (req.moduleParams.production) {
    var modParams = {production:req.moduleParams.production, filename:req.moduleParams.filename};
    var info = calipso.lib.assets.decodeUrl(req.moduleParams.production);
    if (!user) {
      if (info.sessionId === '') {
        return calipso.lib.assets.checkBasicAuth(req, res, function (err, user) {
          if (err) {
            return calipso.lib.assets.askBasicAuth(req, res);
          }
          user = req.session.username;
          req.moduleParams = modParams;
          listAssets(req, res, template, block, next);
        });
      } else {
        return calipso.app.sessionStore.get(info.sessionId, function (err, sess) {
          if (sess) {
            calipso.app.sessionStore.createSession(req, sess);
            user = req.session.username;
            req.moduleParams = modParams;
            listAssets(req, res, template, block, next);
          } else {
            calipso.lib.assets.checkBasicAuth(req, res, function (err, user) {
              if (err) {
                return calipso.lib.assets.askBasicAuth(req, res);
              }
              user = req.session.username;
              req.moduleParams = modParams;
              listAssets(req, res, template, block, next);
            });
          }
        });
      }
    }
    productionId = info.id;
    if (req.moduleParams.filename === '_list.json') {
      outputList = 'json';
    } else if (req.moduleParams.filename === '_list.xml') {
      outputList = 'xml';
    }
  } else {
    // alias is the path into the asset
    var alias = [];
    var root = null;
    for (var i = 1; i < 10; i++) {
      if (req.moduleParams['f' + i]) {
        alias.push(req.moduleParams['f' + i]);
      }
    }
    if (alias.length > 0) {
      if (alias.length > 0) {
        if (alias[alias.length - 1] === '_list') {
          alias[alias.length - 1] = '';
          alias = alias.join('/');
          isfolder = true;
          if (req.moduleParams.format) {
            outputList = req.moduleParams.format;
          } else {
            outputList = 'json';
          }
        } else {
          alias = alias.join('/') + (req.moduleParams.format ? '.' + req.moduleParams.format : '');
          if (req.url.substring(req.url.length - 1) == '/') {
            alias += '/';
            isfolder = true;
          }
        }
      } else {
        alias = null;
      }
    } else {
      alias = null;
    }

    if (/PUT|DELETE/.test(req.method) && !isfolder) {
      perm = 'add';
      var s = alias.split('/');
      postFilename = s[s.length - 1];
      s[s.length - 1] = '';
      alias = s.join('/');
      isfolder = true;
      calipso.debug(req.method + ' against folder ' + alias + ' with file ' + postFilename);
    }
  }

  var query = new Query();

  function finish() {
    var aPerm = calipso.permission.Helper.hasPermission("admin:user");
    var p = alias ? alias : "";
    if (alias === null) {
      res.menu.adminToolbar.addMenuItem(req, {name:'Create Bucket', weight:1, path:'new', url:'/assets/new', description:'Create Bucket ...', permit:aPerm, icon:"icon-basket-2"});
    } else {
      res.menu.adminToolbar.addMenuItem(req, {name:'Add folder', path:'newfolder', url:'/assets/addfolder/' + p, description:'Add a subfolder ...', popup:true, permit:aPerm, icon:"icon-folder-3"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Upload files', path:'uploadfiles', url:'/assets/upload/' + p, description:'Upload new files ...', popup:true, permit:aPerm, icon:"icon-upload"});
      res.menu.adminToolbar.addMenuItem(req, {name:'Upload folder', path:'uploadfolder', url:'/assets/upload/' + p + '?directory=true', description:'Upload new folder ...', popup:true, permit:aPerm, icon:"icon-upload-2"});
    }
    if (req.session.user && req.session.user.isAdmin) {
      // Show all
    } else {
      // Published only if not admin
      query.where('status', 'published');
    }

    if (tag) {
      res.layout = "tagLanding" // Enable landing page layout to be created for a tag view
      query.where('tags', tag);
    }

    // Folder levels tags
    var taxonomy = "";

    // Re-retrieve our object
    getAssetList(query, params, next);
  }

  if (alias || productionId) {
    Asset.findOne({$or:[
      {alias:alias, isfolder:isfolder},
      {_id:productionId}
    ]}).populate('folder').exec(function (err, folder) {
        function cloneAsset(asset, user) {
          var clone = {};
          if (!asset.isfolder) {
            clone.url = calipso.lib.assets.encodeUrl(asset, req.session, req.headers);
          }
          clone.description = asset.description;
          clone.title = asset.title;
          clone.author = asset.author;
          clone.updated = asset.updated;
          clone.created = asset.created;
          clone.updated_by = asset.updated_by;
          clone.guid = asset.id.toString();
          clone.isfolder = asset.isfolder;
          if (!clone.updated_by) {
            clone.updated_by = clone.author;
          }
          if (asset.fileType) {
            clone.fileType = asset.fileType;
          }
          if (asset.width) {
            clone.width = asset.width;
          }
          if (asset.height) {
            clone.height = asset.height;
          }
          if (asset.depth) {
            clone.depth = asset.depth;
          }
          if (asset.format) {
            clone.format = asset.format;
          }
          if (asset.showupAs) {
            clone.showupAs = asset.showupAs;
          }
          for (var k in asset) {
            if (/^custom/.test(k)) {
              clone[k] = asset[k];
              if (clone[k] === undefined) {
                clone[k] = '';
              }
            }
          }
          return clone;
        }

        if (!err && folder) {
          if (outputList) {
            calipso.lib.assets.checkPermission(folder.alias, user, perm, function (err, allowed) {
              if (err) {
                res.statusCode = 500;
                return next();
              }
              if (!allowed) {
                res.statusCode = 403;
                req.flash('error', req.t('You are not allowed to view this resource {alias}', {alias:alias}));
                return next();
              }
              function populateChildren(parent, folder, callback) {
                if (folder.childAssets) {
                  var child = folder.childAssets.splice(0, 1)[0];
                  if (!child) {
                    delete folder.childAssets;
                    return callback(null, folder);
                  }
                  if (!folder.children) {
                    folder.children = [];
                  }
                  folder.children.push(child);
                  if (child.isfolder) {
                    child.tag = 'Folder';
                    return populateChildren(folder, child, function (err, child) {
                      populateChildren(parent, folder, callback);
                    });
                  } else {
                    child.tag = 'File';
                    return populateChildren(parent, folder, callback);
                  }
                }
                Asset.find({folder:folder.guid}).sort('customSort title').exec(function (err, assets) {
                  if (err) {
                    return next(err);
                  }
                  folder.childAssets = [];
                  assets.forEach(function (asset) {
                    folder.childAssets.push(cloneAsset(asset, user));
                  });
                  populateChildren(parent, folder, function (err, folder) {
                    function sortFunction(x, y) {
                      x = x.customSort || x.customLink || x.title || '';
                      y = y.customSort || y.customLink || y.title || '';
                      if (x === y) {
                        return 0;
                      }
                      return x < y ? -1 : 1;
                    }

                    folder.children.sort(sortFunction);
                    if (folder.showupAs && parent) {
                      var index = parent.children.indexOf(folder);
                      parent.children.splice(index, 1); // remove this folder out of the parent.
                      folder.children.forEach(function (item) {
                        var found = false;
                        parent.children.some(function (parChild) {
                          if ((parChild.customLink || parChild.customSort) === (item.customLink || item.customSort)) {
                            found = true;
                            if (!parChild.children) {
                              parChild.children = [];
                            }
                            parChild.children.push(item);
                            item.tag = folder.showupAs;
                            return true;
                          }
                          return false;
                        });
                        if (!found) {
                          item.tag = folder.showupAs;
                          var parChild = {tag:'Fake', children:[item], customLink:item.customLink, customSort:item.customSort, title:item.title};
                          parent.children.push(parChild);
                          parent.children.sort(sortFunction);
                        }
                      });
                    }
                    callback(null, folder);
                  });
                });
              }

              var folderClone = cloneAsset(folder, user);
              folderClone.tag = 'Folder';
              return populateChildren(null, folderClone, function (err, f) {
                if (outputList === 'json') {
                  res.write(JSON.stringify(folderClone));
                  return res.end();
                } else if (outputList === 'xml') {
                  var xml = ['<?xml version="1.0" encoding="UTF-8"?>\n'];

                  function xmlEscape(str) {
                    if (str instanceof Date) {
                      return str.toJSON();
                    }
                    if (!(str instanceof String)) {
                      return str.toString();
                    }
                    if (!str) {
                      return str;
                    }
                    str = str.replace('&', '&amp;');
                    str = str.replace('"', '&quot;');
                    str = str.replace('<', '&lt;');
                    str = str.replace('<', '&gt;');
                    return str;
                  }

                  function append(asset) {
                    xml.push('<' + asset.tag + ' ');
                    for (var v in asset) {
                      if (v === 'children') {
                        continue;
                      }
                      xml.push(v + '="', xmlEscape(asset[v]), '" ');
                    }
                    if (asset.children) {
                      xml.push('>');
                      asset.children.forEach(function (child) {
                        append(child);
                      });
                      xml.push('</' + asset.tag + '>');
                    } else {
                      xml.push('/>');
                    }
                  }

                  append(folderClone);
                  res.write(xml.join(''));
                  res.end();
                } else {
                  res.statusCode = 500;
                  next();
                }
              });
            });
            return;
          }
          if (!folder.isfolder || postFilename) {
            var folderAlias = folder.alias;
            var paths = folder.key.split('/');
            var k = require('knox').createClient({
              key:calipso.config.getModuleConfig("assets", "s3key"),
              secret:calipso.config.getModuleConfig("assets", "s3secret"),
              bucket:paths.splice(0, 1)[0]
            });
            var fileName = null;
            if (postFilename) {
              fileName = postFilename;
              paths[paths.length - 1] = postFilename;
            } else {
              fileName = paths[paths.length - 1];
            }
            var contentType = mime.lookup(fileName);
            var range = req.headers['Range'];
            var headers = {'Response-Content-Type':contentType};
            if (postFilename && (req.method == 'PUT')) {
              headers['Content-Length'] = req.headers['content-length'];
              headers['Content-Type'] = contentType;
            }
            if (range) {
              headers['Range'] = range;
            }
            if (/PUT/.test(req.method)) {
              Asset.findOne({alias:folderAlias + postFilename}, function (err, existingAsset) {
                if (existingAsset) {
                  perm = 'modify';
                }

                calipso.lib.assets.checkPermission(folderAlias, user, perm, function (err, allowed) {
                  if (err) {
                    res.statusCode = 500;
                    return next();
                  }
                  if (!allowed) {
                    res.statusCode = 403;
                    req.flash('error', req.t('You are not allowed to modify this resource {alias}', {alias:alias}));
                    return next();
                  }
                  calipso.lib.assets.createAsset({
                    path:folderAlias + postFilename,
                    copyStream:req,
                    copyStreamPaused:true,
                    copyStreamSize:req.headers['content-length'],
                    author:user
                  }, function (err, asset) {
                    if (err) {
                      res.statusCode = 500;
                      req.flash('error', req.t('Unable to create asset ' + folderAlias + postFilename));
                      calipso.error('Unable to create asset ' + err.message);
                      return;
                    }
                    res.statusCode = 200;
                    res.end('Your file ' + postFilename + ' was saved to ' + folderAlias);
                  });
                });

                return;
              });
            }
            calipso.lib.assets.checkPermission(folderAlias, user, perm, function (err, allowed) {
              if (err) {
                res.statusCode = 500;
                return next();
              }
              if (!allowed) {
                res.statusCode = 403;
                req.flash('error', req.t('You are not allowed to view this resource {alias}', {alias:alias}));
                return next();
              }
              var s3req = k.request(req.method, escape(paths.join('/')), headers).on('response', function (s3res) {
                var headers = {};
                if (req.url.substring(req.url.length - fileName.length) !== fileName) {
                  headers['Content-Disposition'] = 'inline; filename="' + fileName + '"';
                }
                for (var v in s3res.headers) {
                  headers[v] = s3res.headers[v];
                }
                if (contentType) {
                  headers['Content-Type'] = contentType;
                }
                s3res.on('error', function (err) {
                  calipso.error(err.message);
                  next();
                });
                res.statusCode = 200;
                res.writeHead(200, headers);
                s3res.on('data', function (chunk) {
                  res.write(chunk);
                });
                s3res.on('error', function (err) {
                  calipso.error(err.message);
                  next();
                });
                s3res.on('end', function () {
                  res.end();
                });
                req.resume();
              });
              s3req.end();        // Just return the object
            });
            return;
          } else {
            // query for the parent folder
            query.where('folder', folder._id);
            // Also return the folder itself to be able to display this as a link to the parent folder.
            query._conditions = {$or:[query._conditions, {_id:folder.id}]};
            params.folder = folder;
            finish();
          }
        } else {
          res.statusCode = 404;
          req.flash('error', req.t('Unable to find parent folder {alias}: {error}', {alias:alias, error:(err && err.message) || 'Unknown error'}));
          next();
          return;
        }
      });
  } else {
    // at the root of the system we just see the buckets
    query.or([
      {'isroot':true},
      {'isproject':true}
    ]);
    finish();
  }
};

function syncAssets(req, res, route, next) {
  var p = [];
  for (var i = 1; i < 10; i++) {
    if (req.moduleParams['f' + i]) {
      p.push(req.moduleParams['f' + i]);
    }
  }
  res.write('<html><body><ul>');
  calipso.lib.assets.syncFolder(p.join('/'), function (err, out) {
    res.write('</ul></body></html>');
    res.end();
  }, function (prog) {
    res.write('<li>' + prog + '</li>');
  });
}

/**
 * Helper function for link to user
 */
function formatSize(req, asset) {
  if (asset.IsDirectory) {
    return "DIR";
  }
  return asset.Size;
}

function assetType(req, asset) {
  if (asset.isbucket) {
    return "S3 Bucket";
  }
  if (asset.isproject) {
    return "Project";
  }
  if (asset.isfolder) {
    return "Folder";
  }
  return asset.size;
}

/**
 * Take a query and parameters, return or render asset lists
 * This has been refactored so it can be called as a helper (e.g. views)
 * From a theme
 */
function getAssetList(query, out, next) {
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
    if (pager) {
      pagerHtml = calipso.lib.pager.render(from, limit, total, out.req.url);
    }

    var qry = Asset.find(query).skip(from).limit(limit).populate('bucket');
    // Add sort
    qry = calipso.table.sortQuery(qry, out.sortBy);
    qry.options.sort = qry.options.sort || [];
    qry.options.sort.splice(0, 0, ['isfolder', -1]);
    qry.options.sort.splice(0, 0, ['isproject', -1]);
    qry.find(function (err, assets) {
      if (out && out.res) {
        // Render the item into the response
        if (out.format === 'html') {
          // This is where the asset table is rendered for HTML.
          // We might need a folder like view composed of a bunch of <div> instead.
          var table = {id:'content-list', sort:true, cls:'table-admin',
            columns:[
              {name:'title', sort:'title', label:'Title', fn:function (req, asset) {
                if (asset.id === (out.folder && out.folder.id)) {
                  if (out.folder.isroot) {
                    return calipso.link.render({id:asset.alias, title:req.t('View root folder list'), label:'Root', url:'/asset/'});
                  } else if (out.folder.folder && out.folder.folder.isproject) {
                    return calipso.link.render({id:out.folder.alias, title:req.t('View parent project {parent}', {parent:out.folder.folder.title}), label:'Parent Folder', url:'/asset/' + out.folder.folder.alias});
                  } else if (out.folder.folder && out.folder.folder.isfolder) {
                    return calipso.link.render({id:out.folder.alias, title:req.t('View parent folder {parent}', {parent:out.folder.folder.title}), label:'Parent Folder', url:'/asset/' + out.folder.folder.alias});
                  }
                }
                if (asset.isproject) {
                  return calipso.link.render({id:asset.alias, title:req.t('View project {asset}', {asset:asset.title}), label:asset.title, url:'/asset/' + asset.alias});
                }
                if (asset.isfolder) {
                  return calipso.link.render({id:asset.alias, title:req.t('View folder {asset}', {asset:asset.title}), label:asset.title, url:'/asset/' + asset.alias});
                }
                return calipso.link.render({id:asset.alias, title:req.t('Edit file {asset}', {asset:asset.title}), label:asset.title, url:'/assets/' + asset._id});
              }},
              {name:'alias', label:'Alias', fn:function (req, asset) {
                var file = asset.alias;
                if (asset.id === (out.folder && out.folder.id)) {
                  return calipso.link.render({id:asset.alias, title:req.t('Get folder list'), label:asset.title, url:calipso.lib.assets.encodeUrl(asset, null, {filename:'_list.xml'})});
                }
                if (out.path) {
                  file = file.replace(out.path, '');
                }
                if (asset.isbucket) {
                  return file;
                }
                if (asset.isproject) {
                  return asset.title;
                } else {
                  return calipso.link.render({id:file, title:req.t('View file {asset}', {asset:asset.title}), label:file, url:'/asset/' + asset.alias});
                }
              }},
              {name:'isfolder', label:'Type', fn:assetType},
              {name:'key', label:'S3 Key'},
              {name:'author', label:'Author'},
              {name:'created', label:'Created'},
              {name:'updated', label:'Updated'}
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

          calipso.theme.renderItem(out.req, out.res, tableHtml, out.block, null, next);
        }
        if (out.format === 'json') {
          out.res.format = out.format;
          out.res.end(contents.map(function (u) {
            return u.toObject();
          }));
        }
        // This really needs to be pluggable
        // WIP!
        if (out.format === 'rss') {
          // Override the template
          out.res.layout = "rss";
          var newTemplate = calipso.modules["content"].templates["rss"];
          if (newTemplate) {
            calipso.theme.renderItem(out.req, out.res, newTemplate, out.block, {contents:contents}, next);
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
        next(null, output);
      }
    });
  });
}

