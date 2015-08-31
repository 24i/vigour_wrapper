var log = require('npmlog')
var fs = require('vigour-fs')
var ncp = require('ncp')
var proc = require('child_process')
var spawn = proc.spawn
var readFile = fs.readFileSync
var path = require('path')
var Promise = require('promise')
var stat = Promise.denodeify(fs.stat)
var http = require('http')

// fns that return promises
var _mkdir = Promise.denodeify(fs.mkdirp)
var _ncp = Promise.denodeify(ncp)

function installTemplate (opts) {
  // if(!fs.existsSync('build/android')) {
  log.info('- copying android template -')

  log.info('  from', opts.templateSrc)
  log.info('  to', opts.buildDir)
  return _mkdir(opts.buildDir)
    .then(function () {
      // TODO fix ncp
      return _ncp(opts.templateSrc,
        opts.buildDir,
        { clobber: true,
          filter: createCopyFilter(opts.templateSrc, opts.buildDir)
        })
    })
    // NOTE there is a bug in ncp regarding the filter and it's internal reference counter
    // ncp calls the callback too early and then the rest of our script can fail
    // so we wait 100 millis
    .then(function () {
      log.info('start waiting')
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          log.info('done waiting')
          resolve()
        }, 100)
      })
    })
    .then(function () {
      log.info('copy done')
      return opts
    })
}
exports.installTemplate = installTemplate

function setAppIndex (opts) {
  if (opts.appIndexPath) {
    log.info('set app index to ', opts.appIndexPath)
    var filename = path.join(opts.srcDir, opts.mainJavaFile)
    var javaFile = fs.readFileSync(filename, {encoding: 'utf8'})
    javaFile = javaFile.replace('file:///android_asset/src/index.html',
      'file:///android_asset/' + opts.appIndexPath)
    fs.writeFileSync(filename, javaFile)
  }
  return Promise.resolve(opts)
}
exports.setAppIndex = setAppIndex

function installApk (opts) {
  log.info('start install')
  return exe(opts.adbPath + ' install -r ' + opts.apkName, opts.outputDir)
    .then(function () {
      return opts
    })
}
exports.installApk = installApk

function runOnDevice (opts) {
  log.info('start run')
  return exe(opts.adbPath + ' shell monkey -p ' + opts.applicationId + ' 1',
    opts.root)
    .then(function () {
      return opts
    })
}
exports.runOnDevice = runOnDevice

function optionalRun (opts) {
  if (!opts.run) {
    return opts
  }

  return Promise.resolve(opts)
    .then(installApk)
    .then(runOnDevice)
}
exports.optionalRun = optionalRun

