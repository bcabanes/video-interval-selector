var VideoIntervalSelector = function(selector, videoUrl, options) {
  if(!selector) throw new Error('A selector need to be provided');
  if(!videoUrl) throw new Error('A video url should be passed');

  this.prefix = 'VideoIntervalSelector';
  this.selector = selector;
  this.element = undefined;
  this.videoUrl = videoUrl;
  this.playing = false;
  this.eventHandlers = {};

  this.options = {
    autoPlay: false,
    hideVideo: true,
    muted: true,
    timeInterval: 5, // In seconds.
    width: 720,
    height: 350,
    showTimer: true
  };

  if (options) this.options = this.extendObject(this.options, options);

  this.init();
  console.log(this);
};

VideoIntervalSelector.prototype.events = new function() {
  var _triggers = {};

  this.on = function(event,callback) {
    if(!_triggers[event])
      _triggers[event] = [];
    _triggers[event].push( callback );
  };

  this.triggerHandler = function(event,params) {
    if(_triggers[event]) {
      for(i in _triggers[event])
        _triggers[event][i](params);
    }
  };
};

VideoIntervalSelector.prototype.init = function() {
  this.element = document.querySelector(this.selector);

  this.video = this.createVideo();
  this.canvasContainer = this.createCanvasContainer(this.options.width);
  this.canvas = this.createCanvas(this.options.width, this.options.height);
  this.timeline = this.createTimeline(20);
  if (this.options.timeInterval) {
    this.seeker = this.createSeeker(20);
    this.timeline.appendChild(this.seeker);
  }
  this.playButton = this.createPlayButton();
  this.pauseButton = this.createPauseButton();

  this.canvasContext = this.canvas.getContext('2d');

  this.element.appendChild(this.video);

  this.canvasContainer.appendChild(this.playButton);
  this.canvasContainer.appendChild(this.pauseButton);
  this.canvasContainer.appendChild(this.canvas);
  this.canvasContainer.appendChild(this.timeline);
  this.element.appendChild(this.canvasContainer);

  if (this.options.showTimer) {
    this.timer = this.createTimer();
    this.element.appendChild(this.timer);
  }

  this.playSeekerOnly = !!this.options.timeInterval;

  this.video.load();

  this.video.addEventListener('loadeddata', function() {
    if (typeof this.options.timeInterval === 'number' && this.options.timeInterval > this.video.duration) {
      this.events.triggerHandler('error', { errorType: 'videoTooShort' });
      this.events.triggerHandler('videoTooShort');
      return this.destroy();
    }

    // Continue.
    this.events.triggerHandler('initialized');
    this.showElement(this.playButton);
    this.bindEvents();
  }.bind(this));
};
VideoIntervalSelector.prototype.bindEvents = function() {
  // Canvas events.
  this.canvas.addEventListener('click', this.playPause.bind(this, this.video));
  this.canvas.addEventListener('touchend', this.playPause.bind(this, this.video));

  // Timeline events.
  if (!this.options.timeInterval) {
    this.timeline.addEventListener('click', this.seekTo.bind(this));
  }

  // Seeker events.
  if (this.options.timeInterval) {
    this.seeker.addEventListener('mousedown', this.seekerDragInit.bind(this, this.seeker));
    this.seeker.addEventListener('touchstart', this.seekerDragInit.bind(this, this.seeker));
  }

  // Video events.
  this.video.addEventListener('canplay', function() {
    this.updateFrame(this.video, this.canvasContext);
    if (this.options.timeInterval)
      this.seeker.style.width = this.getSeekerWidth(this.options.timeInterval, this.video, this.timeline) + 'px';
  }.bind(this));
  this.video.addEventListener('timeupdate', this.updateFrame.bind(this, this.video, this.canvasContext));

  // Keyboard events.
  document.addEventListener('keydown', this.eventHandlers.keyboard = this.keyboardUpdateSeeker.bind(this));

  if (this.options.autoPlay) this.play(this.video);
};

