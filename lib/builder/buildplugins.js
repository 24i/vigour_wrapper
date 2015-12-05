'use strict'

var log = require('npmlog')
var path = require('path')
var Promise = require('promise')
var fs = require('vigour-fs-promised')

module.exports = exports = function () {
  var self = this
  log.info('- building plugins -')
  var plugins = []
  for (var plugin in this.plugins) {
    plugins.push(this.plugins[plugin])
  }
  return Promise.all(plugins.map(function (entry) {
    var buildFilePath = path.join(entry.rootPath, 'buildPlugin.js')
    return fs.existsAsync(buildFilePath)
      .then(function (exists) {
        if (exists) {
          var buildPlugin = require(buildFilePath)
          return buildPlugin.start.call(self)
        }
      })
  }))
}
