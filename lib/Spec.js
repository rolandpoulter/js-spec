/*jslint smarttabs:true*/

function getGlobal () {
	return typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
}

"use strict";

var Emitter = require('mttr'),
    Options = require('ptns'),
    async = require('async'),
    sinon = require('sinon'),
    chai = require('chai'),

    should = chai.should,
    expect = chai.expect,
    assert = chai.assert,

    merge = Options.util.merge,
    keys_ = Object.keys,
    new_ = Options.clss.util.new_;

if (!keys_) keys_ = function (object) {
	var keys = [],
	    key;

	for (key in object) if (object.hasOwnProperty(key)) {
		keys.push(key);
	}

	return keys;
};

function with_ (object, block, that) {
	var conflicts = {},
	    property,
	    global = getGlobal();

	for (property in object) if (object.hasOwnProperty(property)) {
		if (global[property]) conflicts[property] = global[property];

		global[property] = object[property];
	}

	if (typeof block === 'function') {
		block.call(that || global);

		with_(conflicts);
	}
}

module.exports = Options.clss('Spec', function (def, supr, proto) {
	var Spec = this;

	Emitter.create(def);

	Spec.util = Spec.util || {
		keys: keys_,
		with_: with_,
		getGlobal: getGlobal
	};

	def.options = {
		name: '',
		block: function () {},
		parent: null,
		timeout: 1000,
		hookTimeout: 5000
	};

	def.init = function (name, options, block) {
		this.specs = {};
		this.tests = {};

		return this.initEmitter().fillArguments(name, options, block,
			function (name, options, block) {
				options.name = name;
				options.block = block;

				this.newOptions(options);
			}
		);
	};

	def.fillArguments = function (name, options, block, callback) {
		if (!block) {
			if (!options && typeof name === 'function') {
				options = {};
				block = name;
				name = '';
			}

			else if (typeof name === 'string' && typeof options === 'function') {
				block = options;
				options = {};
			}
		}

		options = options || {};

		callback.call(this, name, options, block);

		return this;
	};

	def.setParent = function (parent) {
		this.options.parent = parent;

		return this;
	};

	def.enumParents = function (iterator, callback) {
		var that = this,
		    parent = this;

		next();

		function next () {
			parent = parent.options.parent;

			if (Spec.derived(parent)) {
				iterator.call(that, parent, next);

				if (iterator.length === 1) next();
			}

			else if (typeof callback === 'function') {
				callback.call(that);
			}
		}

		return this;
	};

	def.rootSpec = function () {
		var root = this;

		while (Spec.derived(root && root.options.parent)) {
			root = root.options.parent;
		}

		return root;
	};

	def.callHook = function (hookName, scope, callback) {
		var timer,
		    hookFunc = this.options[hookName],
		    that = this;

		function end (error) {
			clearTimeout(timer);

			callback.call(that, error);
		}

		if (typeof hookFunc === 'function') {
			with_(this.testAPI, function () {
				var that = this,
				    sync = hookFunc.length < 1;

				try {
					if (sync) {
						hookFunc.call(scope);
						end();
					}

					else {
						timer = setTimeout(function () {
							end('Spec hook timed out: ' + that.options.name + ':' + hookName);
						}, this.options.hookTimeout);

						hookFunc.call(scope, end);
					}
				}

				catch (error) {
					end(error);
				}
			}, this);
		}

		else end();

		return this;
	};

	def.callAfterSpec = function (scope, callback) {
		return this.callHook('afterSpec', scope, callback);
	};

	def.callBeforeSpec = function (scope, callback) {
		return this.callHook('beforeSpec', scope, callback);
	};

	def.callAfterTest = function (scope, callback) {
		return this.callHook('afterTest', scope, function (error) {
			if (error) {
				return callback.call(this, error);
			}

			var parents = [];

			this.enumParents(function (parent) {
				parents.unshift(parent);
			});

			async.forEach(parents, function (parent, next) {
				parent.callHook('afterTest', scope, next);
			}, callback);
		});
	};

	def.callBeforeTest = function (scope, callback) {
		return this.enumParents(function (parent, next) {
			parent.callHook('beforeTest', scope, next);
		}, function () {
			this.callHook('beforeTest', scope, callback);
		});
	};

	def.addSpec = function (name, options, block) {
		if (this.isFrozen) return this;

		return this.specs[name] = new Spec(name, options, block).setParent(this);
	};

	def.addTest = function (name, options, block) {
		if (this.isFrozen) return this;

		return this.fillArguments(name, options, block,
			function (name, options, block) {
				name = name || block.toString();

				options = options || {}
				options.spec = this;
				options.name = name;
				options.timeout = this.options.timeout;

				block.options = options;

				this.tests[name] = block;
			}
		);
	};

	def.onlyTest = function (name, options, block) {
		this.specs = {};
		this.tests = {};

		this.addTest(name, options, block);

		this.isFrozen = true;

		return this;
	};

	var context,
	    unit;

	def.setup = function (recursive) {
		var lastContext,
				block,
				specs,
				name;

		if (this.isSetup) return this;

		if (recursive) {
			this.isSetup = true;

			lastContext = context;
			context = this;

			block = this.options.block;
			specs = this.specs;

			if (typeof block === 'function') block.call(this)

			for (name in specs) if (specs.hasOwnProperty(name)) {
				specs[name].setup(true);
			}

			context = lastContext;
		}

		else with_(this.specAPI, function () {
			this.setup(true);
		}, this);

		return this;
	};

	def.runSpec = function (scope, callback) {
		scope = scope || {};

		var lastScope = scope,
		    that = this.setup();

		function end (error) {
			if (!error) that.isReportable = true;

			callback.call(that, error);
		}

		function runChildSpecs (error) {
			if (error) return end(error);

			var keys = keys_(that.specs);

			that.specCount = keys.length;

			async.forEach(keys, function (key, next) {
				that.specs[key].runSpec(scope, next);
			}, end);
		}

		scope = new_(scope);

		return this.callBeforeSpec(scope, function () {
			var keys = keys_(this.tests);

			this.testCount = keys.length;
			this.failCount = 0;

			async.forEach(keys, function (key, next) {
				that.runTest(key, new_(scope), next);

			}, function (error) {
				if (error) return end(error);

				that.callAfterSpec(lastScope, runChildSpecs);
			});
		})
	};

	def.runTest = function (name, scope, callback) {
		if (!this.tests.hasOwnProperty(name)) {
			callback('Undefined test: ' + this.options.name + ':' + name);

			return this;
		}

		var lastUnit = unit;

		unit = this.tests[name];

		with_(this.testAPI, function () {
			var lastScope = scope;

			scope = new_(scope);

			if (typeof unit.options.first === 'function') {
				unit.options.first.call(scope);
			}

			this.callBeforeTest(scope, function (error) {
				if (error) return callback.call(this, error);

				var that = this,
				    test = this.tests[name],
				    sync = test.length < 1,
				    start = new Date().getTime(),
				    timer;

				function end (error) {
					clearTimeout(timer);

					test.time = new Date().getTime() - start;

					if (error) {
						that.failCount += 1;

						test.failure = error;
					}

					that.callAfterTest(lastScope, function (error) {
						that.rootSpec().emit('ran test', test);

						callback.call(that, error);
					});
				}

				try {
					if (sync) {
						test.call(new_(scope));
						end();
					}

					else {
						timer = setTimeout(function () {
							end('Test timed out: ' + name);
						}, test.options.timeout);

						test.call(scope, end);
					}
				}

				catch (error) {
					end(error);
				}
			});
		}, this);

		unit = lastUnit;

		return this;
	};

	def.run = function (callback) {
		return this.runSpec({}, callback);
	};

	def.newResults = function () {
		return this.results = {
			failures: []
		};
	};

	def.reportSpec = function (callback, results) {
		results = results || this.newResults();

		if (!this.isReportable) {
			return this.run(function (error) {
				if (error) return callback.call(this, error);

				this.report(callback, results);
			});
		}

		var specs = this.specs,
		    tests = this.tests,
		    specName,
		    testName;

		for (testName in tests) if (tests.hasOwnProperty(testName)) {
			this.reportTest(testName, results);
		}

		for (specName in specs) if (specs.hasOwnProperty(specName)) {
			specs[specName].reportSpec(null, results);
		}

		if (callback) callback.call(this, results);

		return this;
	};

	def.reportTest = function (name, results) {
		var test = this.tests[name];

		if (test.failure) {
			results.failures.push(test);
		}

		return this;
	};

	def.report = function (callback) {
		callback = callback || function () {};

		return this.reportSpec(callback, this.newResults());
	};

	Spec.describe = describe;

	function describe (name, options, block) {
		if (this && this.addSpec) return this.addSpec(name, options, block)

		if (context && context.addSpec) return context.addSpec(name, options, block);

		return new Spec(name, options, block);
	}

	function test (name, options, block) {
		if (this.addTest) return this.addTest(name, options, block);

		return context.addTest(name, options, block);
	}

	function oneTest (name, options, block) {
		if (this.onlyTest) return this.onlyTest(name, options, block);

		return context.onlyTest(name, options, block);
	}

	function option (name) {
		return function (value) {
			context.options[name] = value;
		}
	}

	function idle () {}

	def.specAPI = {
		include: function (spec) {
			if (Spec.derived(spec)) {
				if (this && this.addSpec) return this.addSpec(spec.options);

				if (context && context.addSpec) return context.addSpec(spec.options);
			}

			return Spec.derived(this) ? this : context;
		},

		describe: describe,
		context: describe,

		after: option('afterSpec'),
		before: option('beforeSpec'),

		afterEach: option('afterTest'),
		beforeEach: option('beforeTest'),

		test: test,
		it: test,

		_test: oneTest,
		_it: oneTest,

		xinclude: idle,

		xdescribe: idle,
		xcontext: idle,

		xafter: idle,
		xbefore: idle,

		xafterEach: idle,
		xbeforeEach: idle,

		xtest: idle,
		xit: idle
	};

	def.testAPI = {
		should: should,
		expect: expect,
		assert: assert,
		sinon: sinon,

		first: function (callback) {
			unit.options.first = callback;
		}
	};

	merge(def, def.specAPI);
	merge(def, def.testAPI);
});
