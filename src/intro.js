(function( jQuery, window, undefined ) {
"use strict";

// Use Uglify to do conditional compilation of warning messages;
// the minified version will set this to false and remove dead code.
if ( typeof JQCOMPAT_WARN === "undefined" ) {
	window.JQCOMPAT_WARN = true;
}