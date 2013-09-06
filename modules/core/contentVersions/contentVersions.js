/**
 * Module that allows management of content types
 * Base content type sub-module [Depends on Content]
 */

var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require('mongoose').Query,
  diff = require('./support/jsdiff');

exports = module.exports = {
  init:init,
  route:route,
  about:{
    description:'Provides versioning hooks and forms to enable storage and retrieval of different versions of content.',
    author:'cliftonc',
    version:'0.2.0',
    home:'http://github.com/cliftonc/calipso'
  },
  depends:["content"]
};

/**
 * Router
 */
function route(req, res, module, app, next) {

  /**
   * Routing and Route Handler
   */
  module.router.route(req, res, next);

}

/**
 *Init
 */
function init(module, app, next) {

  // Version events
  calipso.e.addEvent('CONTENT_VERSION');

  // Permissions
  calipso.permission.Helper.addPermission("content:versions:view", "View content versions.");
  calipso.permission.Helper.addPermission("content:versions:diff", "Diff content versions.");
  calipso.permission.Helper.addPermission("content:versions:revert", "Revert content versions.");

  calipso.lib.step(
    function defineRoutes() {

      var vPerm = calipso.permission.Helper.hasPermission("content:versions:view"),
        dPerm = calipso.permission.Helper.hasPermission("content:versions:diff"),
        rPerm = calipso.permission.Helper.hasPermission("content:versions:revert");

      // Menus
      module.router.addRoute('GET /content/show/:id', showContentVersionsMenu, {admin:true}, this.parallel());

      // Crud operations
      module.router.addRoute('GET /content/show/:id/versions', listVersions, {admin:true, permit:vPerm, template:'list', block:'content.version'}, this.parallel());
      module.router.addRoute('GET /content/show/:id/versions/diff/:a', diffVersion, {admin:true, permit:dPerm, template:'diff', block:'content.diff'}, this.parallel());
      module.router.addRoute('GET /content/show/:id/versions/diff/:a/:b', diffVersion, {admin:true, permit:dPerm, template:'diff', block:'content.diff'}, this.parallel());
      module.router.addRoute('GET /content/show/:id/version/:version', showVersion, {admin:true, permit:vPerm, template:'show', block:'content.version'}, this.parallel());
      module.router.addRoute('GET /content/show/:id/version/:version/revert', revertVersion, {admin:true, permit:rPerm}, this.parallel());

    },
    function done() {

      // Schema
      var ContentVersion = new calipso.lib.mongoose.Schema({
        contentId:{type:String}
        // All other properties are dynamically mapped, hence use of .set / .get
      });

      calipso.db.model('ContentVersion', ContentVersion);

      // Version event listeners
      calipso.e.post('CONTENT_CREATE', module.name, saveVersion);
      calipso.e.post('CONTENT_UPDATE', module.name, saveVersion);

      // Form alter of main content form
      calipso.e.custom('FORM', 'content-form', module.name, alterContentForm);

      next();

    }
  );
}

/**
 * Event listener to alter the content-form
 */
function alterContentForm(key, data, next) {

  if (data && data.sections) {
    data.sections.push(contentVersionFormSection);
  }
  next(data);
}

/**
 * Section to add to content form
 */
var contentVersionFormSection = {
  id:'form-section-content-version',
  label:'Versioning',
  fields:[
    {label:'New Version?', name:'content[version]', type:'select', options:["No", "Yes"], noValue:true, description:'This change marks the content as a new version.'},
    {label:'Comment', name:'content[comment]', type:'textarea', noValue:true, description:'Describe the reason for this version.', placeholder:"New version, describing X changes"}
  ]
}

/**
 * Show content menu
 */
function showContentVersionsMenu(req, res, template, block, next) {
  var id = req.moduleParams.id, vPerm = calipso.permission.Helper.hasPermission("content:versions:view");
  res.menu.adminToolbar.addMenuItem(req, {name:'Versions', permit:vPerm, weight:10, path:'versions', url:'/content/show/' + id + '/versions', icon:"icon-list-3", description:'Show versions ...', security:[]});
  next();
}

/**
 * Save version
 */
function saveVersion(event, content, next) {

  var ContentVersion = calipso.db.model('ContentVersion');

  // Create version and map fields
  var version = new ContentVersion();

  calipso.utils.copyMongoObject(content, version, content.schema);
  version.contentId = content._id;

  if (version.get("version")) {
    calipso.e.pre_emit('CONTENT_VERSION', version);
  }

  version.save(function (err) {

    if (err) {
      calipso.error(err);
    }
    if (version.get("version")) {
      // TODO - enable notification / event?
      calipso.e.post_emit('CONTENT_VERSION', version);
    }

    return next();

  });

}

/**
 * Show version
 */
