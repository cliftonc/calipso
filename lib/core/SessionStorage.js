/**
 * Module dependencies.
 */

var Store = require('connect').session.Store,
    _ = require('underscore'),
    jugglingdb = require('jugglingdb');

/**
 * Initialize a new `JugglingStore`.
 *
 * @api public
 */

var JugglingStore = module.exports = function JugglingStore(dbType, dbConfig) {
  this.db = new jugglingdb.Schema(dbType, dbConfig);
  this.db.define('Session', {
    sid: String,
    data: String
  });
};

/**
 * Inherit from `Store.prototype`.
 */

JugglingStore.prototype.__proto__ = Store.prototype;

/**
 * Attempt to fetch session by the given `sid`.
 *
 * @param {String} sid
 * @param {Function} fn
 * @api public
 */

JugglingStore.prototype.get = function(sid, fn){
  var self = this;
  process.nextTick(function(){

    var Session = self.db.models.Session;

    Session.findOne({where:{sid:sid}}, function (err, sess) {
      var expires;
      if (!err && sess && sess.data) {
        var sessData = JSON.parse(sess.data);
        expires = 'string' == typeof sessData.cookie.expires
          ? new Date(sessData.cookie.expires)
          : sessData.cookie.expires;
        if (!expires || new Date < expires) {
          fn(null, sessData);
        } else {
          sess.destroy(fn);
        }
      } else {
        fn();
      }
    })
  });
};

/**
 * Commit the given `sess` object associated with the given `sid`.
 *
 * @param {String} sid
 * @param {Session} sess
 * @param {Function} fn
 * @api public
 */

JugglingStore.prototype.set = function(sid, sess, fn){
  var self = this;
  process.nextTick(function(){
    var Session = self.db.models.Session;
    Session.findOne({where:{sid:sid}}, function(err, session) {
      if(err) {
        fn(err);
        return;
      }
      if(!session) session = new Session({sid:sid, data:'{}'});

      var sessData = JSON.parse(session.data) || {};
      _.extend(sessData, sess);
      session.data = JSON.stringify(sessData);

      session.save(fn);
    })
  });
};

/**
 * Destroy the session associated with the given `sid`.
 *
 * @param {String} sid
 * @api public
 */

JugglingStore.prototype.destroy = function(sid, fn){
  var self = this;
  process.nextTick(function(){
    self.db.models.Session.findOne({where:{sid:sid}}, function(err, sess) {
      if(err) fn(err);
      if(sess) sess.destroy(fn);
      else fn();
    })
  });
};

/**
 * Invoke the given callback `fn` with all active sessions.
 *
 * @param {Function} fn
 * @api public
 */

JugglingStore.prototype.all = function(fn){
  var arr = []
  this.db.models.Session.all({},function(err, sessions) {
    if (err) fn(err);
    for(sess in sessions) {
      arr.push(sess.sid);
    }
    fn(null, arr);
  });
};

/**
 * Clear all sessions.
 *
 * @param {Function} fn
 * @api public
 */

JugglingStore.prototype.clear = function(fn){
  this.db.models.Session.destroyAll(fn||function() {});
};

/**
 * Fetch number of sessions.
 *
 * @param {Function} fn
 * @api public
 */

JugglingStore.prototype.length = function(fn){
  this.db.models.Session.count({}, fn||function() {});
};