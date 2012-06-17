var BoxJS = require('bxjs'),
    path = require('path');

module.exports = new BoxJS({
	name: 'Spec',
	main: './lib/Spec.js',
	from: path.resolve(__dirname + '/../'),
	watch: true,
	write: path.resolve(__dirname + '/../Spec.js'),
	uglify: path.resolve(__dirname + '/../Spec.min.js'),
	header: '// ' + Date(),
	footer: '// ' + Date(),
	apiName: '_',
	verbose: false,
	watcher: logRebuilt
}, logRebuilt);

function logRebuilt (err) {
	if (err) console.error(err);

	console.log('Re-built Spec.js');
}
