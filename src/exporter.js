let $3DmolToUse;
if (typeof self !== "undefined" && typeof window === "undefined") {
	// You are probably in a webworker.
	$3DmolToUse = self.$3Dmol || {};
} else {
	// You are probably in a browser.
	$3DmolToUse = window.$3Dmol || {};
}

//put the global $3Dmol object into a module
if (typeof module === "object" && typeof module.exports === "object") {
	//for node.js exporting
	module.exports = $3DmolToUse;
}
