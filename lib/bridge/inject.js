'use strict'

var bridge = require('./')
var nameSpace = require('../util/nameSpace')

module.exports = function (pkgName) {
  var pluginId = nameSpace(pkgName)
  return function (base) {
    console.error('registering plugin', pluginId)
    bridge.plugins[pluginId] = base
    base.set({
      define: {
        send (methodName, params, cb) {
          bridge.send(pluginId, methodName, params, cb)
        }
      }
    })
    if (bridge.nativeReadies[pluginId]) {
      bridge.ready(null, true, pluginId)
    }
  }
}