VideoIntervalSelector.prototype.updateFrame = function(video, context) {
  this.drawFrame(video, context, this.options.width, this.options.height);
  this.updateTimeline(video.currentTime, video.duration);
  if (this.playSeekerOnly) this.updateSeekerIndicator(video.currentTime, this.getSeekerDurationLimit());
  this.updateTimer(video.currentTime, video.duration);
  if (video.paused || video.ended) return false;
  if (this.playSeekerOnly && this.getSeekerDurationLimit() <= video.currentTime) return this.stop(video);
  requestAnimationFrame(this.updateFrame.bind(this, video, context));
};
VideoIntervalSelector.prototype.drawFrame = function(video, context, width, height) {
  context.drawImage(video, 0, 0, width, height);
};
VideoIntervalSelector.prototype.updateTimeline = function(currentTime, duration) {
  var percentage = (currentTime * 100 / duration).toFixed(2);
  this.timeline.firstChild.style.width = percentage + '%';
};
VideoIntervalSelector.prototype.updateTimer = function(currentTime, duration) {
  this.timer.innerHTML = this.getTimeMMSS(currentTime) + ' / ' + this.getTimeMMSS(duration);
};
VideoIntervalSelector.prototype.getTimeMMSS = function(seconds) {
  var date = new Date(null);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
};
VideoIntervalSelector.prototype.play = function(video) {
  this.playing = true;
  this.hideElement(this.pauseButton);
  this.hideElement(this.playButton);
  // if (this.playSeekerOnly) this.seekTo({clientX: this.seeker.offsetLeft});
  video.play();
};
VideoIntervalSelector.prototype.pause = function(video) {
  this.playing = false;
  this.hideElement(this.playButton);
  this.showElement(this.pauseButton);
  video.pause();
};
VideoIntervalSelector.prototype.stop = function(video) {
  this.playing = false;
  this.hideElement(this.pauseButton);
  this.showElement(this.playButton);
  video.pause();

  if (this.playSeekerOnly) return video.currentTime = this.getSeekerDurationStart();
  return video.currentTime = 0;
};
VideoIntervalSelector.prototype.playPause = function(video) {
  if (this.playing) return this.pause(video);
  return this.play(video);
};
VideoIntervalSelector.prototype.seekTo = function(event) {
  var offset;
  if (this.playSeekerOnly) {
    offset = this.seeker.offsetLeft;
  } else {
    offset = event.clientX - this.getOffset(this.timeline).left;
  }

  var percentage = offset / this.timeline.offsetWidth;
  this.video.currentTime = this.video.duration * percentage;
};

VideoIntervalSelector.prototype.getSeekerWidth = function(duration, video, timeline) {
  var percentage = ((duration * 100) / video.duration).toFixed(4);
  return timeline.clientWidth * (percentage / 100);
};
VideoIntervalSelector.prototype.updateSeekerPosition = function(seeker, offset) {
  seeker.style.left = offset + 'px';
};
VideoIntervalSelector.prototype.updateSeekerIndicator = function(currentTime, timeLimit) {
  currentTime = currentTime - this.getSeekerDurationStart();
  timeLimit = timeLimit - this.getSeekerDurationStart();
  var percentage = (currentTime * 100 / timeLimit).toFixed(4);
  this.seeker.firstChild.style.width = percentage + '%';
};
VideoIntervalSelector.prototype.getSeekerDurationStart = function() {
  var offset = this.seeker.offsetLeft;
  var percentage = offset / this.timeline.offsetWidth;
  return this.video.duration * percentage;
};
VideoIntervalSelector.prototype.getSeekerDurationLimit = function() {
  var offset = this.seeker.offsetLeft + this.seeker.clientWidth;
  var percentage = offset / this.timeline.offsetWidth;
  return this.video.duration * percentage;
};

// Used most jQuery'offset() method code.
VideoIntervalSelector.prototype.getOffset = function(element) {
  var docElem, rect, doc;
  if (!element) throw new Error('getOffset: Need DOM element passed');

  rect = element.getBoundingClientRect();

  // Make sure element is not hidden (display:none) or disconnected.
  if (!rect.width && !rect.height && !element.getClientRects().length)
    throw new Error('getOffset: element is hidden (display:none) or disconnected');

  doc = element.ownerDocument;
  docElem = doc.documentElement;
  return {
    top: rect.top + window.pageYOffset - docElem.clientTop,
    left: rect.left + window.pageXOffset - docElem.clientLeft
  };
};

