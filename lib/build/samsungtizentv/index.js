var fs = require('vigour-fs')
var rimraf = require('rimraf')
var path = require('path')
var Promise = require('promise')
var nativeUtil = require('../../util')
var log = require('npmlog')
var imgServer = require('vigour-img')
var _mkdir = Promise.denodeify(fs.mkdirp)
var _rimraf = Promise.denodeify(rimraf)

module.exports = exports = function (opts, shared) {
  log.info('------ Building Samsung TIZEN TV ------')
  return Promise.resolve(opts)
    .then(configure)
    .then(clean)
    .then(createStructure)
    .then(copyJsBuild)
    .then(buildConfigXml)
    .then(checkIconsPath)
    .then(function () {
      log.info('__FINISHED__')
      return true
    })
    .catch(shared.handleErrors('samsungtizentv'))
}

function configure (opts) {
  log.info("Starting build for samsung TIZEN TV")
  var options = opts.vigour.native.platforms.samsungtizentv
  options.root = opts.vigour.native.root
  options.templateSrc = path.join(__dirname, '..', '..', '..', 'templates', 'samsungtizentv')
  options.buildDir = path.join(options.root, 'build', 'samsungtizentv', 'samsung')
  options.packer = opts.vigour.packer
  options.main = options.main || path.join(options.root, 'build.js')
  options.mainHtml = options.mainHtml || path.join(options.root, 'build.html')
  return (options)
}

function clean (opts) {
  log.info('- clean samsung TIZEN TV build dir -')
  return _rimraf(opts.buildDir)
    .then(function () {
      return opts
    })
}

function createStructure (opts) {
  log.info('- creating folder structure for samsung TIZEN TV-')
  return _mkdir(opts.buildDir)
    .then(function () {
      _mkdir(opts.buildDir + '/icons')
    }).then(function () {
      return opts
    })
}

function copyJsBuild (opts) {
  log.info('- creating the js for samsung TV-')
  return new Promise(function (resolve, reject) {
    var file = fs.createReadStream(opts.main).pipe(fs.createWriteStream(opts.buildDir + '/build.js'))
    file.on('close', function () {
      resolve(opts)
    })
  })
}

function buildConfigXml (opts) {
  log.info('- creating config.xml for samsung TV-')
  return new Promise(function (resolve, reject) {
    nativeUtil.transform_template(opts.templateSrc + '/config.xml', opts.buildDir + '/config.xml', opts.xmlConfig)
    resolve(opts)
  })
}

function checkIconsPath (opts) {
  log.info('- Copying and resizing all the icons, It may take a while.. -')
  return new Promise(function (resolve, reject) {
    if (fs.existsSync(path.join(opts.root, opts.icon.ThumbIcon))) {
      var arr = []
      arr.push({
            src: path.join(opts.root, opts.icon.ThumbIcon),
            dst: opts.buildDir + '/icons/icon.png',
            width: 512,
            height: 423,
            outType: 'png'
          })
      imgServer({convertPath: 'forceUseOfRemote', manip: arr}).then(function () {
        resolve(opts)
      })
    }
  })
}
