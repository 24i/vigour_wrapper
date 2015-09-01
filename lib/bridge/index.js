var set = require('lodash/object/set')
var env = require('../env')

var platform
switch (env.platform) {
  case 'ios':
    platform = require('./ios')
    break
  case 'android':
    platform = require('./android')
    break
  default:
    platform = false
    break
}
var unsupportedPlatformError = new Error('Unsupported platform')
unsupportedPlatformError.info = {
  platform: env.platform
}

var callbackMap = {}
var callbackId = 0

module.exports = exports = {}

/**
  opts is optional
  call if wrapped in try, so try not needed on caller side
*/
exports.send = function (pluginId, fnName, opts, cb) {
  if (platform) {
    if (!cb) {
      cb = opts
      opts = null
    }

    var cbId = callbackId
    callbackId += 1 // TODO Prevent reaching max int
    callbackMap[cbId] = cb

    try {
      platform.send(pluginId,
        fnName,
        opts,
        cbId,
        function (err) {
          cb(err)
          delete callbackMap[cbId]
        })
    } catch (e) {
      cb(e)
    }
  } else {
    cb(unsupportedPlatformError)
  }
}

exports.receive = function (cbId, err, response) {
  callbackMap[cbId](err, response)
  delete callbackMap[cbId]
}

set(window, 'vigour.native.bridgeResult', exports.receive)
