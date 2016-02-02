(function() {
	var requestAnimationFrame =
		window.requestAnimationFrame || window.mozRequestAnimationFrame ||
		window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
		window.requestAnimationFrame = requestAnimationFrame;
})();


function readURL(input, cbk) {
	if (input.files && input.files[0]) {
		var file = input.files[0];
		var reader = new FileReader();

		reader.onload = function(evt) {
			cbk(undefined, {
				name: file.name,
				size: file.size,
				data: evt.target.result
			});
		}

		reader.onerror = cbk;

		reader.readAsDataURL(file);
	}
}

function formatBytes(bytes) {
	var fixed = 2;
	if(bytes < 1024) return bytes + " Bytes";
	else if(bytes < 1048576) return (bytes / 1024).toFixed(fixed) + " KB";
	else return(bytes / 1048576).toFixed(fixed) + " MB";
};

function animProgress(el, current, count, onStep, transform) {
	return new Promise(function(resolve, reject) {
		requestAnimationFrame(function() {
			var width = transform ? transform(current) : current;

			el.find(".progress-bar").css("width", width + "%");
			el.find(".progressCounter").html(Math.floor(current) + "%");

			if (onStep) {
				onStep(current, width);
			}

			if (current < count) {
				resolve(animProgress(el, current + 1, count, onStep, transform));
			}
			else {
				resolve(current);
			}
		});
	})
}

function showComparation(before, after, action) {
	var imgWrapper = $("#result").find(".wrapper");
	compare(imgWrapper, imgWrapper.width(), imgWrapper.height());

	if (action === 'compress') {
		$('.infos').css('display', 'block');
		var val = 100 - (after / before * 100).toFixed(0);
		animProgress($(".infos"), 0, Math.abs(val)).then(function() {
			$('.infos span').text(val + '% Compressed');
		});
	}
	else {
		$('.infos').css('display', 'none');
	}

	var bText = action === 'compress' || action === 'superresolution'? 'Original' : 'Compressed';
	$('.labelC.before').find('.l').text(bText);
	$('.labelC.before').find('.size').text(formatBytes(before));

	var aText = action === 'compress' ? 'Compressed' : (action === 'superresolution'? 'Superresolution' : 'Decompressed');
	$('.labelC.after').find('.l').text(aText);
	$('.labelC.after').find('.size').text(formatBytes(after));
}

function getURIParameter(param, asArray) {
	return document.location.search.substring(1).split('&').reduce(function(p,c) {
		var parts = c.split('=', 2).map(function(param) { return decodeURIComponent(param); });
		if(parts.length == 0 || parts[0] != param) return (p instanceof Array) && !asArray ? null : p;
		return asArray ? p.concat(parts.concat(true)[1]) : parts.concat(true)[1];
	}, []);
}

function b64toBlob(b64Data, contentType, sliceSize) {
	contentType = contentType || '';
	sliceSize = sliceSize || 512;

	var byteCharacters = atob(b64Data);
	var byteArrays = [];

	for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		var slice = byteCharacters.slice(offset, offset + sliceSize);

		var byteNumbers = new Array(slice.length);
		for (var i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		var byteArray = new Uint8Array(byteNumbers);

		byteArrays.push(byteArray);
	}

	var blob = new Blob(byteArrays, {type: contentType});
	return blob;
}

function formatName(name, compress, deblur) {
	var idx = name.lastIndexOf('.');
	var opts = compress? 'c' : (deblur? 'd' : 'b');
	return name.substring(0, idx) + opts + name.substring(idx, name.length);
}

function setImg(el, data) {
	el.css('background-image', 'url(' + data + ')');
}

function showResult(action, deblur, file, processed) {
	console.log( 'showResult' );

	var progress = $('.upload-progress-container');
	progress.find('.label').html('Downloading...');

	var opts = {
		type: 'POST',
		contentType: false,
		processData: false,
		xhr: createxhr
	}

	opts.url = '/download?dest=' + processed.dest;

	$.ajax(opts)
		.done(showDownload.bind(undefined, action, deblur, file))
		.fail(function(xhr, st, message) {
			var msg;
			try {
				var jsonResponse = JSON.parse(xhr.responseText);
				msg = jsonResponse.message;
			}
			catch(err) {
				msg = 'Bad server response';
			}

			showError(message + (msg? (': ' + msg): ''));
		});
}

function showDownload(action, deblur, file, processed) {
	console.log( 'showDownload' );

	$('#result').css('display', 'flex');
	$('.image-container').css('display', 'none');
	setVisibility($('.actions-panel').find('.actions'), false);

	var after = $('#after');
	var before = $('#before');

	var isCompress = action === 'compress';

	var preocessedSize = processed.length * 3/4; // TODO: is this right?
	after[0].onload = showComparation.bind(null, file.size, preocessedSize, action);

	before.attr('src', file.data);
	after.attr('src', 'data:img/jpeg;base64,' + processed);

	showComparation(file.size, preocessedSize, action);

	var download = document.getElementById('download');
	var blob = b64toBlob(processed, 'image/jpeg');
	$("#download").click(function(e) {
		if (navigator.appVersion.toString().indexOf('.NET') > 0) {
			e.preventDefault();
			window.navigator.msSaveBlob(blob, formatName(file.name, isCompress, deblur));
		}
	});

	download.href = URL.createObjectURL(blob);
	download.download = formatName(file.name, isCompress, deblur);
	console.log( 'showDownload end' );
}

