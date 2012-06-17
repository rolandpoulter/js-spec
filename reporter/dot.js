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
		results.failures.forEach(function (test) {
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

		charm.
				write('\n\n').
				move(2, 1).
				foreground(results.failures.length ? 'red' : 'green').
				write(results.failures.length.toString()).
				display('reset').
				write(' failure' + (results.failures.length !== 1 ? 's' : '')).
				write('\n\n');

		process.exit(results.failures.length);
	});
};
