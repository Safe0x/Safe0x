const { Environment } = require('storj')
const fs = require('fs')
const bcrypt = require('bcrypt')

const saltRounds = 10
const bucketId = '' // TODO: Move to a config file.
const transferDir = '/web/tmp'

// TODO: Move Storj user access info to a config file.
const storj = new Environment({
  bridgeUrl: 'https://api.storj.io',
  bridgeUser: 'user',
  bridgePass: 'password',
  encryptionKey: '', // TODO: Replace hardcoded key with dynamically generated one.
  logLevel: 4
})

// TODO: Check the anti-pattern implementation of promises, and implement a fix/workaround for it.
// TODO: Check the possibility of using https://nodejs.org/api/util.html#util_util_promisify_original
// TODO: Handle promises rejects properly.
// TODO: Convert sync functions calls to async based calls.

async function storeFile(filename, content) {
  filename = await hashFilename(filename, true) + '.json'
  const filePath = getTransferFilePath(filename)

  createTransferFile(filePath, content)

  return new Promise(function(resolve, reject) {
    storj.storeFile(bucketId, filePath, {
      filename: filename,
      progressCallback: progressCallback,
      finishedCallback: storeFileCallback(filePath, reject, resolve)
    })
  })
}

function storeFileCallback(filePath, reject, resolve) {
  return function(err, fileId) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    console.log('File store complete:', fileId)
    deleteTransferFile(filePath)

    return resolve(fileId)
  }
}

async function downloadFile(filename) {
  const file = await getFileIdByName(filename)
  if (!file.id) {
    return file.id
  }

  const downloadFilePath = getTransferFilePath(file.id + '.json')

  createTransferDirectory()

  return new Promise(function(resolve, reject) {
    storj.resolveFile(bucketId, file.id, downloadFilePath, {
      progressCallback: progressCallback,
      finishedCallback: downloadFileCallback(file.id, downloadFilePath, reject, resolve)
    })
  })
}

function downloadFileCallback(fileId, downloadFilePath, reject, resolve) {
  return function(err) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    console.log('File download complete')

    const content = getTransferJson(downloadFilePath)
    deleteStorageFile(fileId)
    deleteTransferFile(downloadFilePath)

    return resolve(content)
  }
}

function deleteStorageFile(fileId) {
  storj.deleteFile(bucketId, fileId, deleteStorageFileCallback)
}

function deleteStorageFileCallback(err, result)
{
  if (err) {
    return console.error(err)
  }

  console.log('Result:', result)
}

function getFileIdByName(filename) {
  return new Promise(function(resolve, reject) {
    storj.listFiles(
      bucketId,
      getFileIdByNameCallback(filename, reject, resolve)
    )
  })
}

function getFileIdByNameCallback(filename, reject, resolve) {
  return async function(err, result) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    console.log('Result:', result)

    var file = { id: '' }
    var remoteFilename = ''
    var isFile = false

    for (var i = 0; i < result.length; i++) {
      remoteFilename = result[i].filename
      remoteFilename = remoteFilename.substr(0, remoteFilename.lastIndexOf('.'))
      remoteFilename = new Buffer(remoteFilename, 'base64').toString('ascii')

      isFile = await compareHash(filename, remoteFilename)

      if (isFile) {
        file.id = result[i].id
        break
      }
    }

    return resolve(file)
  }
}

function getTransferFilePath(file)
{
  return transferDir + '/' + file
}

function createTransferDirectory() {
  if (!fs.existsSync(transferDir)) {
    fs.mkdirSync(transferDir)
  }
}

function createTransferFile(file, content) {
  createTransferDirectory()
  fs.writeFileSync(file, content)
}

function deleteTransferFile(file) {
  fs.unlinkSync(file)
}

function getTransferJson(file) {
  return JSON.parse(
    fs.readFileSync(file, 'utf8')
  )
}

function progressCallback(progress, downloadedBytes, totalBytes) {
  console.log('progress:', progress)
}

function hashFilename(filename, toBase64 = false) {
  return new Promise(function(resolve, reject) {
    bcrypt.hash(
      filename,
      saltRounds,
      hashFilenameCallback(toBase64, reject, resolve)
    )
  })
}

function hashFilenameCallback(toBase64, reject, resolve) {
  return function(err, hash) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    if (toBase64) {
      hash = new Buffer(hash).toString('base64')
    }
    return resolve(hash)
  }
}

function compareHash(text, hash2) {
  return new Promise(function(resolve, reject) {
    bcrypt.compare(text, hash2, compareHashCallback(reject, resolve))
  })
}

function compareHashCallback(reject, resolve) {
  return function(err, res) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    return resolve(res)
  }
}

function destroy() {
  storj.destroy()
}

module.exports = {
  "storeFile": storeFile,
  "downloadFile": downloadFile,
  "destroy": destroy
}