VideoIntervalSelector.prototype.createVideo = function() {
  var video = document.createElement('video');
  video.id = this.prefix + '-player';
  video.src = this.videoUrl;
  video.controls = true;
  video.muted = this.options.muted;
  if (this.options.hideVideo) video.style.display = 'none';
  return video;
};
VideoIntervalSelector.prototype.createCanvasContainer = function(width) {
  var container = document.createElement('div');
  container.id = this.prefix + '-canvas-container';
  if (width) {
    container.style.width = width + 'px';
  }

  return container;
};
VideoIntervalSelector.prototype.createCanvas = function(width, height) {
  var canvas = document.createElement('canvas');
  canvas.id = this.prefix + '-canvas';
  if (width && height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
};
VideoIntervalSelector.prototype.createTimeline = function() {
  var timeline = document.createElement('div');
  timeline.id = this.prefix + '-timeline';

  var timelineIndicator = document.createElement('div');
  timelineIndicator.id = this.prefix + '-timeline-indicator';

  timeline.appendChild(timelineIndicator);
  return timeline;
};
VideoIntervalSelector.prototype.createSeeker = function() {
  var seeker = document.createElement('div');
  seeker.id = this.prefix + '-timeline-seeker';

  var seekerIndicator = document.createElement('div');
  seekerIndicator.id = this.prefix + '-timeline-seeker-indicator';

  seeker.appendChild(seekerIndicator);
  return seeker;
};
VideoIntervalSelector.prototype.createPlayButton = function() {
  var playButton = document.createElement('div');
  playButton.id = this.prefix + '-play-button';
  playButton.innerHTML = 'play';
  playButton.style.display = 'none';
  return playButton;
};
VideoIntervalSelector.prototype.createPauseButton = function() {
  var pauseButton = document.createElement('div');
  pauseButton.id = this.prefix + '-pause-button';
  pauseButton.innerHTML = 'pause';
  pauseButton.style.display = 'none';
  return pauseButton;
};
VideoIntervalSelector.prototype.createTimer = function() {
  var timer = document.createElement('div');
  timer.id = this.prefix + '-timer';
  return timer;
};
VideoIntervalSelector.prototype.showElement = function(element) {
  element.style.display = 'block';
};
VideoIntervalSelector.prototype.hideElement = function(element) {
  element.style.display = 'none';
};

VideoIntervalSelector.prototype.seekerDragInit = function(element, event) {
  event.preventDefault();

  if (event.touches) this.dragInfo = { diffX: event.touches[0].clientX - element.offsetLeft };
    else this.dragInfo = { diffX: event.clientX - element.offsetLeft };

  this.eventHandlers.dragMoveFunction = this.seekerDragMove.bind(this, element);
  this.eventHandlers.dragUpFunction = this.seekerDragStop.bind(this, element);
  this.eventHandlers.dragMoveFunction = this.seekerDragMove.bind(this, element);
  this.eventHandlers.dragUpFunction = this.seekerDragStop.bind(this, element);
  this.eventHandlers.dragUpFunction = this.seekerDragStop.bind(this, element);

  document.addEventListener('mousemove', this.eventHandlers.dragMoveFunction);
  document.addEventListener('mouseup', this.eventHandlers.dragUpFunction);
  document.addEventListener('touchmove', this.eventHandlers.dragMoveFunction);
  document.addEventListener('touchend', this.eventHandlers.dragUpFunction);
  document.addEventListener('touchcancel', this.eventHandlers.dragUpFunction);
};
VideoIntervalSelector.prototype.seekerDragMove = function(element, event) {
  event.preventDefault();

  var left;
  if (event.touches) left = parseInt(event.touches[0].clientX - this.dragInfo.diffX);
    else left = parseInt(event.clientX - this.dragInfo.diffX);

  var parentLimit = (element.parentNode.clientLeft + element.parentNode.clientWidth) - element.clientWidth;

  // Check for boundaries.
  if (left < element.parentNode.clientLeft) left = element.parentNode.clientLeft;
  if (left > parentLimit) left = parentLimit;

  // Set new positions.
  element.style.left = left + 'px';

  // Seek to.
  this.seekTo({ clientX: element.offsetLeft + 10 });
};
VideoIntervalSelector.prototype.seekerDragStop = function(element, event) {
  event.preventDefault();

  document.removeEventListener('mousemove', this.eventHandlers.dragMoveFunction);
  document.removeEventListener('mouseup', this.eventHandlers.dragUpFunction);
  document.removeEventListener('touchmove', this.eventHandlers.dragMoveFunction);
  document.removeEventListener('touchend', this.eventHandlers.dragUpFunction);
  document.removeEventListener('touchcancel', this.eventHandlers.dragUpFunction);
};

VideoIntervalSelector.prototype.keyboardUpdateSeeker = function(event) {
  var seekerOffset, step = 1;
  if (event.keyCode === 32) return this.playPause(this.video);
  if (event.keyCode === 37 && this.seeker.offsetLeft - step > 0) seekerOffset = this.seeker.offsetLeft - step;
  if (event.keyCode === 39 && this.seeker.offsetLeft + step < this.timeline.clientWidth) seekerOffset = this.seeker.offsetLeft + step;
  if (!seekerOffset) return;
  this.updateSeekerPosition(this.seeker, seekerOffset);
  this.seekTo({ clientX: seekerOffset + 10 });
};

VideoIntervalSelector.prototype.getSeekerStartTime = function() {
  var percentage = this.seeker.offsetLeft / this.timeline.offsetWidth;
  return this.video.duration * percentage;
};
VideoIntervalSelector.prototype.getData = function() {
  return {
    startTime: this.getSeekerStartTime(),
    endTime: this.getSeekerStartTime() + this.options.timeInterval,
    timeInterval: this.options.timeInterval
  };
};

VideoIntervalSelector.prototype.extendObject = function(out) {
  out = out || {};
  for (var i = 1; i < arguments.length; i++) {
    if (!arguments[i]) continue;

    for (var key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key)) out[key] = arguments[i][key];
    }
  }
  return out;
};

