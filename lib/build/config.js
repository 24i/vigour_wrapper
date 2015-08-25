var path = require('path')
var version = require('../../package.json').version
var config = module.exports = exports = {}

config.version = version

config.items =
	{ "vigour.native.selectedPlatforms":
		{ def: null
		, env: "VNATIVE_PLATFORMS"
		, cli: "-p, --platforms <platformList>"
		, desc: "Comma-separated list of platforms to build (builds all by default)"
		}
	, "vigour.native.root":
		{ def: process.cwd()
		, env: "VNATIVE_ROOT"
		, cli: "--root <path>"
		, desc: "Path to the root directory of the project to be built"
		}
	, "vigour.native.platforms.android.version":
		{ def: "1.0.0"
		, env: "VNATIVE_VERSION"
		, cli: "--android-version <semver>"
		, desc: "version (semver) to be used for the android apk"
		}
	, "vigour.native.platforms.android.versionCode":
		{ def: 1
		, env: "VNATIVE_VERSIONCODE"
		, cli: "--android-versionCode <int>"
		, desc: "version code (integer) to be used for the andriod apk"
		}
	, "vigour.native.platforms.android.run":
		{ def: null
		, env: "VNATIVE_ANDROID_RUN"
		, cli: "--android-run"
		, desc: "wether to install and launch the build on device"
		}
	}

config.files =
	{ def: path.join(process.cwd(), 'package.json')
	, env: "VNATIVE_CONFIG_FILES"
	}