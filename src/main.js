var _ = require('lodash');
var $ = require ('jquery');
var Perspective = require('perspectivejs');

var QRClient = require('./qrclient');
var lightning = require('./lightning');
var AvatarInit = require('./avatar');
var STARTING_WORD = 'NodeBots';
var AVATAR_SIZE = 300;
var AVATAR_PIC_SIZE = 100;
var MAX_CAM_SIZE = 800;
var qrScale = 2;
var canvas, img, context, video, start, streaming, detector, lastBC;
var colors = ['#26a9e0','#8a5d3b', '#37b34a', '#a6a8ab', '#f7921e', '#ff459f', '#90278e', '#ed1c24', '#f1f2f3', '#faec31'];
var lastUpdate = Date.now();
var avatar = AvatarInit(AVATAR_PIC_SIZE, 'set1_s.png');

var client = new QRClient();

function invertColor(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    // invert color components
    var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
        g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
        b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
    return '#' + padZero(r) + padZero(g) + padZero(b);
}

function scaleCorners(input, scale, ratio) {
  var pts = _.map(input, function(pt) {
    return {x: pt.x, y: pt.y};
  });

  pts[0].x -= pts[0].x * scale / ratio;
  pts[0].y -= pts[0].y * scale * ratio;
  pts[1].x += pts[1].x * scale / ratio;
  pts[1].y -= pts[1].y * scale * ratio;
  pts[2].x += pts[2].x * scale / ratio;
  pts[2].y += pts[2].y * scale * ratio;
  pts[3].x -= pts[3].x * scale / ratio;
  pts[3].y += pts[3].y * scale * ratio;

  //console.log('scaleCorners input', input, 'output', pts, scale, ratio);
  return pts;
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}



$(function() {

  var video = document.createElement('video');
  var videoCanvas = document.createElement('canvas');
  var videoCtx = videoCanvas.getContext('2d');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var avatarCanvas = document.createElement('canvas');
  avatarCanvas.height = AVATAR_SIZE;
  avatarCanvas.width = AVATAR_SIZE;
  var avatarCtx = avatarCanvas.getContext('2d');

  navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


  var constraints = {
    audio: false,
    video: {
      facingMode: 'environment'
    },
  };

  navigator.getMedia(constraints, function(stream) {
    if(navigator.mozGetUserMedia){
      video.mozSrcObject = stream;
    }
    else {
      var vu = window.URL || window.webkitURL;
      video.src = vu.createObjectURL(stream);
    }
    video.play();
  }, function(error) {
    console.error(error);
  });

  video.addEventListener('canplay', function(ev) {

    // console.log('video', video, video.videoHeight, video.videoWidth );
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('starting video dimentions', video.videoWidth, video.videoHeight);

    if(video.videoHeight > MAX_CAM_SIZE) {
      qrScale = video.videoHeight / MAX_CAM_SIZE;
    }
    else if(video.videoWidth > MAX_CAM_SIZE) {
      qrScale = video.videoWidth / MAX_CAM_SIZE;
    }

    videoCanvas.width = video.videoWidth / qrScale;
    videoCanvas.height = video.videoHeight / qrScale;

    console.log('scaled video dimentions', video.videoWidth, video.videoHeight);

    function render(bc) {
      ctx.drawImage(video, 0,0);
      // if(bc) {
      //   lastUpdate = Date.now();
      // }
      if(bc || lastBC) {
        var lc = lightning();
        lastBC = bc || lastBC;

        // drawImage(imageObj, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);

        avatarCtx.drawImage(lc, 100, 100, AVATAR_SIZE, AVATAR_SIZE, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        var buckets = avatar.render(lastBC.rawValue, avatarCtx);

        var points = lastBC.cornerPoints;

        var pers = new Perspective(ctx, avatarCanvas);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x * qrScale, points[0].y * qrScale);
        ctx.lineTo(points[1].x * qrScale, points[1].y * qrScale);
        ctx.lineTo(points[2].x * qrScale, points[2].y * qrScale);
        ctx.lineTo(points[3].x * qrScale, points[3].y * qrScale);
        ctx.lineTo(points[0].x * qrScale, points[0].y * qrScale);
        ctx.closePath();
        ctx.clip();
        pers.draw([
          [points[0].x * qrScale, points[0].y * qrScale],
          [points[1].x * qrScale, points[1].y * qrScale],
          [points[2].x * qrScale, points[2].y * qrScale],
          [points[3].x * qrScale, points[3].y * qrScale]

        ]);
        ctx.restore();


        var rotateRadians = Math.atan2(points[3].y - points[2].y, points[3].x - points[2].x) + Math.PI;
        var avgHeight = ((points[3].y - points[0].y) + (points[2].y - points[1].y)) / 2;

        var textX = (points[3].x * qrScale + points[2].x * qrScale) / 2;
        var textY = (points[3].y * qrScale + points[2].y * qrScale) / 2 + (0.4 * avgHeight);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(rotateRadians);
        ctx.translate(-textX, -textY);
        ctx.textAlign = "center";
        ctx.textBaseline = 'middle';
        ctx.font = Math.round((points[3].y - points[0].y) * 0.4) + 'px serif';
        ctx.fillStyle = colors[buckets[5]];
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = invertColor(colors[buckets[5]]);
        ctx.fillText(lastBC.rawValue, textX, textY);
        ctx.strokeText(lastBC.rawValue, textX, textY);
        ctx.restore();
      }


    }

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = timestamp - start;

      if(!lastBC || (Date.now() - lastUpdate > 100 )) {
        videoCtx.drawImage(video, 0,0, videoCanvas.width, videoCanvas.height);
        client.decode(videoCtx, function(bc) {
          lastUpdate = Date.now();
          render(bc);
        });

      }
      else {
        render(null);
      }
      window.requestAnimationFrame(step);

    }

    window.requestAnimationFrame(step);


  });





});
