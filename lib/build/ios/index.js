var fs = require('vigour-fs')
var rimraf = require('rimraf')
var path = require('path')
var ncp = require('ncp')
var Promise = require('promise')
var xcode = require('xcode')
var plist = require('plist')
var browserify = require('browserify')
var concat = require('concat-stream')
var log = require('npmlog')
var mkdirp = Promise.denodeify(fs.mkdirp)
var _ncp = Promise.denodeify(ncp)
var _rimraf = Promise.denodeify(rimraf)
var readFile = Promise.denodeify(fs.readFile)
var writeFile = Promise.denodeify(fs.writeFile)
var http = require('http')
var readJSON = Promise.denodeify(fs.readJSON)
var writeJSON = Promise.denodeify(fs.writeJSON)
var stat = Promise.denodeify(fs.stat)
var _ = require('lodash')

module.exports = exports = function (opts, shared) {
  log.info('- start ios build -')
  // log.info("OPTIONS", JSON.stringify(opts, null, 2))
  return Promise.resolve(opts)
    .then(configure)
    .then(clean)
    .then(prepare)
    .then(configureTemplate)
    .then(modifyPlist)
    .then(nativeAssets)
    .then(shared.copyAssets)
    .then(addBridge)
    .then(function () {
      log.info('__FINISHED__')
      return true
    })
    .catch(shared.handleErrors('ios'))
}

function configure (opts) {
  log.info('- configure ios build paths -')
  var options = opts.vigour.native.platforms.ios
  options.root = opts.vigour.native.root
  options.templateSrc = path.join(__dirname, '..', '..', '..', 'templates', 'ios')
  options.buildDir = path.join(options.root, 'build', 'ios')
  options.wwwDst = path.join(options.buildDir, 'vigour-native', 'www')
  options.plugins = opts.vigour.native.plugins
  options.packer = opts.vigour.packer
  return options
}

function clean (opts) {
  log.info('- clean ios build dir -')
  return _rimraf(opts.buildDir)
    .then(function () {
      return opts
    })
}

function prepare (opts) {
  log.info('- prepare ios template -')
  return mkdirp(opts.buildDir)
    .then(function () {
      return _ncp(opts.templateSrc
          , opts.buildDir
          , { clobber: true })
    })
		.then(function () { //clean out www
			return _rimraf(opts.wwwDst)
		})
		.then(function () {
			return mkdirp(opts.wwwDst)
		})
    .then(function () {
      return opts
    })
}

/**
    configure the template xcode project
  */
function configureTemplate (opts) {
  log.info('- configure template -')
  opts.projectPath = path.join(opts.buildDir, 'vigour-native/vigour-native.xcodeproj/project.pbxproj')
  var templateProj = xcode.project(opts.projectPath)

  return new Promise(function (resolve, reject) {
    templateProj.parse(function (err) {
      if (err) {
        reject(err)
      } else {
        // templateProj.addHeaderFile('foo.h');
        // templateProj.addSourceFile('foo.m');
        // templateProj.addFramework('FooKit.framework');

        // templateProj.addResourceFile()

        // if(opts.productName) {
        //   templateProj.updateProductName(replaceSpacesWithDashes(opts.productName))
        // }

        // add framework stuff.. plugins etc.

        fs.writeFileSync(opts.projectPath, templateProj.writeSync())
        resolve(opts)
      }
    })
  })
}

/**
      Helpers
 **/

// function replaceSpacesWithDashes (/*String*/ str) {
//   return str.replace(/\s+/g, '-').toLowerCase()
// }

/**
    override default plist settings
 **/
function modifyPlist (opts) {
  log.info('- configure project -')
  opts.plistPath = path.join(opts.buildDir, 'vigour-native/vigour-native/Info.plist')
  opts.plistObject = plist.parse(fs.readFileSync(opts.plistPath, 'utf8'))

  // var versionNumber = parseInt(plistObject["CFBundleVersion"])
  // plistObject["CFBundleVersion"] = '' + ++versionNumber

  if (opts.organizationIdentifier) {
    opts.plistObject.CFBundleIdentifier = opts.organizationIdentifier
  }

  if (opts.buildNumber) {
    opts.plistObject.CFBundleVersion = opts.buildNumber
  }

  if (opts.productName) {
    opts.plistObject.CFBundleName = opts.productName
  }

  if (opts.appUrlIdentifier && opts.appUrlScheme) {
    opts.plistObject.CFBundleURLTypes = []
    var urlScheme = {
      CFBundleTypeRole: 'Editor',
      CFBundleURLName: opts.appUrlIdentifier,
      CFBundleURLSchemes: [opts.appUrlScheme]
    }
    opts.plistObject.CFBundleURLTypes.push(urlScheme)
  }

  if (opts.appIndexPath) {
    opts.plistObject.appIndexPath = opts.appIndexPath
  } else {
    throw new Error('platforms.ios.appIndexPath should be provided!')
  }

  fs.writeFileSync(opts.plistPath, plist.build(opts.plistObject))
  return opts
}

