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
	, _mkdir = Promise.denodeify(fs.mkdirp)
	, _ncp = Promise.denodeify(ncp)
	, _rimraf = Promise.denodeify(rimraf)
	, _readFile = Promise.denodeify(fs.readFile)
	, _writeFile = Promise.denodeify(fs.writeFile)


module.exports = exports = function (opts, shared) {
  console.log('- start ios build -')
  // console.log("OPTIONS", JSON.stringify(opts, null, 2))
	return Promise.resolve(opts)
		.then(configure)
		.then(clean)
		.then(prepare)
		.then(configureTemplate)
		.then(modifyPlist)
		.then(shared.copyAssets)
		.then(addBridge)
		.then(function() {
			console.log("__FINISHED__")
			return true
		})
		.catch(shared.handleErrors('ios'))
}

function configure (opts) {
	var options = opts.native.platforms.ios
	console.log("- configure ios build paths -")
	options.root = opts.native.root
	options.templateSrc = path.join(__dirname, '..', '..', '..', 'templates', 'ios')
	options.buildDir = path.join(options.root, 'build', 'ios')
	options.wwwDst = path.join(options.buildDir, 'vigour-native', 'www')
	options.packer = opts.packer
	return options
}

function clean (opts) {
	console.log('- clean ios build dir -')
	return _rimraf(opts.buildDir)
		.then(function () {
			return opts
		})
}

function prepare (opts) {
	console.log('- prepare ios template -')
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
	console.log('- configure template -')
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
	console.log('- configure project -')
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

function addBridge (opts) {
	console.log('- adding bridge -')
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