VideoIntervalSelector.prototype.destroy = function() {

  // Remove all event listener on document.
  document.removeEventListener('mousemove', this.eventHandlers.dragMoveFunction);
  document.removeEventListener('mouseup', this.eventHandlers.dragUpFunction);
  document.removeEventListener('touchmove', this.eventHandlers.dragMoveFunction);
  document.removeEventListener('touchend', this.eventHandlers.dragUpFunction);
  document.removeEventListener('keydown', this.eventHandlers.keyboard);

  // Reset element to original state.
  this.element.innerHTML = '';
  delete this.element;

  // Delete generated DOM element.
  delete this.canvas;
  delete this.canvasContainer;
  delete this.canvasContext;
  delete this.dragInfo;
  delete this.seeker;
  delete this.timeline;
  delete this.timer;
  delete this.video;

  this.eventHandlers = {};
};

(function() {
  // var frameSelector = new VideoIntervalSelector(document.getElementById('video-frame-selector'), './video-small.mp4', {
  // timeInterval: 0 });
  var frameSelector;
  var logContainer = document.createElement('div').appendChild(document.createElement('pre'));
  logContainer.style.display = 'none';

  // Get data button.
  var getDataButton = document.createElement('button');
  getDataButton.innerHTML = 'Get data';
  getDataButton.addEventListener('click', function() {
    logContainer.style.display = 'block';
    logContainer.innerHTML = JSON.stringify(frameSelector.getData(), null, ' ');
  });

  document.getElementsByClassName('misc')[0].appendChild(getDataButton);
  document.getElementsByClassName('misc')[0].appendChild(logContainer);

  // File input.
  var inputFile = document.createElement('input');
  inputFile.type = 'file';
  inputFile.addEventListener('change', handleFiles);
  document.getElementsByClassName('misc')[0].appendChild(inputFile);
  function handleFiles() {
    var file = this.files[0]; /* now you can work with the file list */
    var allowedType = /^video\/mp4/;

    if (!allowedType.test(file.type)) throw new Error('Wrong file type, must be video/mp4');

    var reader = new FileReader();
    reader.onload = function(e) {
      frameSelector = new VideoIntervalSelector('#video-interval-selector', window.URL.createObjectURL(file), { timeInterval: 10 });
      window.URL.revokeObjectURL(file);

      // Show custom errors.
      frameSelector.events.on('error', function(error) {
        switch(error.errorType) {
          case 'videoTooShort': alert('Your video is too short regarding your time interval.');
            break;
          default:
            alert(error.errorType);
        }
      });

      // When initialized.
      frameSelector.events.on('initialized', function() { createSwitchToPlayer(frameSelector); });
    };
    reader.readAsDataURL(file);
  }

  // Switch player configuration.
  function createSwitchToPlayer(frameSelector) {
    var checkboxChoice = document.createElement('input');
    checkboxChoice.id = 'switch';
    checkboxChoice.type = 'checkbox';
    checkboxChoice.addEventListener('change', function() {
      if (frameSelector) frameSelector.destroy();
      frameSelector = undefined;
      if (this.checked) frameSelector = new VideoIntervalSelector('#video-interval-selector', './video.mp4', { timeInterval: null });
      else frameSelector = new VideoIntervalSelector('#video-interval-selector', './video-small.mp4', { timeInterval: 40 });
    });
    var checkboxLabel = document.createElement('label');
    checkboxLabel.for = checkboxChoice.id;
    checkboxLabel.innerHTML = 'Switch player ';
    checkboxLabel.appendChild(checkboxChoice);
    document.getElementsByClassName('misc')[0].appendChild(checkboxLabel);
  }

})();