function installPlugins (opts) {
  var pluginPath
  var pluginInfoList = []

  function Template () {
    this.filename =
      this.contents = []
    this.currentLine = 0
  }

  Template.prototype.readFile = function (filename) {
    this.filename = filename
    this.contents = fs.readFileSync(filename, {encoding: 'utf8'}).split('\n')
    this.currentLine = 0
  }

  Template.prototype.save = function () {
    log.info('save to', this.filename)
    fs.writeFileSync(this.filename, this.contents.join('\n'))
  }

  /** set the currentLine directly after the first occurence of pattern. */
  Template.prototype.goto = function (pattern) {
    for (var i = 0; i < this.contents.length; i++) {
      if (this.contents[i].match(pattern)) {
        this.currentLine = i + 1
      }
    }
  }

  Template.prototype.insertLine = function (line) {
    this.contents.splice(this.currentLine, 0, line)
    this.currentLine++
  }

  Template.prototype.commentLine = function (line) {
    this.contents[this.currentLine] = '//' + this.contents[this.currentLine]
    this.currentLine++
  }

  Template.prototype.log = function () {
    log.info('logging:')
    log.info(this.contents.join('\n'))
  }

  function retrievePluginInfo (pluginPath) {
    return new Promise(function (resolve, reject) {
      // log.info("  retrievePluginInfo")
      var packageFile = readFile(path.join(pluginPath, 'package.json'))
      var opts = JSON.parse(packageFile)
      opts.plugin.name = opts.name
      opts = opts.plugin
      // log.info(opts)
      pluginInfoList.push(opts)
      resolve(opts)
    })
  }

  function buildAar (pluginOpts) {
    return new Promise(function (resolve, reject) {
      try {
        log.info('  build aar')
        var androidPath = path.join(opts.root, 'node_modules',
          pluginOpts.name, 'native', 'android')
        var filename = pluginOpts.id + '-debug'
        var output = path.join(androidPath, filename + '.aar')
        var script = path.join(androidPath, 'build.js')
        pluginOpts.aarFilename = filename
        pluginOpts.aarPath = output
        if ((!fs.existsSync(output) || opts.rebuildPlugins) &&
          fs.existsSync(script)) {
          exe(script, '')
            .then(function () {
              resolve(pluginOpts)
            })
            .catch(function (e) {
              reject(e)
            })
        } else {
          resolve(pluginOpts)
        }
      } catch(e) {
        reject(e)
      }
    })
  }

  function copyPluginAar (pluginOpts) {
    return new Promise(function (resolve, reject) {
      try {
        var dst = path.join(opts.aarDir, pluginOpts.aarFilename + '.aar')
        log.info('copy', pluginOpts.aarPath, ' --> ', dst)
        fs.writeFileSync(dst, fs.readFileSync(pluginOpts.aarPath))
        resolve(pluginOpts)
      } catch(e) {
        reject(e)
      }
    })
  }

  function installIntoTemplate () {
    return new Promise(function (resolve, reject) {
      log.info('  installIntoTemplate')
      var imports = []
      var instantiations = []
      var permissions = []

      // gather info
      pluginInfoList.forEach(function (info) {
        if (info.android.instantiation) {
          instantiations.push(info.android.instantiation)
        }
        if (info.android.className) {
          imports.push(info.android.className)
        }
        if (info.android.permission) {
          permissions.push(info.android.permission)
        }
      })

      // get the java file and inject instantiations
      log.info('  inject into java')
      var template = new Template()
      template.readFile(path.join(opts.srcDir, opts.mainJavaFile))
      template.goto(new RegExp('-- start plugin imports'))

      imports.forEach(function (s) {
        var line = 'import ' + s + ';'
        template.insertLine(line)
        log.info(line)
      })

      template.goto(new RegExp('private void registerPlugins'))
      instantiations.forEach(function (s) {
        var line = '        pluginManager.register(' + s + ');'
        template.insertLine(line)
        log.info(line)
      })
      template.save()
      // template.log()

      // get the Manifest and inject permissions
      // TODO implement this
      log.info('  inject into AndroidManifest')
      permissions.forEach(function (s) {
        log.info('  <uses-permission android:name="android.permission.' +
          s + '" />')
      })

      // insert into gradle
      template.readFile(path.join(opts.buildDir, 'app/build.gradle'))
      // template.log()
      template.goto(new RegExp('-- start plugin dependencies'))
      log.info('  inject into build.gradle')
      pluginInfoList.forEach(function (info) {
        var line = "  compile(name:'" + info.aarFilename + "', ext:'aar')"
        template.insertLine(line)
        log.info(line)
      })
      template.commentLine()
      template.log()
      template.save()

      // done!
      resolve()
    })
  }

  if (!opts.plugins) {
    return opts
  } else {
    return Promise.all(opts.plugins.reduce(function (prev, pluginName) {
      return prev.then(function () {
        return new Promise(function (resolve, reject) {
          // log.info('  installing plugin: ', pluginName)
          pluginPath = path.join(opts.root, 'node_modules', pluginName)
          // var androidPath = path.join(pluginPath, 'native', 'android')
          // fs.readdirSync(androidPath).forEach(function(filename) {
          // log.info('  found ', filename)
          // })
          var pathPromise = Promise.resolve(pluginPath)
          resolve(pathPromise
            .then(retrievePluginInfo)
            .then(buildAar)
            .then(copyPluginAar)
          )
        })
      })
    }, Promise.resolve()))
      .then(installIntoTemplate)
      .then(function () {
        return opts
      })
  }
}
exports.installPlugins = installPlugins

function assembleDebug (opts) {
  log.info('start assembleDebug')
  var command = './gradlew assembleDebug' +
    ' -PverCode=' +
    opts.versionCode +
    ' -PverName=' +
    opts.version +
    ' -PandroidAppId=' +
    opts.applicationId
  return exe(command, opts.buildDir)
    .then(function () {
      return opts
    })
}
exports.assembleDebug = assembleDebug

// HELPERS

function exe (command, cwd) {
  return exports.exe(command, cwd)
}

function exe_impl (command, cwd) {
  var args = command.split(' ')
  var fnName = args[0]
  args = args.splice(1, args.length - 1)

  return new Promise(function (resolve, reject) {
    log.info('Executing', command)
    if (cwd === '') {
      cwd = process.cwd()
    }
    log.info('in', cwd)
    var call = spawn(fnName, args, { cwd: cwd })
    call.stdout.on('data', function (data) {
      log.stream.write(data)
    })

    call.stderr.on('data', function (data) {
      log.stream.write(data)
    })

    call.on('close', function (code) {
      if (code === 0) {
        resolve()
      } else {
        reject(code)
      }
    })
  })
}
exports.exe = exe_impl