var actionName = {
	compress: 'Compress photo',
	decompress: 'Decompress photo',
	superresolution: 'Superresolution',
};

function setVisibility(el, visible) {
	if (visible) {
		el.css('display', 'flex');
		el.css('display', 'ms-flex');
	}
	else {
		el.css('display', 'none');
	}
}

function showConfiguration(action, file, formData) {
	var config = $('#config');
	setVisibility($('.upload-progress-container'), false);
	setVisibility(config, true);

	$('#deblur-option').css('visibility', action === 'decompress' ? 'visible' : 'hidden');
	var deblur = $('#deblur');
	deblur.prop('checked', false);

	var preview = $(".img-preview");
	setImg(preview, file.data);
	preview.hide().show(0);

	var button = config.find('#config-action');
	button.find('span').html(actionName[action]);
	button.find('img').attr('src', 'imgs/' + action + '.png');
	button.off('click');
	button.click(function() {
		upload(action, file, formData, $('#slider').slider('value'), deblur.prop('checked'));
	});
}

var DEFAULT_QUALITY = 95;

function hideConfiguration() {
	$('#config').css('display', 'none');
	$('#slider').slider('value' , DEFAULT_QUALITY);
	$('.quality').find('.label').html('Quality:' + DEFAULT_QUALITY);
}

function showActions() {
	hideConfiguration();
	setVisibility($('#result'), false);
	setVisibility($('.actions-panel'), true);
	setVisibility($('.actions-panel').find('.actions'), true);
	setVisibility($('.image-container'), true);
}

function animUploadProgress(progress, base, percentComplete) {
	return animProgress(progress, base, percentComplete).then(function(value) {
		if (value >= 100) {
			progress.find('.label').html('Processing...');
			progress.find('.progressCounter').html('');
			progress.find('.progress-bar').css('animation', 'waitingInfinite 1s linear 0s infinite');
		}
	});
}

function showXHRProgress(progress) {
	var step = 0;
	var promise;
	return function(evt) {
		if (evt.lengthComputable) {
			var percentComplete = evt.loaded / evt.total * 100;
			console.log('Uploading %s%', percentComplete);

			var base = step;
			step = Math.floor(percentComplete);

			if (promise) {
				promise = promise.then(animUploadProgress.bind(undefined, progress, base, step));
			}
			else {
				setVisibility(progress, true);
				progress.find('.label').html('Uploading photo...');
				progress.find('.progress-bar').css('animation-name', 'none');
				progress.find('.progress-bar').css('animation-iteration-count', '1');
				promise = animUploadProgress(progress, base, percentComplete);
			}
		}
	}
}

function showError(message) {
	showActions();
	// TODO: More friendly message
	alert(message);
}

function createxhr() {
	var xhr = new window.XMLHttpRequest();
	var progress = $('.upload-progress-container');
	xhr.upload.addEventListener("progress", showXHRProgress(progress), false);
	return xhr;
}

function upload(action, file, formData, q, deblur) {
	var alg = getURIParameter('alg') || 'dct';
	var quality = q || getURIParameter('quality') || DEFAULT_QUALITY;

	var opts = {
		type: 'POST',
		data: formData,
		contentType: false,
		processData: false,
		xhr: createxhr
	}

	opts.url = '/process?action=' + action + '&alg=' + alg + '&quality=' + quality + '&deblur=' + (deblur? '1' : '0');

	$.ajax(opts)
		.done(showResult.bind(undefined, action, deblur, file))
		.fail(function(xhr, st, message) {
			var msg;
			try {
				var jsonResponse = JSON.parse(xhr.responseText);
				msg = jsonResponse.message;
			}
			catch(err) {
				msg = 'Bad server response';
			}

			showError(message + (msg? (': ' + msg): ''));
		});
}

function compare(container, maxW, maxH) {
	var beforeImg = container.find("img:first");
	var afterImg = container.find("img:last");

	var slider = container.find(".twentytwenty-handle");

	var w = afterImg.width();
	var h = afterImg.height();

	function adjustSlider(x) {
		var offset = afterImg.offset().left - container.offset().left;
		slider.css("left", offset + x);
		afterImg.css("clip", "rect(0px," + w + "," + h + ","  + x + "px)");
	}

	var minW = (maxW / 2) + 'px';
	var minH = (maxH / 2) + 'px';

	if (h > maxH) {
		h = maxH + 'px';
		afterImg.css('max-height', h);
	}

	if (w > maxW) {
		w = maxW + 'px';
		afterImg.css('max-width', w);
	}

	container.css('min-width', minW);

	var hpx = afterImg.height() + 'px';
	var wpx = afterImg.width() + 'px';
	beforeImg.css("height", hpx);
	beforeImg.css("width", wpx);

	var wrapper = container.find('.img-wrapper');
	wrapper.css("height", hpx);
	wrapper.css("width", wpx);

	container.css("height", hpx);
	container.css("width", "100%");

	// Center the slider
	adjustSlider(wrapper.width() / 2);

	container.mousemove(function(evt) {
		if (evt.target === afterImg[0] || evt.target === beforeImg[0]) {
			adjustSlider(evt.offsetX);
		}
	});
}