function nativeAssets (opts) {
  log.info('- adding native assets using service -')

  var xcodeAssetsPath = path.join(opts.buildDir, 'vigour-native/vigour-native/Images.xcassets')
  var assetPromises = []
  var outputPath
  var tpl
	
  // splash LaunchImage.launchimage
  if (opts.splashScreen) {
    tpl = path.join(__dirname, '..', '..', '..', 'lib', 'build', 'ios', 'launchImgTpl.json')
    outputPath = path.join(xcodeAssetsPath, 'LaunchImage.launchimage')
    assetPromises[assetPromises.length] = createAsset(opts, opts.splashScreen, tpl, outputPath, 'splash')
  }

  // app icon AppIcon.appiconset
  if (opts.appIcon) {
    tpl = path.join(__dirname, '..', '..', '..', 'lib', 'build', 'ios', 'appIconTpl.json')
    outputPath = path.join(xcodeAssetsPath, 'AppIcon.appiconset')
    assetPromises[assetPromises.length] = createAsset(opts, opts.appIcon, tpl, outputPath, 'icon')
  }

  return Promise.all(assetPromises).then(function (data) {
    log.info('Assets done')
    return opts
  }).catch(function (e) {
    log.error(e)
  })

}

// -----------------------------------//
function createAsset (opts, assetPath, tplPath, outputPath, fileName) {
// -----------------------------------//

  return new Promise(function (resolve, reject) {

    var splashScreen = path.join(opts.root, assetPath)

    var contentsFileContent = {}

    return mkdirp(outputPath).then(function () {

      return readJSON(tplPath).then(function (contentsObj) {

        contentsFileContent = contentsObj

        var imageDimensions = _.pluck(contentsFileContent.images, 'filename')
        var fileNames = []
        var l = imageDimensions.length
        while (l--) {
          fileNames[l] = fileName + '-' + (l + 1) + '.png'
        }

        var data = {}
        data.images = _.zipObject(imageDimensions, fileNames)
        data.splashScreen = splashScreen
        data.outputPath = outputPath
        var paths = createImages(data)

        return Promise.all(paths).then(function (fileData) {
          _.forEach(fileData, function (val, key) {
            var k = _.keys(val)[0]
            var index = _.findIndex(contentsFileContent.images, 'filename', k)
            contentsFileContent.images[index]['filename'] = val[k]
          })

          return data
        })

      }).then(function (Obj) {
        var contentsPath = path.join(outputPath, 'Contents.json')
        return writeJSON(contentsPath, contentsFileContent)
          .then(function () {
            resolve()
          })
      })
    })

  })

}

function createImages (/* obj */ data) {

  if (!data.splashScreen && !data.images) return

  var paths = _.keys(data.images)

  return paths.map(function (path) {

    return stat(data.splashScreen)
        .then(function (stats) {

          return new Promise(function (resolve, reject) {

            var rs = fs.createReadStream(data.splashScreen)

            try {
              var req = http.request(
                  { path: path,
                  method: 'POST',
                    host: 'img.vigour.io',
                    headers:
                      { 'Content-Length': stats.size,
                        'Content-Type': 'image/jpeg'
                      }
                  }
              , function (res) {
                  res.on('error', function (err) {
                    reject(err)
                    console.error('err', err, err.stack)
                  })
                  if (res.statusCode === 200) {
                    var out = data.outputPath + '/' + data.images[path]
                    var ws = fs.createWriteStream(out)
                    res.pipe(ws)
                    res.on('error', function (err) {
                      log.error(err)
                      reject(err)
                    })
                    res.on('end', function () {
                      var val = data.images[path]
                      var obj = {}
                      obj[path] = val
                      resolve(obj)
                    })
                  }
                })
            } catch (e) {
              log.error('e1: ', e)
              reject(e)
            }

            req.on('error', function (err) {
              log.error('e2', err)
              reject(err)
            })

            rs.pipe(req).on('error', function (err) {
              log.error('e3', err)
              reject(err)
            })

          })
        })
  })
}

function addBridge (opts) {
  log.info('- adding bridge -')
  var bridgePath = path.join(__dirname, '..', '..', 'bridge', 'ios', 'index.js')
  var htmlPath = path.join(opts.wwwDst, opts.appIndexPath)
  var bro = browserify()
  var _html
  return readHtml()
    .then(buildBridge)
    .then(writeHtml)
    .then(function () {
      return opts
    })

  function readHtml () {
    return readFile(htmlPath, 'utf8')
      .then(function (html) {
        _html = html
      })
  }
  function buildBridge () {
    return new Promise(function (resolve, reject) {
      var out = concat('string', function (data) {
        resolve(data)
      })
      bro.add(bridgePath)
      bro.bundle().pipe(out)
      bro.on('error', reject)
    })
  }
  function writeHtml (bridgeCode) {
    var newHtml = _html.replace('<head>', "<head><script type='text/javascript'>" + bridgeCode + '</script>', 'i')
    return writeFile(htmlPath, newHtml, 'utf8')
  }
}
