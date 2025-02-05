TestManager = {

	/*
	 * Load a version of a file based on URL parameters.
	 *
	 *	dev		Uncompressed development version: source files in the project /dist dir
	 *	raw		Non-combined dev version: source files from the project /src dir
	 *	min		Minified version in the project /dist dir
	 *	VER		Version from code.jquery.com, e.g.: git, 1.8.2.min or 1.7rc1
	 *	else	Full or relative path to be used for script src
	 */
	loadProject: function( projectName, defaultVersion, isSelf ) {
		var file, i,
			lines = "",
			urlTag = this.projects[ projectName ].urlTag,
			matcher = new RegExp( "\\b" + urlTag + "=([^&]+)" ),
			projectRoot = this.baseURL + ( isSelf ? "../.." : "../../../" + projectName ),
			version = ( matcher.exec( document.location.search ) || {} )[ 1 ] || defaultVersion;

		if ( window.__karma__ && isSelf ) {
			projectRoot = "/base";
		}
		if ( version === "raw" ) {

			// Order is important
			file = [
				"version",
				"compareVersions",
				"main",
				"jquery/core",
				"jquery/ajax",
				"jquery/attributes",
				"jquery/css",
				"jquery/data",
				"jquery/effects",
				"jquery/event",
				"jquery/manipulation",
				"jquery/offset",
				"jquery/serialize",
				"jquery/traversing",
				"jquery/deferred"
			];

			for ( i = 0; i < file.length; i++ ) {
				file[ i ] = projectRoot + "/src/" + file[ i ] + ".js";
			}
		} else if ( version === "dev" ) {
			file = projectRoot + "/dist/" + projectName + ".js";
		} else if ( version === "min" ) {
			file = projectRoot + "/dist/" + projectName + ".min.js";
		} else if ( version.indexOf( "git" ) === 0 ||
			version.indexOf( "3.x-git" ) === 0 ) {
			file = "https://releases.jquery.com/git/" + projectName + "-" + version + ".js";
		} else if ( /^[\w\.\-]+$/.test( version ) ) {
			file = "https://code.jquery.com/" + projectName + "-" + version + ".js";
		} else {
			file = version;
		}
		this.loaded.push( {
			projectName: projectName,
			tag: version,
			file: file
		} );

		if ( typeof file === "string" ) {
			document.write( "<script src='" + file + "'></script>" );

		} else {
			for ( i = 0; i < file.length; i++ ) {
				lines += "<script src='" + file[ i ] + "'></script>";
			}

			document.write( lines );
		}
	},

	/**
	 * Iframe tests that require setup not covered in the standard unit test
	 *
	 * Note that options passed into the standard unit tests will also be passed to
	 * the iframe, but the iframe html page is responsible for processing them
	 * as appropriate (for example by calling TestManager.loadProject)
	 */
	runIframeTest: function( title, url, func ) {
		var that = this;
		QUnit.test( title, function( assert ) {
			var iframe,
				query = window.location.search.slice( 1 ),
				done = assert.async();

			that.iframeCallback = function() {
				var args = Array.prototype.slice.call( arguments );

				args.unshift( assert );

				setTimeout( function() {
					that.iframeCallback = undefined;

					func.apply( this, args );
					func = function() {};
					iframe.remove();

					done();
				} );
			};
			iframe = jQuery( "<div/>" )
				.css( { position: "absolute", width: "500px", left: "-600px" } )
				.append( jQuery( "<iframe/>" ).attr( "src", that.baseURL + url +
					( query && ( /\?/.test( url ) ? "&" : "?" ) ) + query ) )
				.appendTo( "#qunit-fixture" );
		} );
	},
	iframeCallback: undefined,
	init: function( projects ) {
		var p, project, originalDeduplicateWarnings,
			disabledPatches, origMigrateDisablePatches,
			FILEPATH = "/test/data/testinit.js",
			activeScript = [].slice.call( document.getElementsByTagName( "script" ), -1 )[ 0 ],
			parentUrl = activeScript && activeScript.src ?
				activeScript.src.replace( /[?#].*/, "" ) + FILEPATH.replace( /[^/]+/g, ".." ) + "/" :
				"../";

		this.baseURL = parentUrl + "test/data/";

		this.projects = projects;
		this.loaded = [];

		// Do QUnit setup if QUnit is loaded (could be an iframe page)
		if ( !window.QUnit ) {
			return;
		}

		// Max time for async tests until it aborts test
		// and start()'s the next test.
		QUnit.config.testTimeout = 20 * 1000; // 20 seconds

		// Enforce an "expect" argument or expect() call in all test bodies.
		QUnit.config.requireExpects = true;

		// Set the list of projects, including the project version choices.
		for ( p in projects ) {
			project = projects[ p ];
			QUnit.config.urlConfig.push( {
				label: p,
				id: project.urlTag,
				value: project.choices.split( "," )
			} );
		}

		/**
		 * Add random number to url to stop caching
		 *
		 * Also prefixes with baseURL automatically.
		 *
		 * @example url("index.html")
		 * @result "data/index.html?10538358428943"
		 *
		 * @example url("xyz.php?foo=bar")
		 * @result "data/xyz.php?foo=bar&10538358345554"
		 */
		window.url = function url( value ) {
			return TestManager.baseURL + value + ( /\?/.test( value ) ? "&" : "?" ) +
				new Date().getTime() + "" + parseInt( Math.random() * 100000, 10 );
		};

		QUnit.begin( function( details ) {
			originalDeduplicateWarnings = jQuery.migrateDeduplicateWarnings;
		} );

		QUnit.testStart( function( details ) {

			// If only the first warning is reported, tests using `expectWarning`
			// with multiple function calls would pass even if some of them didn't
			// warn. Because of that, by default don't deduplicate warnings in tests.
			if ( details.name !== "jQuery.migrateDeduplicateWarnings" ) {
				jQuery.migrateDeduplicateWarnings = false;
			} else {

				// When testing this API, we want to start with its default value.
				jQuery.migrateDeduplicateWarnings = originalDeduplicateWarnings;
			}

			// Patch `jQuery.migrateDisablePatches` so that we keep a list of disabled
			// patches that we can then re-enable. Some of those patches may have already
			// been re-enabled later but if we do it here again it won't hurt.
			disabledPatches = [];
			origMigrateDisablePatches = jQuery.migrateDisablePatches;
			jQuery.migrateDisablePatches = function customMigrateDisablePatches() {
				var i;
				for ( i = 0; i < arguments.length; i++ ) {
					disabledPatches.push( arguments[ i ] );
				}
				return origMigrateDisablePatches.apply( this, arguments );
			};
		} );

		QUnit.testDone( function() {
			jQuery.migrateDisablePatches = origMigrateDisablePatches;

			// Restore potentially disabled patches
			var i, patch;
			for ( i = 0; i < disabledPatches.length; i++ ) {
				patch = disabledPatches[ i ];
				jQuery.migrateEnablePatches( patch );
			}

			// Re-disable patches disabled by default
			jQuery.migrateDisablePatches( "self-closed-tags" );
		} );
	}
};
TestManager.init( {
	"jquery": {
		urlTag: "jquery",
		choices: "dev,min,git,git.min,git.slim,git.slim.min," +
			"3.x-git,3.x-git.min,3.x-git.slim,3.x-git.slim.min," +
			"3.6.0,3.6.0.slim,3.5.1,3.5.1.slim,3.4.1,3.4.1.slim," +
			"3.3.1,3.3.1.slim,3.2.1,3.2.1.slim,3.1.1,3.1.1.slim,3.0.0,3.0.0.slim"
	},
	"jquery-migrate": {
		urlTag: "plugin",
		choices: "dev,min,raw,git,3.3.2,3.3.1,3.3.0,3.2.0,3.1.0,3.0.1,3.0.0"
	}
} );

/**
 * Load the TestSwarm listener if swarmURL is in the address.
 */
( function() {
	var url = window.location.search;
	url = decodeURIComponent( url.slice( url.indexOf( "swarmURL=" ) + "swarmURL=".length ) );

	if ( !url || url.indexOf( "http" ) !== 0 ) {
		return;
	}

	document.write( "<scr" + "ipt src='https://swarm.jquery.org/js/inject.js?" +
		( new Date() ).getTime() + "'></scr" + "ipt>" );
} )();

