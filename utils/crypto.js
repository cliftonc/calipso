var triedbcrypt = false, bcrypt, crypto = require("crypto"),
  calipso = require('../lib/calipso');

/**
 * Export simple encrypt / decrypt functions
 */
module.exports = exports = {
  check:check,
  hash:hash,
  decrypt:decrypt,
  encrypt:encrypt,
  etag:etag
}

/**
 * Create the salt
 * Unsure why this can be here, and does not need to be stored.
 * TODO - Figure out how this works
 */
var globalSalt = null;

function loadBCrypt() {
  if (!bcrypt && !triedbcrypt) {
    triedbcrypt = true;
    try {
      bcrypt = require("bcrypt");
      globalSalt = bcrypt.genSaltSync(10);
      calipso.silly('NOTE: bcrypt is available.');
    }
    catch (e) {
      calipso.debug('NOTE: bcrypt is not available.');
    }
  }
}

var iterations = 64000;
var keylength = 64;

/**
 * Check if a string is valid against a hash
 */
function check(string, hash, cb) {
  loadBCrypt();
  if (bcrypt && hash.indexOf(':') === -1) {
    return cb(null, bcrypt.compareSync(string, hash));
  }
  var items = hash.split(':');
  if (items.length > 2) {
    items = [items[2], items[3]];
  }
  crypto.pbkdf2(string, new Buffer(items[0], 'base64'), iterations, keylength, function (err, derivedKey) {
    if (err) {
      return cb(err);
    }
    var ok = new Buffer(derivedKey).toString('base64') === items[1];
    cb(err, ok);
  });
}

/**
 * Create a hash from string and key / salt
 */
function hash(string, key, cb) {
  loadBCrypt();
  if (bcrypt && !calipso.auth.migrate2pbkdf2) {
    return cb(null, bcrypt.hashSync(string, globalSalt));
  }
  var salt = new Buffer(key);
  var items = [salt.toString('base64'), null];
  crypto.pbkdf2(string, salt, iterations, keylength, function (err, derivedKey) {
    if (err) {
      return cb(err);
    }
    items[1] = new Buffer(derivedKey).toString('base64');
    cb(err, items.join(':'));
  });

}

/**
 * Decrypt a string
 */
function decrypt(string, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key)
  var dec = decipher.update(string, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec;
}

/**
 * Encrypt a string
 */
function encrypt(string, key) {
  var cipher = crypto.createCipher('aes-256-cbc', key)
  var crypted = cipher.update(string, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted;
}

/**
 * Create an simple hash etag based on a string of data
 */
function etag(string) {
  var shasum = crypto.createHash('md5');
  shasum.update(string);
  var etag = shasum.digest('hex');
  return etag;
}
