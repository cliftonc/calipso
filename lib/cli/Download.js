/*!
 * Calipso Common CLI Download (Modules / Themes)
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * Provides functions to enable download from repo.calip.so, github, full URL.
 *
 */

/**
 * Module exports
 *
 */
var rootpath = process.cwd() + '/',
  path = require('path')
  calipso = require(path.join(rootpath, 'lib/calipso')),
  api = require(path.join(rootpath, 'lib/cli/RepoApi')),
  moduleCli = require(path.join(rootpath, 'lib/cli/Modules')),
  themeCli = require(path.join(rootpath, 'lib/cli/Themes')),
  exec = require('child_process').exec,
  colors = require('colors'),
  util = require('util'),
  zip = require('zipfile'),
  fs = require('fs'),
  rimraf = require('rimraf')
  semver = require('semver');

/**
=======
 * Core object, inherits event emitter
 * To enable both web and cli modes to listen to what it is doing ... ?
 * TODO -
 */
function Downloader() {

  var self = this;

}

/**
 * Download
 */
function download(type,fromUrl,toPath,cli,next) {

  // Create a common file process function
  var localNext = function(err,path) {
    if(err) {
      next(err);
    } else {
      processDownload(type, path, next);
    }
  }

  if(fromUrl.match(/^http.*/)) {
    return downloadUrl(fromUrl, toPath, cli, localNext);
  }

  if(fromUrl.match(/^(.*)\/(.*)$/)) {
    return downloadGithub(fromUrl, toPath, cli, localNext);
  }

  // Otherwise assume repo - append type
  fromUrl = type + "/" + fromUrl;
  return downloadRepo(type, fromUrl, toPath, cli, localNext);

}


/**
 * Download a module from repo
 * This is called by install
 */
function downloadRepo(type,fromUrl,toPath,cli,next) {

  // Split module / version
  var repoName = fromUrl;

  if(repoName) {

      var version = repoName.split('@')[1] || "";
      var repoName = repoName.split('@')[0];
      var tmpName = repoName.replace("/","-");

    constructRepoUrl(repoName, version, function(err,url) {
      if(!err && url) {
        return downloadGithub(url, toPath, cli, next);
      } else {
        next(err);
      }
    });

  } else {
    next(new Error('You need to provide a calipso repository project name - e.g. ElasticSearch'));
  }

}



/**
 * Download a module from github
 * This is called by install
 */
function downloadGithub(fromUrl,toPath,cli,next) {

  // Split module / version
  var githubName = fromUrl;

  if(githubName) {

    var tag = githubName.split('@')[1] || "";
    var githubName = githubName.split('@')[0];
    var tmpName = githubName.replace("/","-");

    if(githubName.split("/").length !== 2) {
       next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
       return;
    }

    var url = constructGithubUrl(githubName,tag);

    if(url) {
      downloadFile(url,tmpName,toPath,next);
    } else {
      next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
    }

  } else {
    next(new Error('You need to provide a github project name - e.g. cliftonc/calipso-elastic'));
  }

}

/**
 * Download a module from a url
 * This is called by install
 */
function downloadUrl(fromUrl,toPath,cli,next) {

  // Split module / version
  var url = fromUrl, path = require('path');

  if(url) {

     var u = require('url'), fs = require('fs');
     var parts = u.parse(url);
     var tmpName = path.basename(parts.pathname);

     if(tmpName && tmpName.match(/.zip$/)) {
        downloadFile(url,tmpName,toPath,next);
     } else {
       next(new Error('You need to provide a valid url to your module zip file, e.g. http://cliftoncunningham.co.uk/module.zip'));
     }
  } else {
    next(new Error('You need to provide a valid url to your module zip file, e.g. http://cliftoncunningham.co.uk/module.zip'));
  }

}


