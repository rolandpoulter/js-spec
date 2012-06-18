var express = require('express');

var app = express.createServer().
	use(express.logger('dev')).
	use(express.directory(__dirname + '/../')).
	use(express['static'](__dirname + '/../')).
	listen(3000);