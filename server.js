var port = process.env.PORT || 3000;
var http = require('http');
var url  = require('url');

var finalhandler = require('finalhandler');
var serveStatic = require('serve-static')("./");

var server = http.createServer(function(req, res) {
	console.log(req.url);

	var done = finalhandler(req, res);
	var urlParts = url.parse(req.url);

	switch (urlParts.path) {
		case '/':
			res.writeHead(301, {Location: '/joust/'})
			res.end();
			break;
		default:
			serveStatic(req, res, done);
	}
})
.listen(port);

console.log('listening on port', port);
