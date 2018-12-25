const crypto = require('crypto')

// TODO: Encyption/Decryption code needs improvements.

const masterKey = '' // TODO: Set the value through a config file.
const nonce = crypto.randomBytes(16)

function encrypt(plaintext, key) {
  key += masterKey
  const keyHash = crypto.createHash('sha512').update(key, 'utf8').digest('hex').slice(0, 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, nonce)
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')

  ciphertext += cipher.final('base64')

  return ciphertext
}

function decrypt(ciphertext, key) {
  key += masterKey
  const keyHash = crypto.createHash('sha512').update(key, 'utf8').digest('hex').slice(0, 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, nonce)
  let receivedPlaintext = decipher.update(ciphertext, 'base64', 'utf8')

  try {
    receivedPlaintext += decipher.final('utf8')
    return receivedPlaintext
  } catch (err) {
    console.error('Authentication failed!')
  }

  return false
}

module.exports = {
  "encrypt": encrypt,
  "decrypt": decrypt
}
