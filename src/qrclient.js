module.exports = function() {
  var worker = new Worker('/scripts/jsqrcode/qrworker.js');
  var barcodeDetector;
  var barcodeDetectorErrored = false;

  var currentCallback;
  var img = new Image();

  this.decode = function(context, callback) {
    if('BarcodeDetector' in window && !barcodeDetectorErrored) {
      barcodeDetector = new BarcodeDetector();
      img.src = context.canvas.toDataURL();
      //barcodeDetector.detect(context.canvas)
      barcodeDetector.detect(img)
      .then(barcodes => {
        // return the first barcode.
        if(barcodes.length > 0) {
          callback(barcodes[0]);
        }
        else {
          callback();
        }
      })
      .catch(err => {
        // don't use the detector... it is erroring.
        barcodeDetectorErrored = true;
        callback();
        console.error(err)
      });
    }
    else {
      // A frame has been captured.
      try {
        var canvas = context.canvas;
        var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage(imageData);
      }
      catch(err) {
        console.error(err);
      }

      currentCallback = callback;
    }
  };

  worker.onmessage = function(e) {
    if(currentCallback) {
      currentCallback(e.data);
    }
  };
 };
