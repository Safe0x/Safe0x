const mongoose = require('mongoose')

// TODO: Move DB connection string content to a config file.
mongoose.connect(
  'mongodb://username:password@localhost/safe0x',
  { useMongoClient: true }
)

mongoose.Promise = global.Promise
const db = mongoose.connection

db.on(
  'error',
  console.error.bind(console, 'MongoDB connection error:')
)

module.exports = {
  "cxn": db,
  "mongoose": mongoose
}
