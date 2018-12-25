const bip39 = require('bip39')
const mongoose = require('mongoose')
const request = require('request-promise')
const db = require('./db')
const ipfs = require('./ipfs')
const crypto = require('./crypto')

const recaptchaSiteVerifyUrl = 'https://www.google.com/recaptcha/api/siteverify'
const recaptchaSecretKey = '' // TODO: Move to a config file.

const schema = db.mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  }
})

const User = db.mongoose.model('User', schema)

// TODO: Check the anti-pattern implementation of promises, and implement a fix/workaround for it.
// TODO: Check the possibility of using https://nodejs.org/api/util.html#util_util_promisify_original
// TODO: Handle promises rejects properly.

function getUser(email) {
  return new Promise(function(resolve, reject) {
    User.findOne({ email: email }, function (err, user) {
      if (err) {
        console.error(err)
        return reject(err)
      }

      return resolve(user)
    })
  })
}

async function storeText(text, mnemonic) {
  text = prepareTextData(text)
  text = crypto.encrypt(text, mnemonic)

  return  await ipfs.storeFile(mnemonic, text)
}

async function getText(mnemonic, fileCid) {
  mnemonic = mnemonic.join(' ')
  let text = await ipfs.downloadFile(fileCid)
  if (!text) {
    throw new Error('Invalid 12 words.')
  }

  text = crypto.decrypt(text, mnemonic)
  if (!text) {
    throw new Error('Could not obtain safe text.')
  }

  text = JSON.parse(text)

  return text.asset
}

function addUser(email) {
  return new Promise(function(resolve, reject) {
    let user = new User({ email: email })
    user.save(function (err, user) {
      if (err) {
        console.error(err)
        return reject(err)
      }

      return resolve(user)
    })
  })
}

function generateMnemonic() {
  return bip39.generateMnemonic()
}

async function isCaptchaValid(response, ip) {
  let isValid = false

  if (response) {
    const queryString = '?secret=' + recaptchaSecretKey
      + '&response=' + response
      + '&remoteip=' + ip

    const verifyResult = await request.get(recaptchaSiteVerifyUrl + queryString)
    isValid = JSON.parse(verifyResult).success
  }

  return isValid
}

function prepareTextData(text) {
  var data = { asset: [] }
  for (var i = 0; i < text.length; i++) {
    if (text[i]) {
      data.asset[i] = text[i]
    }
  }

  if (!data) {
    throw new Error('No assets were provided')
  }

  return JSON.stringify(data)
}

module.exports = {
  "addUser": addUser,
  "getUser": getUser,
  "storeText": storeText,
  "getText": getText,
  "generateMnemonic": generateMnemonic,
  "isCaptchaValid": isCaptchaValid
}
