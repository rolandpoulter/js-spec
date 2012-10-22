var BoxJS = require('bxjs'),
    path = require('path');

var builder = new BoxJS({
	//name: 'Spec',
	//main: './lib/Spec.dom.js',
	from: path.resolve(__dirname + '/../')//,
	//watch: true,
	//write: path.resolve(__dirname + '/../Spec.js'),
	//header: '// ' + Date(),
	//footer: '// ' + Date(),
	//apiName: '_'//,
	//verbose: false//,
	//watcher: logRebuilt
});//, logRebuilt);

module.exports = builder;

console.log('building.');

builder.require('./lib/Spec.dom.js').process(function (error) {
	if (error) throw error;

	console.log('processed.');

	builder.compile(function (error) {
		if (error) throw error;

		console.log('compiled.')

		builder.write(__dirname + '/../Spec.js', function (error) {
			if (error) throw error;

			console.log('done.');
		});
	})
})

/*
function logRebuilt (err) {
	if (err) console.error(err.stack);

	console.log('Re-built Spec.js');
}
*/