var crypto = require("crypto");

/**
 * Export simple encrypt / decrypt functions
 */
module.exports = exports = {
  decrypt: decrypt,
  encrypt: encrypt
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
