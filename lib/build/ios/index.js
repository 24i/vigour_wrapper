var fs = require('vigour-fs')
	, rimraf = require('rimraf')
  , path = require('path')
	, ncp = require('ncp')
	, Promise = require('promise')
	, xcode = require('xcode')
	, plist = require('plist')
	, browserify = require('browserify')
	, concat = require('concat-stream')
	, log = require('npmlog')
	, http = require('http')
	, _mkdir = Promise.denodeify(fs.mkdirp)
	, _ncp = Promise.denodeify(ncp)
	, _rimraf = Promise.denodeify(rimraf)
	, _readFile = Promise.denodeify(fs.readFile)
	, _writeFile = Promise.denodeify(fs.writeFile)
	, _readJSON = Promise.denodeify(fs.readJSON)
	, _writeJSON = Promise.denodeify(fs.writeJSON)
	, stat = Promise.denodeify(fs.stat)
	, _ = require('lodash')


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
		.then(function() {
			log.info("__FINISHED__")
			return true
		})
		.catch(shared.handleErrors('ios'))
}

function configure (opts) {
	log.info("- configure ios build paths -")
	// log.info('opts',opts)
	var options = opts.native.platforms.ios
	options.root = opts.native.root
	options.templateSrc = path.join(__dirname, '..', '..', '..', 'templates', 'ios')
	options.buildDir = path.join(options.root, 'build', 'ios')
	options.wwwDst = path.join(options.buildDir, 'vigour-native', 'www')
	options.packer = opts.packer
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
	return _mkdir(opts.buildDir)
		.then(function () {
			return _ncp(opts.templateSrc
					, opts.buildDir
					, { clobber: true })
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
				// 	templateProj.updateProductName(replaceSpacesWithDashes(opts.productName))
				// }

				//add framework stuff.. plugins etc.	
					
				fs.writeFileSync(opts.projectPath, templateProj.writeSync())
				resolve(opts)
			}
		})
	})
}

/**
			Helpers
 **/

function replaceSpacesWithDashes(/*String*/ str) {
	return str.replace(/\s+/g, '-').toLowerCase()
}


/**
		override default plist settings
 **/
function modifyPlist(opts) {
	log.info('- configure project -')
	opts.plistPath = path.join(opts.buildDir, 'vigour-native/vigour-native/Info.plist')
	opts.plistObject = plist.parse(fs.readFileSync(opts.plistPath, 'utf8'))
	
	// var versionNumber = parseInt(plistObject["CFBundleVersion"])
	// plistObject["CFBundleVersion"] = '' + ++versionNumber

	if(opts.organizationIdentifier) {
		opts.plistObject.CFBundleIdentifier = opts.organizationIdentifier
	}
	
	if(opts.buildNumber) {
		opts.plistObject.CFBundleVersion = opts.buildNumber
	}
	
	if(opts.productName) {
		opts.plistObject.CFBundleName = opts.productName
	}
	
	if(opts.appUrlIdentifier && opts.appUrlScheme) {
		opts.plistObject.CFBundleURLTypes = []
		var urlScheme = {
			CFBundleTypeRole:"Editor",
			CFBundleURLName:opts.appUrlIdentifier,
			CFBundleURLSchemes: [opts.appUrlScheme]
		}
		opts.plistObject.CFBundleURLTypes.push(urlScheme)
	}
	
	if(opts.appIndexPath) {
		opts.plistObject.appIndexPath = opts.appIndexPath
	}
	else {
		 throw new Error("platforms.ios.appIndexPath should be provided!")
	}
	
	fs.writeFileSync(opts.plistPath, plist.build(opts.plistObject))
	return opts
}

function nativeAssets (opts) {
	log.info('- adding native assets using service -')
	
	var xcodeAssetsPath = path.join(opts.buildDir, 'vigour-native/vigour-native/Images.xcassets')
	
	//splash
	if(opts.splashScreen) {
	
		var launchImageTplPath = path.join(__dirname, '..', '..', '..', 'lib', 'build', 'ios', 'launchImgTpl.json') 
		var splashScreen = path.join(opts.root, opts.splashScreen)

		return _readJSON(launchImageTplPath).then(function(Obj) {
			log.info(_.pluck(Obj.images, 'filename'))
			
			var data = {}
			data.paths = _.pluck(Obj.images, 'filename')
			data.splashScreen = splashScreen
			paths = createImages(data)
			
			return Promise.all(paths).then(function (data) { 
				log.info("check: ", data)
				return data
			})
				
		}).then(function(Obj) {
			log.info("check twice! ", Obj)
			return opts
		})

			
		/*
		var launchImageContent = path.join(xcodeAssetsPath, 'LaunchImage.launchimage/Contents.json')
		_readJSON(launchImageContent).then(function(jsObject) {
			// jsObject
			return jsObject
		}).then(_writeJSON).then(function() {
			log.info('Contents.json written')
			return opts
		})
		*/
	} else {
		log.info("skip assets: ", opts)
		return opts
	}
}

function createImages(/* obj */ data) {
	
	if(!data.splashScreen && !data.paths) return
		
	return data.paths.map(function (path) {
		
    return stat(data.splashScreen)
        .then(function (stats) {
					
					return new Promise(function (resolve, reject) {
						
            var rs = fs.createReadStream(data.splashScreen)
            
						try {
							var req = http.request(
                  { path: path
                  , method: "POST"
									, host: "img.vigour.io"
                  , headers:
                      { "Content-Length": stats.size
                      , "Content-Type": "image/jpeg"
                      }
                  }
              , function (res) {
                  res.on('error', function (err) {
											reject(err)
                      console.error("err", err, err.stack)
                  })
                  if (res.statusCode === 200) {
                      var out = "reul.png"
                      var ws = fs.createWriteStream(out)
                      res.pipe(ws)
                      res.on('error', function (err) {
												log.error(err)
												reject(err)
                      })
                      res.on('end', function () {
													resolve("X")
                      })
                  }
              })
							
						}
						catch(e) {
							log.error("e1: ", e)
							reject(e)
						}
						
            req.on('error', function (err) {
              log.error("e2", err)
							reject(err)
            })
						
            rs.pipe(req).on('error', function (err) {
							log.error("e3", err)
							reject(err)
            })
						
        })
			})
		})
}

function addBridge (opts) {
	log.info('- adding bridge -')
	var bridgePath = path.join(__dirname, '..', '..', 'bridge', 'ios', 'index.js')
		, htmlPath = path.join(opts.wwwDst, opts.appIndexPath)
		, bro = browserify()
		, _html
	return readHtml()
		.then(buildBridge)
		.then(writeHtml)
		.then(function () {
			return opts
		})

	function readHtml () {
		return _readFile(htmlPath, 'utf8')
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
		var newHtml = _html.replace("<head>", "<head><script type='text/javascript'>" + bridgeCode + "</script>", "i")
		return _writeFile(htmlPath, newHtml, 'utf8')
	}
}