function downloadFile(url, fileName, toPath, next) {

  var u = require('url'), fs = require('fs'), path = require('path');
  var parts = u.parse(url);

  // Ensure we have our download folder
  var tmpFolder = toPath;

  if(!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, 0755);
  }

  if(parts.protocol === 'https:') {
    client = require('https');
  } else {
    client = require('http');
    if(!parts.port) {
      parts.port = 80;
    }
  }

  console.log("\r\nResolving file location, and downloading ...".cyan);

  client.get({ host: parts.hostname, port: parts.port, path: parts.pathname }, function(res) {

      if(res.statusCode === 302) {
        console.log("Redirecting to ".grey + res.headers.location.grey + " ...".grey);
        downloadFile(res.headers.location,fileName,toPath,next);
        return;
      }

      if(res.statusCode === 200) {

        var tmpFile = tmpFolder + fileName + '.zip';
        var fd = fs.openSync(tmpFile, 'w');
        var size = 0;
        var totalSize = parseInt(res.headers['content-length']);
        var progress = 0;

        res.on('data', function (chunk) {
          size += chunk.length;
          progress = showProgress(size,totalSize,progress);
          fs.writeSync(fd, chunk, 0, chunk.length, null);
        });

        res.on('end',function(){
            process.stdout.write("\n\n");
            fs.closeSync(fd);
            next(null,tmpFile);
        });

      } else {

        next(new Error("Unable to download file, status was " + res.statusCode));

      }

  }).on('error', function(err) {

    next(err);

  });

}

function showProgress(size,totalSize,progress) {

  var newProgress = Math.floor((size / totalSize)*20);
  if(newProgress > progress) {
    for(var i=progress + 1; i <= newProgress; i++) {
      switch(i) {
        case 1:
          process.stdout.write("[".red + "0%".green);
          break;
        case 5:
          process.stdout.write("25%".green);
          break;
        case 10:
          process.stdout.write("50%".green);
          break;
        case 15:
          process.stdout.write("75%".green);
          break;
        case 20:
          process.stdout.write("100%".green + "]".red);
          break;
        default:
          process.stdout.write(".".blue);
      }
    }
    progress = newProgress;
  }
  return progress;

}

/**
 * Create a github url
 */
function constructGithubUrl(userProject,tag) {

  var url = "";
  if(tag) {
    url = "https://github.com/" + userProject + "/zipball/" + tag;
  } else {
    url = "https://github.com/" + userProject + "/zipball/master";
  }
  return url;

}

/**
 * Create a url based on the repository details
 */
function constructRepoUrl(repoName, version, next) {

  // Create our API wrapper
  var repo = new api();

  // Variables for lookup
  var type = repoName.split("/")[0];
  var name = repoName.split("/")[1];
  var version = version || "master";

  repo.get({type:type, name:name, version:version},function(err,r) {
      if(err || !r) {
        next(err);
      } else {
        if(r.length === 1) {
          var versions = r[0].versions;
          // Find the version specified
          var versionMatched = false;
          versions.forEach(function(v) {
              if(v.version === version) {
                next(null,v.url);
                versionMatched = true;
                console.log("Resolved ".cyan.bold + name.green.bold + "@".white + v.version.green.bold + " to github repo ".cyan.bold + v.url + (v.version === "master" ? "" : "@" + v.version));
                return;
              }
          });
          if(!versionMatched) {
            next(new Error("Unable to locate the version specified."));
          }
        } else {
          if(r.length === 0) {
            if(type === "module") {
              console.log("\r\nNo entries found, searching the repository for a module along the same lines ...".white.bold);
              moduleCli.findModule(["",name], true, function(err,data) {
                // Throw a blank error
                next(new Error("Please try again using one of the module names listed above, or perhaps this is the inspiration for you to build one? :)"));
              });
            } else {
              console.log("\r\nNo entries found, searching the repository for a theme along the same lines ...".white.bold);
              themeCli.findTheme(["",name], true, function(err,data) {
                // Throw a blank error
                next(new Error("Please try again using one of the theme names listed above, or perhaps this is the inspiration for you to build one? :)"));
              });
            }

          } else {
            next(new Error("There was an error locating that module, " + r.length.toString().red.bold + " entries returned".red));
          }
        }
      }
  });

}

/**
 * Process a downloaded module, place into modules folder
 */

