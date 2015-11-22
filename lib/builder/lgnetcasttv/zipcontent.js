'use strict'

var log = require('npmlog')
var nativeUtil = require('../../util')
var Promise = require('promise')

module.exports = exports = function () {
  var self = this
  log.info('- creating the Zip file for netcast TV-')
  return new Promise(function (resolve, reject) {
    console.log(self.buildDir,"------")
    nativeUtil.zip(self.buildDir, self.buildDir + '.zip', function (filesize) {
      resolve()
    })
  })
}
