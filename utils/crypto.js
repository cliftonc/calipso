var bcrypt = require("bcrypt"), crypto = require("crypto");

/**
 * Export simple encrypt / decrypt functions
 */
module.exports = exports = {
  check: check,
  hash: hash,
  decrypt: decrypt,
  encrypt: encrypt,
  etag: etag
}

/**
 * Create the salt
 * Unsure why this can be here, and does not need to be stored.
 * TODO - Figure out how this works
 */
var salt = bcrypt.gen_salt_sync(10);

/**
 * Check if a string is valid against a hash
 */
function check(string,hash) {
  return bcrypt.compare_sync(string, hash);
}

/**
 * Create a hash from string and key / salt
 */
function hash(string,key) {
  var hash = bcrypt.encrypt_sync(string,salt);
  return hash;
}

/**
 * Decrypt a string
 */
function decrypt(string,key) {
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(string,'hex','utf8')
  dec += decipher.final('utf8')
  return dec;
}

/**
 * Encrypt a string
 */
function encrypt(string,key) {
  var cipher = crypto.createCipher('aes-256-cbc',key)
  var crypted = cipher.update(string,'utf8','hex')
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
