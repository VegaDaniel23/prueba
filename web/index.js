var express = require('express');
var multer  = require('multer');
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var mktemp = require('mktemp');
var Codec = require('codec.node').Codec;
assert(Codec);

var upload = multer({ dest: '/tmp' });

var app = express();

app.use(express.static('static'));

function sendErr(res, err) {
	console.error('Error: %s', err);
	return res.status(500).send({ message: err });
}

function getFilesizeInBytes(filename) {
	var stats = fs.statSync(filename);
	var fileSizeInBytes = stats["size"];
	return fileSizeInBytes;
}

function onCompressed(res, original, dest, result) {
	fs.unlink(original);
	if (result) {
		var id = path.basename(dest,path.extname(dest));
		var obj = {
			dest: id,
			len: getFilesizeInBytes(dest)
		};
		res.status(200).send(obj);
		console.log('Send result: obj=%j', obj );
	}
	else {
		sendErr(res, 'Encode fails');
	}
	console.log( "Result end: result=%d", result );
}

// Quality validation
function getQuality(quality) {
	if(quality && quality.match(/^\d+$/)) {
		var q = parseInt(quality);
		if (q > 0 && q < 100) {
			return q;
		};
	}
	return 95;
}

app.post('/process', upload.single('upl'), function(req, res) {
	console.log('Process received file=%j query=%j', req.file, req.query);

	if (req.file.mimetype === 'image/jpeg') {
		var codec = new Codec();

		mktemp.createFile('/tmp/XXXXXXXXXXXXXXXX.jpg').then(function(dest) {
			var alghoritm = req.query.alg || 'haar';
			var original = req.file.path;
			var action = req.query.action;
			var callback = onCompressed.bind(null, res, original, dest);

			var quality = getQuality(req.query.quality);
			var deblur = (req.query.deblur === '1');

			console.log('Using tmp file %s', dest);

			if (action === 'compress') {
				console.log('Encoding using alghoritm %s and quality %s', alghoritm, quality);
				codec.encode(original, dest, alghoritm, quality, callback);
			}
			else {
				console.log('Decoding using alghoritm %s and quality %s with deblur=%d', alghoritm, quality, deblur);
				codec.decode(original, dest, alghoritm, quality, deblur, callback);
			}
		})
		.catch(function(err) {
			sendErr(res, err.message);
		});
	}
	else {
		sendErr(res, 'Mimetype ' + req.file.mimetype + ' not supported');
	}
});

app.post('/download', upload.single('upl'), function(req, res) {
	console.log('Download received file=%j', req.query);
	try {
		var id = req.query.dest;
		var dst = path.join( '/tmp', id + '.jpg' );
		fs.readFile( dst, function(err, data) {
			if (!err) {
				res.send(data.toString('base64'));

				// Remove tmp files
				fs.unlink(dst);
			}
			else {
				sendErr(res, err.message);
			}
		});

	} catch(err) {
		sendErr( res, 'Invalid file to download!' );
	}
});

var server = app.listen(3000, function () {
	console.log('App listening at port %s', server.address().port);
});
