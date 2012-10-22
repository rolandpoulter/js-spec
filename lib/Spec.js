function getGlobal () {
	return typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
}

"use strict";

var Emitter = require('mttr'),
    Options = require('ptns'),
    async = require('async'),
    sinon = require('sinon'),
    chai = require('chai/lib/chai'),

    should = chai.should,
    expect = chai.expect,
    assert = chai.assert,

    merge = Options.util.merge,
    keys_ = Object.keys,
    new_ = Options.clss.util.newObject;

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

	function end () {with_(conflicts);}

	if (typeof block === 'function') {
		block.call(that || global, end);

		if (block.length < 1) end();
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

	Spec.describe = function (name, options, block) {
		return new Spec(name, options, block)
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

		return this.fillArguments(name, options, block,
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

		try {
			next();

		} catch (error) {handleError(error);}

		return this;

		function next (error) {
			if (error) return handleError(error);

			parent = parent.options.parent;

			if (Spec.derived(parent)) {
				iterator.call(that, parent, next);

				if (iterator.length === 1) next();
			}

			else if (typeof callback === 'function') {
				callback.call(that);
			}
		}

		function handleError (error) {
			if (typeof callback === 'function') callback.call(that, error);

			else throw error;
		}
	};

	def.listParents = function () {
		var parents = [];

		this.enumParents(function (parent) {
			parents.push(parent);
		});

		return parents;
	};

	def.rootSpec = function () {
		var root = this;

		while (Spec.derived(root && root.options.parent)) {
			root = root.options.parent;
		}

		return root;
	};

	def.isRootSpec = function () {
		return !Spec.derived(this.options.parent);
	};

	def.callHook = function (hookName, scope, callback) {
		return this.callHookFunc(this.options[hookName], hookName, scope, callback);
	};

	def.callHookFunc = function (hookFunc, hookName, scope, callback) {
		var timer,
		    that = this;

		if (typeof hookFunc !== 'function') {
			callback.call(this);

			return this;
		}

		with_(this.api.test, function (cleanup) {
			var that = this,
			    sync = hookFunc.length < 1;

			function end (error) {
				clearTimeout(timer);
				cleanup();

				callback.call(that, error);
			}

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

		return this;
	};

	def.callAfterSpec = function (scope, callback) {
		return this.callHook('afterSpec', scope, callback);
	};

	def.callBeforeSpec = function (scope, callback) {
		return this.callHook('beforeSpec', scope, callback);
	};

	def.callAfterTest = function (scope, callback, testHook) {
		return this.callHookFunc(testHook, 'testAfter', scope, function (error) {
			if (error) return callback.call(this, error);

			this.callHook('afterTest', scope, function (error) {
				if (error) return callback.call(this, error);

				async.forEach(this.listParents(), function (parent, next) {
					parent.callHook('afterTest', scope, next);
				}, callback);
			});
		});
	};

	def.callBeforeTest = function (scope, callback, testHook) {
		var parents = this.listParents().reverse(),
		    that = this;

		async.forEach(parents, function (parent, next) {
			parent.callHook('beforeTest', scope, next);

		}, function (error) {
			if (error) return callback.call(this, error);

			that.callHookFunc(testHook, 'testBefore', scope, function (error) {
				if (error) return callback.call(this, error);

				this.callHook('beforeTest', scope, callback);
			});
		});

		return this;
	};

	def.addSpec = function (spec) {
		var spec = spec.setParent(this);

		if (!this.isFrozen) this.specs[spec.options.name] = spec;

		return spec;
	};

	def.addTest = function (name, options, block) {
		var result;

		this.fillArguments(name, options, block,
			function (name, options, block) {
				result = block;

				name = name || block.toString();

				options = options || {}
				options.spec = this;
				options.name = name;
				options.timeout = this.options.timeout;

				block.options = options;

				if (!this.isFrozen) this.tests[name] = block;
			}
		);

		return result;
	};

	def.focusSpec = function (spec, andTests) {
		this.isFrozen = true;

		if (!this.focusedSpecs) this.focusedSpecs = {};

		this.specs = this.focusedSpecs;
		
		this.specs[spec.options.name] = spec;

		var lastParent = this;

		if (andTests) this.focusTest();

		this.enumParents(function (parent) {
			parent.focusSpec(lastParent)

			if (andTests) parent.focusTest();

			lastParent = parent;
		});

		return spec;
	};

	def.focusTest = function (test) {
		this.isFrozen = true;

		if (!this.focusedTests) this.focusedTests = {};

		this.tests = this.focusedTests;
		
		if (test) this.tests[test.options.name] = test;

		if (Spec.derived(this.options.parent)) {
			this.options.parent.focusSpec(this, true);
		}

		return test;
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

		else with_(this.api.spec, function (cleanup) {
			this.setup(true);

			cleanup();
		}, this);

		return this;
	};

	def.runSpec = function (scope, callback) {
		scope = scope || {};

		var lastScope = scope,
		    that = this.setup();

		if (this.isRootSpec()) this.totalCount = 0;

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

			this.rootSpec().totalCount += keys.length;
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

		with_(this.api.test, function () {
			var lastScope = scope;

			scope = new_(scope);

			this.callHookFunc(unit.options.first, 'first', scope, function (error) {
				if (error) return callback.call(this, error);

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
							if (error) return callback.call(that, error);
	
							that.callHookFunc(test.options.last, 'last', scope, function (error) {
								that.rootSpec().emit('ran test', test);
	
								callback.call(that, error);
							});
						}, test.options.after);
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
				}, unit.options.before);
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
			total: this.totalCount,
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

		if (test.failure) results.failures.push(test);

		return this;
	};

	def.report = function (callback) {
		callback = callback || function () {};

		return this.reportSpec(callback, this.newResults());
	};

	function add (spec) {
		for (var i = 0, l = arguments.length; i < l; i += 1)
			context.addSpec(arguments[i]);

		return context;
	}

	function describe (name, options, block) {
		return context.addSpec(new Spec(name, options, block));
	}

	function test (name, options, block) {
		return context.addTest(name, options, block);
	}

	function _describe (name, options, block) {
		return context.focusSpec(context.addSpec(new Spec(name, options, block)));
	}

	function _test (name, options, block) {
		return context.focusTest(context.addTest(name, options, block));
	}

	function option (name) {
		return function (value) {
			context.options[name] = value;
		}
	}

	function idle () {}

	def.api = {};

	def.api.spec = {
		describe: describe,
		context: describe,

		after: option('afterSpec'),
		before: option('beforeSpec'),

		afterEach: option('afterTest'),
		beforeEach: option('beforeTest'),

		add: add,

		test: test,
		it: test,

		_describe: _describe,
		_context: _describe,

		_test: _test,
		_it: _test,

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

	def.api.test = {
		should: should,
		expect: expect,
		assert: assert,
		sinon: sinon
	};

	merge(def, def.api.spec);
	merge(def, def.api.test);
});