function showVersion(req, res, template, block, next) {

  var contentId = req.moduleParams.id;
  var id = req.moduleParams.version;
  var format = req.moduleParams.format || 'html';

  var ContentVersion = calipso.db.model('ContentVersion');

  var vPerm = calipso.permission.Helper.hasPermission("content:versions:view"),
    rPerm = calipso.permission.Helper.hasPermission("content:versions:revert");

  res.menu.adminToolbar.addMenuItem(req, {name:'Return', path:'return', permit:vPerm, url:'/content/show/' + contentId + '/versions', description:'Show content ...', security:[], icon:"icon-undo"});
  res.menu.adminToolbar.addMenuItem(req, {name:'Revert', path:'revert', permit:rPerm, url:'/content/show/' + contentId + '/version/' + id + '/revert', description:'Revert to this version of content ...', security:[], icon:"icon-reply-2"});

  ContentVersion.findById(id, function (err, version) {

    if (err && !version) {
      calipso.err(err);
      next();
      return;
    }

    if (format === 'html') {
      calipso.theme.renderItem(req, res, template, block, {version:version}, next);
    }

    if (format === 'json') {
      res.format = format;
      res.send(version.map(function (u) {
        return u.toObject();
      }));
      next();
    }

  });

}

/**
 * Show diff between versions
 */
function diffVersion(req, res, template, block, next) {

  var a = req.moduleParams.a;
  var b = req.moduleParams.b;

  var ContentVersion = calipso.db.model('ContentVersion');

  ContentVersion.findById(a, function (err, versionA) {

    if (!err && versionA) {
      ContentVersion.findById(b, function (err, versionB) {
        if (!err && versionB) {
          // TODO : Use a proper HTML diff parser ... this only works for non-HTML

          var aTeaser = htmlStrip(versionA.get("teaser"));
          var bTeaser = htmlStrip(versionB.get("teaser"));

          var aContent = htmlStrip(versionA.get("content"));
          var bContent = htmlStrip(versionB.get("content"));

          var diffTeaser = diff.diffString(bTeaser, aTeaser);
          var diffContent = diff.diffString(bContent, aContent);

          // Render, but push out direct response
          calipso.theme.renderItem(req, res, template, block, {diff:{teaser:diffTeaser, content:diffContent}}, function () {
            res.renderedBlocks.get('content.diff', function (err, content) {
              res.send(content.join(""));
            });
          });

        } else {
          res.send(req.t("There was an issue finding versions to diff"));
        }
      });
    } else {
      res.send(req.t("There was an issue finding versions to diff"));
    }

  });

}

/**
 * Helper function to remove all html tags until we find a decent HTML diff
 */
function htmlStrip(string) {

  var output = string.replace(/<(.*?)>/g, '');
  return output;

}

/**
 * SHow list of versions
 */
function listVersions(req, res, template, block, next) {

  var id = req.moduleParams.id;

  // Re-retrieve our object
  var ContentVersion = calipso.db.model('ContentVersion');

  var vPerm = calipso.permission.Helper.hasPermission("content:versions:view"),
    dPerm = calipso.permission.Helper.hasPermission("content:versions:diff");

  res.menu.adminToolbar.addMenuItem(req, {name:'Diff', permit:dPerm, path:'diff', url:'', description:'Diff versions ...', security:[], icon:"icon-console"});
  res.menu.adminToolbar.addMenuItem(req, {name:'Return', permit:vPerm, path:'return', url:'/content/show/' + id, description:'Show content ...', security:[], icon:"icon-undo"});

  var format = req.moduleParams.format ? req.moduleParams.format : 'html';

  var query = new Query({contentId:id});

  // Initialise the block based on our content
  ContentVersion.find(query)
    .sort('-updated')
    .find(function (err, versions) {

      // Render the item into the response
      if (format === 'html') {
        calipso.theme.renderItem(req, res, template, block, {versions:versions}, next);
      }

      if (format === 'json') {
        res.format = format;
        res.send(versions.map(function (u) {
          return u.toObject();
        }));
        next();
      }

    });

}

/**
 * Revert version
 */
function revertVersion(req, res, template, block, next) {

  var contentId = req.moduleParams.id;
  var id = req.moduleParams.version;
  var format = req.moduleParams.format || 'html';

  var Content = calipso.db.model('Content');
  var ContentVersion = calipso.db.model('ContentVersion');

  ContentVersion.findById(id, function (err, version) {

    if (err && !version) {
      calipso.err(err);
      next();
      return;
    }

    // Copy over
    Content.findById(contentId, function (err, content) {

      if (err && !content) {
        calipso.err(err)
        next();
        return;
      }

      calipso.utils.copyMongoObject(version, content, content.schema);

      content.author = req.session.user.username;
      content.set("comment", 'Reverted to version: ' + content.updated);
      content.updated = new Date();
      content.set("version", 'Yes');

      content.save(function (err) {
        res.redirect('/content/show/' + contentId);
        next();
      });

    });

  });

}

