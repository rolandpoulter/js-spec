var Spec = require('./lib/Spec');

Spec.describe('spec', function () {
	console.log('describe a spec');

	before(function (done) {
		console.log('before spec');

		should();

		done();
	});

	after(function (done) {
		console.log('after spec');

		done();
	});

	beforeEach(function (done) {
		console.log('before test in spec');

		done();
	});

	afterEach(function (done) {
		console.log('after test in spec');

		done();
	});

	it('should run a test for spec', function (done) {

		console.log('spec test');

		true.should.be.ok;

		done();
	});

	xit('should timeout a unfinished test', function (done) {})

	describe('a description', function () {
		console.log('describe a description');

		before(function () {
			console.log('before a description');
		});

		after(function () {
			console.log('after a description');
		});

		beforeEach(function () {
			console.log('before test in a description');
		});

		afterEach(function () {
			console.log('after test in a description');
		});

		it('should run a test for a description', function () {
			console.log('a description test');

			true.should.be.ok;
		});
	});

}).report(function (results) {
	console.log('exit', results);
});
