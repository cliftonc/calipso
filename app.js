/**
 * Calipso, a NodeJS CMS
 *
 * This file is the core application launcher.  See app-cluster for visibility
 * of how the application should be run in production mode
 *
 * Usage:  node app, or NODE_ENV=production node app
 *
 */

var calipso, rootpath = process.cwd() + '/', path = require('path');

var http = require('http');
// Prevent outdated connect patch.
http.OutgoingMessage.prototype._hasConnectPatch = true;

calipso = require('./lib/calipso');
if (calipso.wrapRequire) { require = calipso.wrapRequire(module); }
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

var fs = require('fs'),
  nodepath = require('path'),
  translate, logo,
  colors = require('colors'),
  express = require('express'),
  bodyParser = require('body-parser'),
  responseTime = require('response-time'),
  methodOverride = require('method-override'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),
  stylus = require('stylus'),
  colors = require('colors'),
  passport = require('passport'),
  GoogleStrategy = require('passport-google-openidconnect').Strategy,
  TwitterStrategy = require('passport-twitter').Strategy,
  FacebookStrategy = require('passport-facebook').Strategy,
  LocalStrategy = require('passport-local').Strategy,
  translate = require('./i18n/translate'),
  logo = require('./logo'),
  multiparty = require('multiparty');


function calipsoFindOrCreateUser(user, done) {
  var User = calipso.db.model('User');

  User.findOne({username:user.username}, function (err, u) {
    if (err) {
      return done(err);
    }
    if (u) {
      return done(null, u);
    }
    u = new User({
      username:user.username,
      fullname:user.fullname,
      email:user.email,
      hash:'external:auth'
    });
    u.roles = ['Guest']; // Todo - need to make sure guest role can't be deleted?

    calipso.e.pre_emit('USER_CREATE', u);

    u.save(function (err) {
      if (err) {
        return done(err);
      }
      calipso.e.post_emit('USER_CREATE', u);
      // If not already redirecting, then redirect
      done(null, u);
      return null;
    });
  });
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

    // Pause requests if they were not parsed to allow PUT and POST with custom mime types
    app.use(function (req, res, next) {
      if (!req._body) {
        req.pause();
      }
      next();
    });
    app.use(methodOverride());
    app.use(bodyParser());
    app.use(function parseMultiPart(req, res, next) {
      var form = new multiparty.Form();
      form.parse(req, function (err, fields, files) {
        if (fields) {
          req.body = {};
          Object.keys(fields).forEach(function (k) {
            var vals = fields[k];
            if (vals.length == 1) {
              vals = vals[0];
            }
            var split = k.split(/\[|\]|\./);
            if (split.length == 1) {
              req.body[k] = vals;
            } else {
              split = split.filter(function (val) { return val; });
              out = req.body[split[0]];
              if (!out) {
                out = req.body[split[0]] = {};
              }
              k = split[split.length - 1];
              for (i = 1; i < (split.length - 1); i++) {
                k = split[i];
                out = out[k];
                if (!val) {
                  out = out[k] = {};
                }
                k = split[i + 1];
              }
              out[k] = vals;
            }
          });
        }
        if (files)
          req.files = files;
        next();
      });
    });
    app.use(cookieParser(app.config.get('session:secret')));
    app.use(responseTime());

    // Create dummy session middleware - tag it so we can later replace
    var temporarySession = app.config.get('installed') ? function (req, res, next) { next(); } : session({ secret:"installing calipso is great fun" });
    temporarySession.tag = "session";
    app.use(temporarySession);
    app.use(passport.initialize());
    app.use(passport.session());
    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });
    passport.deserializeUser(function(id, done) {
      var User = calipso.db.model('User');
      User.findById(id, function (err, user) {
        done(err, user);
      });
    });
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

    if (calipso.auth.password) {
      var strat = new LocalStrategy({
            usernameField: 'user[username]',
            passwordField: 'user[password]'
        },
        function(username, password, done) {
          var User = calipso.db.model('User');
          User.findOne({ username: username }, function (err, user) {
            if (err) { return done(err); }
            if (!user) {
              req.flash('error', req.t('You may have entered an incorrect username or password, please try again.  If you still cant login after a number of tries your account may be locked, please contact the site administrator.'));
              return done(null, false);
            }
            calipso.lib.crypto.check(password, user.hash, function (err, success) {
              if (err) { return done(err); }
              if (!success) {
                req.flash('error', req.t('You may have entered an incorrect username or password, please try again.  If you still cant login after a number of tries your account may be locked, please contact the site administrator.'));
              }
              done(err, success ? user : false);
            });
          });
        }
      );
      //var oldAuth = strat.authenticate;
      //strat.authenticate = function(req, options) {
      //  var body = {};
      //  body[this._usernameField] = req.body.user.username;
      //  body[this._passwordField] + "=" + encodeURIComponent(req.body.user.password);
      //  return oldAuth.call(this, req, options);
      //}
      passport.use(strat);

      app.post('/user/login', 
        passport.authenticate('local', {
          failureRedirect: '/user/login'
        }),
        function(req, res) {
          res.redirect('/');
        });
    }
    var appId = app.config.get('server:authentication:facebookAppId');
    var appSecret = app.config.get('server:authentication:facebookAppSecret');
    if (appId && appSecret) {
      calipso.auth.facebook = true;

      passport.use(new FacebookStrategy({
          clientID: appId,
          clientSecret: appSecret,
          callbackURL: app.config.get('server:url') + "/auth/facebook/callback"
        },
        function(accessToken, refreshToken, profile, done) {
          console.log(profile);
          calipsoFindOrCreateUser({
            username: 'facebook:' + profile.id,
            email: (profile.emails && profile.emails[0] && profile.emails[0].value) || 'unknown@faceboo.com',
            fullname: profile.displayName || 'unknown'
          }, done);
        }
      ));
      app.get('/auth/facebook',
        passport.authenticate('facebook'));

      app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
          successRedirect: '/',
          failureRedirect: '/login'
        }));
    }

    var consumerKey = app.config.get('server:authentication:twitterConsumerKey');
    var consumerSecret = app.config.get('server:authentication:twitterConsumerSecret');
    if (consumerKey && consumerSecret) {
      calipso.auth.twitter = true;

      passport.use(new TwitterStrategy({
          returnURL: app.config.get('server:url') + '/auth/twitter/callback',
          realm: app.config.get('server:url'),
          consumerKey: consumerKey,
          consumerSecret: consumerSecret
        },
        function(token, tokenSecret, profile, done) {
          console.log(profile);
          calipsoFindOrCreateUser({
            username: 'twitter:' + profile.id,
            email: (profile.emails && profile.emails[0] && profile.emails[0].value) || 'unknown@twitter.com',
            fullname: profile.displayName || 'unknown'
          }, done);
        }
      ));

      app.get('/auth/twitter',
        passport.authenticate('twitter-authz'));

      app.get('/auth/twitter/callback',
        passport.authenticate('twitter-authz', {
          successRedirect: '/',
          failureRedirect: '/login'
        }));
    }

    var clientId = app.config.get('server:authentication:googleClientId');
    var clientSecret = app.config.get('server:authentication:googleClientSecret');
    if (clientId && clientSecret) {
      passport.use(new GoogleStrategy({
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: app.config.get('server:url') + '/auth/google/callback'
        },
        function(iss, sub, profile, accessToken, refreshToken, done) {
          calipsoFindOrCreateUser({
            username: 'google:' + profile.id,
            email: profile._json.email,
            fullname: profile.displayName
          }, done);
        }
      ));
      calipso.auth.google = true;

      app.get('/auth/google',
        passport.authenticate('google-openidconnect', { scope: ['email', 'profile'] }));

      app.get('/auth/google/callback',
        passport.authenticate('google-openidconnect', {
          successRedirect: '/',
          failureRedirect: '/login'
        }));
    }

    // Load placeholder, replaced later
    if (app.config.get('libraries:stylus:enable')) {
      app.mwHelpers.stylusMiddleware = function (themePath) {
        var mw = stylus.middleware({
          src: themePath + '/stylus',
          dest: themePath + '/public',
          debug: false,
          compile: function (str, path) { // optional, but recommended
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
