// A model is a collection of related atoms.  Bonds are only allowed between
//atoms in the same model.  An atom is uniquely specified by its model id and
//its serial number.
//A jmolmodel corresponds to a model within jmol

var WebMol = WebMol || {};

var Jmol = Jmol || {};

// no idea why this didn't make the transition to jsmol
// put back ability to load inline data
Jmol.loadInline = function(jsapp, model) {
	if (!model)
		return null;
	var applet = jsapp._applet;
	if (!applet)
		return null;
	if (typeof (model) == "string")
		return applet.loadInlineString(model, "", false);
	else
		return applet.loadInlineArray(model, "", false);
};

WebMol.jmolModel = (function() {
	// class variables go here
	var defaultAtomStyle = {
		sphere : {},
		stick : null,
		line : null,
		cross : null,
		cartoon : null
	};

	defaultAtomStyle = {
		sphere : {}
	};

	function getCurJMolID(japp) {
		var modelInfo = Jmol.getPropertyAsArray(japp, "modelInfo");
		var cnt = modelInfo.modelCount;
		if (cnt == 0) {
			return "";
		}
		var models = modelInfo.models;
		var ret = models[modelInfo.modelCount - 1].file_model;
		return ret;
	}

	// jmol color spec from hex value
	function jmolColor(c) {
		var hex = c.toString(16);
		// must have padding zeroes
		hex = "000000".substr(0, 6 - hex.length) + hex;
		return "\"[x" + hex + "]\"";
	}

	function jmolModel(japp, mid) {
		// private variables
		var atoms = [];
		var id = mid;
		var jmolid = null;
		var scriptToApply = ""; // for consistency with glmol, delay application
								// until render
		this.getID = function() {
			return id;
		};

		this.getJMolID = function() {
			return jmolid;
		};

		// add atoms to this model from molecular data string
		this.addMolData = function(data, format) {
			Jmol.loadInline(japp, data);
			// figure out what model was just created
			jmolid = getCurJMolID(japp);
			this.setStyle(defaultAtomStyle);
		};

		// create an or statement if necessary from select= sel[i]
		// fn knows how to do the select
		function constructOrStatement(select, fn) {
			if ($.isArray(select)) {
				var or = [];
				for ( var j = 0; j < select.length; j++) {
					or.push(fn(select[j]));
				}
				return "(" + or.join(" or ") + ")";
			} else {
				return fn(select);
			}
		}
		;

		// returns a jmol selection string (with the select keyword) for
		// the passed selection objection
		this.jmolSelect = function(sel) {
			var ret = [ "model=" + jmolid ];
			for ( var i in sel) {
				if (sel.hasOwnProperty(i)) {
					switch (i) {
					case "resn": // residue name
						if (typeof (sel[i]) != "undefined") {
							ret.push(constructOrStatement(sel[i], function(x) {
								return "[" + x + "]";
							}));
						}
						break;
					case "elem":
						if (typeof (sel[i]) != "undefined") {
							ret.push(constructOrStatement(sel[i], function(x) {
								return "element=\"" + x + "\"";
							}));
						}
						break;
					case "hetflag":
						if (typeof (sel[i]) != "undefined") {
							if (sel[i])
								ret.push("(hetero)");
							else
								ret.push("(not hetero)");
						}
						break;
					case "chain":
						if (typeof (sel[i]) != "undefined") {
							ret.push(constructOrStatement(sel[i], function(x) {
								return ":" + x;
							}));
						}
						break;
					case "resi": // resid
						if (typeof (sel[i]) != "undefined") {
							ret.push(constructOrStatement(sel[i], function(x) {
								return "resno=" + x;
							}));
						}
						break;
					case "icode":
						if (typeof (sel[i]) != "undefined") {
							ret.push(constructOrStatement(sel[i], function(x) {
								return "^" + x;
							}));
						}
						break;
					}
				}
			}
			return ret.join(" and ");
		}

		// style the select atoms with style
		this.setStyle = function(style, sel) {
			var select = "select " + this.jmolSelect(sel);
			var stylestr = "";

			if (style.sphere) {
				stylestr += "spacefill ";
				if (typeof (style.sphere.scale) != "undefined") {
					stylestr += Math.round(style.sphere.scale * 100) + "%";
				} else if (typeof (style.sphere.radius) != "undefined") {
					stylestr += style.sphere.radius.toFixed(3);
				}
				stylestr += ";";
				if (typeof (style.sphere.color) != "undefined") {
					stylestr += "color " + jmolColor(style.sphere.color) + ";";
				}
			} else {
				stylestr += "spacefill off;";
			}

			if (style.line || style.stick) {
				// ignore line styling of stick is set
				var c = null;
				if (style.stick) {
					var r = style.stick.radius || 0.25;
					stylestr += "wireframe " + r + ";";
					if (typeof style.stick.color != "undefined")
						c = style.stick.color;
				} else {
					stylestr += "wireframe;";
					if (typeof style.line.color != "undefined")
						c = style.line.color;
				}
				if (c != null) {
					stylestr += "color wireframe " + jmolColor(c) + ";";
				}
			} else {
				stylestr += "wireframe off;";
			}

			if (style.cross) {
				stylestr += "stars ";
				if (typeof (style.cross.scale) != "undefined") {
					stylestr += Math.round(style.sphere.scale * 100) + "%";
				} else if (typeof (style.cross.radius) != "undefined") {
					stylestr += style.sphere.radius.toFixed(3);
				}
				stylestr += ";";
				if (typeof (style.cross.color) != "undefined") {
					stylestr += "color stars " + jmolColor(style.cross.color)
							+ ";";
				}
			} else {
				stylestr += "stars off;";
			}

			if (style.cartoon) {
				stylestr += "cartoon on;";
				if (typeof (style.cartoon.color) != "undefined") {
					stylestr += "color cartoon " + jmolColor(style.cartoon.color)
							+ ";";
				}
			} else {
				stylestr += "cartoon off";
			}
			
			scriptToApply += stylestr;
		};

		// for consistency with glmol, delay application of styles
		this.render = function() {
			if (scriptToApply.length > 0) {
				Jmol.script(japp, scriptToApply);
				console.log(scriptToApply);
				scriptToApply = "";
			}
		};

	}
	;

	return jmolModel;
})();