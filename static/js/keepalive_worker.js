/* Wuvos Music Player - Background Unthrottled Worker Heartbeat */
let intervalId = null;

self.onmessage = function(e) {
  if (e.data === 'start') {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(function() {
      self.postMessage({ type: 'tick', timestamp: Date.now() });
    }, 1000);
  } else if (e.data === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
