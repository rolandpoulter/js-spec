/*jslint smarttabs:true*/

var newCharm = require('charm');
    //eyes = require('eyes');

module.exports = function (spec) {
	var charm = newCharm();

	charm.on('^C', process.exit);
	charm.pipe(process.stdout)

	charm.move(2, 1);

	spec.on('ran test', function (test) {
		charm.
			foreground(test.failure ? 'red' : 'green').
			write('.');
	});

	return spec.report(function (results) {
		//charm.write('\n');

		if (results.stack) {
			console.log(results.stack)
		}

		if (results.failures) results.failures.forEach(function (test) {
			var fullName = [],
			    parents = [],
			    name = test.options.name,
			    spec = test.options.spec;

			spec.enumParents(function (parent) {
				parents.unshift(parent);
			});

			charm.
				foreground('red').
				write('\n\n').
				move(2, 1);

			parents.forEach(function (parent) {
				fullName.push(parent.options.name);
			});

			fullName.push(name);

			charm.
				write(fullName.join(' ')).
				write('\n').
				move(4, 0);

			charm.
				display('reset').
				write(test.failure.message);

			//eyes.inspect(test.failure);
		});

		else results.failures = {length: 1};

		if (!isFinite(results.total)) results.total = 0;

		var failed = results.failures.length;

		charm.
				write('\n\n').
				move(2, 1).
				foreground(failed ? 'red' : 'green').
				write((failed ? failed : results.total - failed).toString()).
				write('/' + results.total).
				write(' ').
				write(failed ? 'failed' : 'passed').
				display('reset').
				write('\n\n');

		process.exit(results.failures.length);
	});
};
