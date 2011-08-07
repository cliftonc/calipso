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
var calipso = require("lib/calipso"),
  exec = require('child_process').exec,
  sys = require('sys'),
  colors = require('colors'),
  sys = require('sys'),
  util = require('util'),
  semver = require('semver');

/**
 * Core object, inherits event emitter
 * To enable both web and cli modes to listen to what it is doing ... ?
 * TODO -
 */
function Downloader = function () {

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
      processDownload(type,path,next);
    }
  }

  if(fromUrl.match(/^http.*/)) {
    downloadUrl(fromUrl,toPath,cli,localNext);
    return;
  }

  if(fromUrl.match(/^(.*)\/(.*)$/)) {
    downloadGithub(fromUrl,toPath,cli,localNext);
    return;
  }

  // Otherwise assume repo
  // NOT YET IMPLEMENTED
  next(new Error("Download via repository not yet implemented, use github project (cliftonc/calipso-elastic) or a full URL."));

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


function downloadFile(url,fileName,toPath,next) {

  var u = require('url'), fs = require('fs'), path = require('path');
  var parts = u.parse(url);

  // Ensure we have our download folder
  var tmpFolder = toPath;

  if(!path.existsSync(tmpFolder)) {
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

  console.log("Downloading file:".cyan);
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
 * Process a downloaded module, place into modules folder
 */

function processDownload(type,file,next) {

  // Checks
  var isValid;

  // #1 - Is it a zip?
  isValid = file.match(/.zip$/);

  // #2 - unzip it, check contents
  if(isValid) {
    unzipDownload(type,file,next);
  } else {
    next(new Error("The file downloaded must be a valid zip archive."));
  }

}

/**
 * Process a downloaded module, place into modules folder
 */

function unzipDownload(type,file,next) {

  var zip = require('zipfile'),
    fs = require('fs'),
    rimraf = require('rimraf'),
    path = require('path');

  var zf = new zip.ZipFile(file),
      baseFolder,
      tmpFolder,
      tmpName;

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
    if(path.existsSync(tmpFolder)) {
      rimraf.sync(tmpFolder);
    }

    // Now unzip
    zf.names.forEach(function(name) {

      var uncompressed = name.replace(baseFolder,tmpFolder);
      var dirname = path.dirname(uncompressed);

      // Try to create the folder
      try {
        fs.mkdirSync(dirname, 0755)
      } catch(ex) {
        if(ex.code === 'EEXIST') {
          // Ignore
        } else {
          next(new Error("Couldn't create folder " + dirname + " because " + ex.message));
          return;
        }
      }

      // Expand any files
      if (path.extname(uncompressed)) {
        try {
          var buffer = zf.readFileSync(name);
          fd = fs.openSync(uncompressed, 'w');
          fs.writeSync(fd, buffer, 0, buffer.length, null);
          fs.closeSync(fd);
        } catch(ex) {
          next(new Error("Couldn't write file " + uncompressed + " because " + ex.message));
          return;
        }
      }

    });

    // Delete the zip file
    fs.unlinkSync(file);

    // Return;
    next(null,tmpName,tmpFolder);

  } else {
    if(type === 'module') {
      next(new Error("The file does not appear to have a valid package.json that specifies the name."));
    } else {
       next(new Error("The file does not appear to have a valid theme.json that specifies the name."));
    }

  }

}

/**
 * Exports
 */
module.exports = exports = download;