function createCopyFilter (src, dst) {
  return function (filename) {
    try {
      var relFilename = filename.substr(src.length)
      var stats = fs.statSync(filename)
      if (stats.isDirectory()) {
        if (filename.indexOf('.idea') >= 0 ||
          filename.indexOf('.gradle') >= 0 ||
          filename.indexOf('build') >= 0) {
          return false
        } else {
          return true
        }
      }

      var dstPath = path.join(dst, relFilename)
      if (!fs.existsSync(dstPath)) {
        log.info('   new: ' + relFilename)
        return true
      }
      var dstStats = fs.statSync(dstPath)
      if (stats.mtime > dstStats.mtime) {
        log.info('   updated: ' + relFilename)
        return true
      }
      if (relFilename.indexOf('MainActivity.java') > 0 ||
        relFilename.indexOf(path.join('app', 'build.gradle')) > 0) {
        log.info('   force: ' + relFilename)
        return true
      }
      return false
    } catch (e) {
      log.info(e)
    }
  }
}

// exports.setLogStream = function setLogStream (stream) {
//   if (stream) {
//     log.stream = stream
//   } else {
//     log.stream = process.stderr
//   }
// }

function installImages (opts) {
  log.info('- adding native assets using service -')

  var assetPromises = []
  var asset

  // splash LaunchImage.launchimage
  if (opts.splashScreen) {
    asset = {
      img: path.join(opts.root, opts.splashScreen),
      dst: path.join(opts.srcDir, 'res'),
      filename: 'splash.png',
      sizes: [
        {dst: 'drawable-xhdpi', w: 640, h: 960},
        {dst: 'drawable-land-xhdpi', w: 960, h: 640},
        {dst: 'drawable-large-xhdpi', w: 2048, h: 2560},
        {dst: 'drawable-large-land-xhdpi', w: 2560, h: 2048}
      ]
    }
    assetPromises[assetPromises.length] = createAsset(asset)
  }

  // app icon AppIcon.appiconset
  if (opts.appIcon) {
    asset = {
      img: path.join(opts.root, opts.appIcon),
      dst: path.join(opts.srcDir, 'res'),
      filename: 'ic_launcher.png',
      sizes: [
        {dst: 'mipmap-mdpi', w: 48, h: 48},
        {dst: 'mipmap-hdpi', w: 72, h: 72},
        {dst: 'mipmap-xhdpi', w: 96, h: 96},
        {dst: 'mipmap-xxhdpi', w: 144, h: 144}
      // {dst: 'mipmap-xxxhdpi', w: 192, h: 192}
      ]
    }
    assetPromises[assetPromises.length] = createAsset(asset)
  }

  return Promise.all(assetPromises).then(function (data) {
    log.info('Assets done')
    return opts
  }).catch(function (e) {
    log.error(e)
  })
}
exports.installImages = installImages

function createAsset (opts) {
  // return new Promise(function (resolve, reject) {
  return Promise.all(opts.sizes.map(function (size) {
    return createImages(opts.img, path.join(opts.dst, size.dst), opts.filename, size.w, size.h)
  }))
// })
}

function createImages (imgPath, dst, filename, w, h) {
  return stat(imgPath).then(function (stats) {
    return new Promise(function (resolve, reject) {
      var rs = fs.createReadStream(imgPath)
      var callPath = ['', 'image', w, h].join('/') + '?cache=false&outType=png'
      log.info('  = image ', imgPath)
      log.info('  = path ', callPath)

      try {
        var req = http.request(
          { path: callPath,
            method: 'POST',
            host: 'img.vigour.io',
            headers: { 'Content-Length': stats.size,
              'Content-Type': 'image/jpeg'
            }
          },
          function (res) {
            res.on('error', function (err) {
              console.error('err', err, err.stack)
              reject(err)
            })
            if (res.statusCode === 200) {
              log.info('  - success, write to ', dst)
              if (!fs.existsSync(dst)) {
                fs.mkdirSync(dst)
              }
              var ws = fs.createWriteStream(path.join(dst, filename))
              res.pipe(ws)
              res.on('error', function (err) {
                log.error(err)
                reject(err)
              })
              res.on('end', function () {
                log.info('  - saved')
                resolve(dst)
              })
            } else {
              res.on('data', function (chunk) {
                log.warn('   - error ', chunk.toString())
              })
              res.on('end', function () {
                reject(res)
              })
            }
          })

        req.on('error', function (err) {
          log.error('e2', err)
          reject(err)
        })

        log.info('  - starting call')
        rs.pipe(req).on('error', function (err) {
          log.error('e3', err)
          reject(err)
        })
      } catch (e) {
        log.error('e1: ', e)
        reject(e)
      }

    })
  })
}
