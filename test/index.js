module.exports = require('spc').describe('Spec', function () {
	var Spec = require('../lib/Spec');

	before(function () {
		should();
	});
});

require('spc/reporter/dot')(module.exports);