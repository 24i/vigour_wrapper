'use strict'

var Config = require('vigour-js/lib/config')
var log = require('npmlog')
var Promise = require('promise')
var fs = require('vigour-fs/lib/server')
var path = require('path')
var Base = require('vigour-js/lib/base')
Base.prototype.inject(
  require('vigour-js/lib/methods/plain')
)
var readJSON = Promise.denodeify(fs.readJSON)

var builders = {
  web: './web',
  android: './android',
  ios: './ios',
  samsungtv: './samsungtv',
  netcasttv: './lgnetcasttv',
  webostv: './webostv',
  chromecastweb: './chromecastweb'
}

module.exports = exports = Builder

function Builder (config) {
  if (!(config instanceof Config)) {
    config = new Config(config)
  }
  this.config = config

  if (!this.config.native.root) {
    this.config.native.set({
      root: {
        val: process.cwd()
      }
    })
  }
}

Builder.prototype.start = function () {
  var self = this
  var pkgPath = path.join(this.config.native.root.val, 'package.json')
  return readJSON(pkgPath)
    .then(function (pkg) {
      var config = self.config.plain()
      config.vigour = {
        native: config.native
      }
      delete config.native
      var options = new Base(config)
      options.set(pkg)
      var platforms = options.vigour.native.platforms.plain()
      var selected = options.vigour.native.selectedPlatforms.plain()
      var customPlatform = (options.vigour.native.customPlatform)
        ? options.vigour.native.customPlatform.plain()
        : false
      var platform

      var pluginPkgPaths = []
      var pluginPkgPath
      for (var key in options.dependencies.plain()) {
        pluginPkgPath = path.join(options.vigour.native.root.val, 'node_modules', key, 'package.json')
        pluginPkgPaths.push(pluginPkgPath)
      }
      return Promise.all(pluginPkgPaths.map(function (pkgPath) {
        return readJSON(pkgPath)
          .then(function (pkg) {
            if (pkg.vigour && pkg.vigour.plugin) {
              pkg.vigour.plugin.name = pkg.name
              return pkg.vigour.plugin
            } else {
              return false
            }
          })
      }))
        .then(function (plugins) {
          var pluginsObj = {}
          plugins.map(function (entry) {
            if (entry) {
              pluginsObj[entry.name] = entry
              delete pluginsObj[entry.name].name
            }
          })
          options.vigour.native.set({
            plugins: pluginsObj
          })
          var promise = Promise.resolve()
          if (platforms) {
            for (platform in options.vigour.native.platforms.plain()) {
              if (platforms[platform] &&
                (!selected || ~selected.indexOf(platform)) &&
                builders[platform]) {
                promise = promise.then(builderFactory(platform, options.plain()))
              }
            }
            if (selected === 'custom' && customPlatform) {
              promise = promise.then(function () {
                return customPlatform(options.plain())
              })
            }
          } else {
            return log.error('No platforms to build. Check for native.platforms in your package.json')
          }
          return promise
        })
        .catch(function (reason) {
          log.error('oops', reason, reason.stack)
          throw reason
        })
    })
}

function builderFactory (platform, options) {
  return function () {
    var Plat = require(builders[platform])
    var plat = new Plat(options)
    return plat.build()
  }
}
