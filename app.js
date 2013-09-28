/**
 * Calipso, a NodeJS CMS
 *
 * This file is the core application launcher.  See app-cluster for visibility
 * of how the application should be run in production mode
 *
 * Usage:  node app, or NODE_ENV=production node app
 *
 */

var req = require('express/lib/request'),
  utils = require('express/lib/utils');

var flashFormatters = req.flashFormatters = {
  s:function (val) {
    return String(val);
  }
};

function miniMarkdown(str) {
  return String(str)
    .replace(/(__|\*\*)(.*?)\1/g, '<strong>$2</strong>')
    .replace(/(_|\*)(.*?)\1/g, '<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
};

/**
 * Queue flash `msg` of the given `type`.
 *
 * Examples:
 *
 *      req.flash('info', 'email sent');
 *      req.flash('error', 'email delivery failed');
 *      req.flash('info', 'email re-sent');
 *      // => 2
 *
 *      req.flash('info');
 *      // => ['email sent', 'email re-sent']
 *
 *      req.flash('info');
 *      // => []
 *
 *      req.flash();
 *      // => { error: ['email delivery failed'], info: [] }
 *
 * Formatting:
 *
 * Flash notifications also support arbitrary formatting support.
 * For example you may pass variable arguments to `req.flash()`
 * and use the %s specifier to be replaced by the associated argument:
 *
 *     req.flash('info', 'email has been sent to %s.', userName);
 *
 * To add custom formatters use the `exports.flashFormatters` object.
 *
 * @param {String} type
 * @param {String} msg
 * @return {Array|Object|Number}
 * @api public
 */
req.flash = function (type, msg) {
  if (this.session === undefined) {
    throw Error('req.flash() requires sessions');
  }
  var msgs = this.session.flash = this.session.flash || {};
  if (type && msg) {
    var i = 2,
      args = arguments,
      formatters = this.app.flashFormatters || {};
    formatters.__proto__ = flashFormatters;
    msg = miniMarkdown(msg);
    msg = msg.replace(/%([a-zA-Z])/g, function (_, format) {
      var formatter = formatters[format];
      if (formatter) {
        return formatter(utils.escape(args[i++]));
      }
    });
    return (msgs[type] = msgs[type] || []).push(msg);
  } else if (type) {
    var arr = msgs[type];
    delete msgs[type];
    return arr || [];
  } else {
    this.session.flash = {};
    return msgs;
  }
};

var sys;
try {
  sys = require('util');
}
catch (e) {
  sys = require('sys');
}

var rootpath = process.cwd() + '/',
  fs = require('fs'),
  express = require('express'),
  stylus = require('stylus'),
  colors = require('colors'),
  nodepath = require('path'),
  calipso = require(nodepath.join(rootpath, 'lib/calipso')),
  translate = require(nodepath.join(rootpath, 'i18n/translate')),
  logo = require(nodepath.join(rootpath, 'logo')),
  everyauth = require('everyauth');

// To enable everyauth debugging.
//everyauth.debug = true;

everyauth.everymodule
  .findUserById(function (req, id, callback) {
    var User = calipso.db.model('User');
    User.findById(id, callback);
  });

function calipsoFindOrCreateUser(user, sess, promise) {
  var User = calipso.db.model('User');

  function finishUser(user) {
    if (sess) {
      if (!sess._pending) {
        return promise.fulfill(user);
      }
      var req = sess._pending;
      delete sess._pending;
      return calipso.lib.user.createUserSession(req, null, user, function (err) {
        if (err) {
          calipso.error("Error saving session: " + err);
          return promise.fail(err);
        }
        promise.fulfill(user);
      });
    } else {
      promise.fulfill(user);
    }
  }

  User.findOne({username:user.username}, function (err, u) {
    if (err) {
      return promise.fail(err);
    }
    if (u) {
      return finishUser(u);
    }
    u = new User({
      username:user.username,
      fullname:user.name,
      email:user.email,
      hash:'external:auth'
    });
    u.roles = ['Guest']; // Todo - need to make sure guest role can't be deleted?

    calipso.e.pre_emit('USER_CREATE', u);

    u.save(function (err) {
      if (err) {
        return promise.fail(err);
      }
      calipso.e.post_emit('USER_CREATE', u);
      // If not already redirecting, then redirect
      finishUser(u);
      return null;
    });
  });
  return promise;
}

// Local App Variables
var path = rootpath,
  theme = 'default',
  port = (process.env.PORT && parseInt(process.env.PORT)) || 3000;

/**
 * Catch All exception handler
 */
//process.on('uncaughtException', function (err) {
//  console.log('Uncaught exception: ' + err + err.stack);
//});

/**
 *  App settings and middleware
 *  Any of these can be added into the by environment configuration files to
 *  enable modification by env.
 */
function bootApplication(cluster, next) {

  // Create our express instance, export for later reference
  var app = express();
  app.path = function () {
    return path
  };
  app.isCluster = cluster;

  // Load configuration
  var Config = calipso.configuration; //require(path + "/lib/core/Config").Config;
  app.config = new Config();
  app.config.init(function (err) {

    if (err) {
      return console.error(err.message);
    }

    // Default Theme
    calipso.defaultTheme = app.config.get('theme:default');

    app.use(express.bodyParser());
    // Pause requests if they were not parsed to allow PUT and POST with custom mime types
    app.use(function (req, res, next) {
      if (!req._body) {
        req.pause();
      }
      next();
    });
    app.use(express.methodOverride());
    app.use(express.cookieParser(app.config.get('session:secret')));
    app.use(express.responseTime());

    // Create dummy session middleware - tag it so we can later replace
    var temporarySession = app.config.get('installed') ? {} : express.session({ secret:"installing calipso is great fun" });
    temporarySession.tag = "session";
    app.use(temporarySession);

    // Create holders for theme dependent middleware
    // These are here because they need to be in the connect stack before the calipso router
    // THese helpers are re-used when theme switching.
    app.mwHelpers = {};

    calipso.auth = {
      password:app.config.get('server:authentication:password'),
      migrate2pbkdf2:app.config.get('server:authentication:migrate2pbkdf2')
    };
    if (calipso.auth.password === undefined) {
      app.config.set('server:authentication:password', true);
      calipso.auth.password = true;
    }
    if (calipso.auth.migrate2pbkdf2 === undefined) {
      app.config.set('server:authentication:migrate2pbkdf2', false);
      calipso.auth.migrate2pbkdf2 = false;
    }

    var appId = app.config.get('server:authentication:facebookAppId');
    var appSecret = app.config.get('server:authentication:facebookAppSecret');
    if (appId && appSecret) {
      calipso.auth.facebook = true;
      everyauth
        .facebook
        .myHostname(app.config.get('server:url'))
        .getSession(function (req) {
          if (!req.session) {
            req.session = { _pending:req };
          } else {
            req.session._pending = req;
          }
          return req.session;
        })
        .appId(appId)
        .appSecret(appSecret)
        .findOrCreateUser(function (sess, accessToken, accessTokenExtra, fbUserMetadata) {
          var promise = this.Promise();

          return calipsoFindOrCreateUser({username:'facebook:' + fbUserMetadata.username,
            email:fbUserMetadata.username + '@facebook.com', name:fbUserMetadata.name}, sess, promise);
        })
        .redirectPath('/');
    }

    var consumerKey = app.config.get('server:authentication:twitterConsumerKey');
    var consumerSecret = app.config.get('server:authentication:twitterConsumerSecret');
    if (consumerKey && consumerSecret) {
      calipso.auth.twitter = true;
      everyauth
        .twitter
        .getSession(function (req) {
          if (!req.session) {
            req.session = { _pending:req };
          } else {
            req.session._pending = req;
          }
          return req.session;
        })
        .myHostname(app.config.get('server:url'))
        .apiHost('https://api.twitter.com/1')
        .consumerKey(consumerKey)
        .consumerSecret(consumerSecret)
        .findOrCreateUser(function (sess, accessToken, accessSecret, twitUser) {
          var promise = this.Promise();

          return calipsoFindOrCreateUser({username:'twitter:' + twitUser.screen_name,
            email:twitUser.screen_name + '@twitter.com', name:twitUser.name}, sess, promise);
        })
        .redirectPath('/');
    }

    var clientId = app.config.get('server:authentication:googleClientId');
    var clientSecret = app.config.get('server:authentication:googleClientSecret');
    if (clientId && clientSecret) {
      calipso.auth.google = true;
      everyauth
        .google
        .myHostname(app.config.get('server:url'))
        .appId(clientId)
        .appSecret(clientSecret)
        .scope('https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')
        .getSession(function (req) {
          if (!req.session) {
            req.session = { _pending:req };
          } else {
            req.session._pending = req;
          }
          return req.session;
        })
        .findOrCreateUser(function (sess, accessToken, extra, googleUser) {
          googleUser.refreshToken = extra.refresh_token;
          googleUser.expiresIn = extra.expires_in;

          var promise = this.Promise();

          return calipsoFindOrCreateUser({username:'google:' + googleUser.email,
            email:googleUser.email, name:googleUser.name}, sess, promise);
        })
        .redirectPath('/');
    }

    app.use(everyauth.middleware());

    // Load placeholder, replaced later
    if (app.config.get('libraries:stylus:enable')) {
      app.mwHelpers.stylusMiddleware = function (themePath) {
        var mw = stylus.middleware({
          src:themePath + '/stylus',
          dest:themePath + '/public',
          debug:false,
          compile:function (str, path) { // optional, but recommended
            return stylus(str)
              .set('filename', path)
              .set('warn', app.config.get('libraries:stylus:warn'))
              .set('compress', app.config.get('libraries:stylus:compress'));
          }
        });
        mw.tag = 'theme.stylus';
        return mw;
      };
      app.use(app.mwHelpers.stylusMiddleware(''));
    }

    // Static
    app.mwHelpers.staticMiddleware = function (themePath) {
      var mw = express["static"](themePath + '/public', {maxAge:86400000});
      mw.tag = 'theme.static';
      return mw;
    };
    // Load placeholder, replaced later
    app.use(app.mwHelpers.staticMiddleware(''));

    // Core static paths
    app.use(express["static"](path + '/media', {maxAge:86400000}));
    app.use(express["static"](path + '/lib/client/js', {maxAge:86400000}));

    // Translation - after static, set to add mode if appropriate
    app.use(translate.translate(app.config.get('i18n:language'), app.config.get('i18n:languages'), app.config.get('i18n:additive')));

    // Core calipso router
    calipso.init(app, function () {
      // Add the calipso mw
      app.use(calipso.routingFn());

      // return our app refrerence
      next(app);

    })

  });

}

/**
 * Initial bootstrapping
 */
exports.boot = function (cluster, next) {

  // Bootstrap application
  bootApplication(cluster, next);

};

// allow normal node loading if appropriate
// e.g. not called from app-cluster or bin/calipso
if (!module.parent) {

  logo.print();

  exports.boot(false, function (app) {

    if (app) {
      var out = app.listen(port, function () {
        console.log("Calipso version: ".green + app.about.version);
        console.log("Calipso configured for: ".green + (global.process.env.NODE_ENV || 'development') + " environment.".green);
        if (app.address) {
          console.log("Calipso server listening on port: ".green + app.address().port);
        } else {
          console.log("Calipso server listening on port: ".green + port);
        }
      });
      process.nextTick(function () {
        if (out && out.address && out.address().port !== port) {
          console.log("Calipso server listening on port: ".red + out.address().port);
        }
      });
    } else {
      console.log("\r\nCalipso terminated ...\r\n".grey);
      process.exit();
    }

  });

}
