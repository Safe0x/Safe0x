const ipfsAPI = require('ipfs-api')
const fs = require('fs')

// TODO: Error handling should be done properly.
// TODO: Check the anti-pattern implementation of promises, and implement a fix/workaround for it.
// TODO: Check the possibility of using https://nodejs.org/api/util.html#util_util_promisify_original
// TODO: Handle promises rejects properly.
// TODO: Convert sync functions calls to async based calls.

const ipfs = ipfsAPI('localhost', '5001') // TODO: Move to a config file.

const transferDir = '/web/tmp'
const transferFile = 'content'

async function storeFile(filename, content) {
  const filePath = getTransferFilePath(transferFile)
  createTransferFile(filePath, content)

  const files = [
    {
      path: transferFile,
      content: fs.readFileSync(filePath)
    }
  ]

  return new Promise(function(resolve, reject) {
    ipfs.files.add(
      files,
      storeFileCallback(filePath, reject, resolve)
    )
  })
}

function storeFileCallback(filePath, reject, resolve) {
  return async function(err, files) {
    if (err) {
      console.error(err)
      return reject(err)
    }
  
    console.log('File store complete:', files[0].path)
    deleteTransferFile(filePath)
    await pinFile(files[0].hash)

    return resolve(files[0].hash)
  }
}

async function downloadFile(cid) {
   const downloadFilePath = getTransferFilePath(transferFile)

  return new Promise(function(resolve, reject) {
    ipfs.files.get(cid, downloadFileCallback(cid, downloadFilePath, reject, resolve))
  })
}

function downloadFileCallback(cid, downloadFilePath, reject, resolve) {
  return function(err, files) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    console.log('File download complete')
    unpinFile(cid)

    return resolve(files[0].content.toString('utf8'))
  }
}

function pinFile(cid) {
  return new Promise(function(resolve, reject) {
    ipfs.pin.add(cid, pinFileCallback(reject, resolve))
  })
}

function pinFileCallback(reject, resolve) {
  return function(err) {
    if (err) {
      console.error(err)
      return reject(err)
    }

    return resolve(true)
  }
}

function unpinFile(cid) {
  ipfs.pin.rm(cid, function (err, pinset) {
    if (err) {
      throw err
    }
  })
}

function getTransferFilePath(file) {
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

module.exports = {
  "storeFile": storeFile,
  "downloadFile": downloadFile
}