function processDownload(type, file, next) {

  // Checks
  var isValid;

  // #1 - Is it a zip?
  isValid = file.match(/.zip$/);

  // #2 - unzip it, check contents
  if(isValid) {
    unzipDownload(type, file, function(err, tmpName, tmpFolder) {
      // Intercept to enable a cleanup
      if(err) {
        fs.unlinkSync(file);
        err.message = err.message + "The downloaded file has been deleted.";
      }
      next(err, tmpName, tmpFolder);
    });
  } else {
    next(new Error("The file downloaded must be a valid zip archive."));
  }

}

/**
 * Process a downloaded module, place into modules folder
 */

function unzipDownload(type, file, callback) {

  var zf,
      baseFolder,
      tmpFolder,
      tmpName;

  try {
    zf = new zip.ZipFile(file)
  } catch(ex) {
    return callback(ex);
  }

  zf.names.forEach(function(name) {

      // First result is the basefolder
      if(!baseFolder) {
        baseFolder = name; // Store
      }

      // Now, lets find the package.json
      if(type === 'module' && name === (baseFolder + "package.json")) {
          var buffer = zf.readFileSync(name);
          var packageJson = JSON.parse(buffer);
          tmpName = packageJson.name;
          tmpFolder = path.join(path.dirname(file),tmpName + "/"); // Extraction will go here
      }

      // Now, lets find the theme.json
      if(type === 'theme' && name === (baseFolder + "theme.json")) {
          var buffer = zf.readFileSync(name);
          var themeJson = JSON.parse(buffer);
          tmpName = themeJson.name;
          tmpFolder = path.join(path.dirname(file),tmpName + "/"); // Extraction will go here
      }

  });

  // Check that we have both a module name
  if(tmpName) {

    // Make sure we delete any existing tmp folder
    if(fs.existsSync(tmpFolder)) {
      rimraf.sync(tmpFolder);
    }

    // First run through and create every directory synchronously
    var folders = [];
    zf.names.forEach(function(name) {
        folders.push(name.replace(baseFolder,"").split("/"));
    });

    folders.forEach(function(folderList) {
      var folder = tmpFolder;
      folderList.forEach(function (currFolder) {
          var isDir = (!path.extname(currFolder) || currFolder[0] === '.');
          folder = path.join(folder, currFolder);
          if(isDir) {
            dirExists(folder);
          }
      });
    });

    // Now, lets extract all the files
    var remaining = zf.names.length;

    zf.names.forEach(function(name) {

           var dest = path.join(
                tmpFolder,
                name.replace(baseFolder,"")
           );

            // Skip directories, hiddens.
            var isDir = (!path.extname(name) || name[0] === '.' || name[name.length] === "/");
            if (isDir) {
              remaining--;
              if (!remaining) return callback(null);
            } else {
              zf.readFile(name, function(err, buff) {
                  if (err) return callback(err);
                  fs.open(dest, 'w', 0644, function(err, fd) {
                    if(err) {
                      if(err.code !== "EISDIR") {
                        // fs.unlinkSync(file);
                        return callback(err);
                      } else {
                        remaining--;
                      }

                    } else {
                      fs.write(fd, buff, 0, buff.length, null, function(err) {
                          if (err) {
                            fs.unlinkSync(file);
                            return callback(err);
                          }
                          fs.close(fd, function(err) {
                              if (err) return callback(err);
                              remaining--;
                              if (!remaining) {
                                fs.unlinkSync(file);
                                callback(null,tmpName,tmpFolder);
                              }
                          });
                      });
                    }
                  });
              });
            }
    });


  } else {
    if(type === 'module') {
      next(new Error("The file does not appear to have a valid package.json that specifies the name."));
    } else {
       next(new Error("The file does not appear to have a valid theme.json that specifies the name."));
    }

  }

}

/**
 *
 */
function dirExists(dest) {

  var fs = require('fs');

  // Try to create the folder
  try {
    fs.mkdirSync(dest, 0755)
  } catch(ex) {
    if(ex.code === 'EEXIST') {
      // Ignore
      return true;
    } else {
      return false;
    }
  }

  return true;

}


/**
 * Exports
 */
module.exports = exports = download;
