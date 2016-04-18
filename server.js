var port = process.env.PORT || 3000;
var http = require('http');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static')("./");

var server = http.createServer(function(req, res) {
	var done = finalhandler(req, res);
	console.log(req.url);
	serveStatic(req, res, done);
});

server.listen(port);
console.log('listening on port', port);