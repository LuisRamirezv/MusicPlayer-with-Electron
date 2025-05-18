// preload.js
// Import necessary Electron modules
const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('musicAPI', {
  // Media control actions (play, pause, etc.)
  controlMedia: (action, state) => ipcRenderer.send(action, state),

  // Window control actions (minimize, maximize, close)
  controlWindow: (action) => ipcRenderer.send('window-control', action),

  // Fetch the list of songs from the main process
  getSongs: () => ipcRenderer.invoke('get-songs'),

  // Allow the user to select a folder
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Listen for media control events from the main process
  onMediaControl: (callback) => {
    ipcRenderer.on('media-control', (event, action) => {
      callback(action);
    });
  },

  // Listen for track change events from the main process
  onTrackChanged: (callback) => {
    ipcRenderer.on('track-changed', (event, trackInfo) => {
      callback(trackInfo);
    });
  },

  // Notify the main process of a track change
  changeTrack: (trackInfo) => {
    ipcRenderer.send('track-changed', trackInfo);
  },

  // Notify the main process of the currently playing song
  notifySong: (title) => ipcRenderer.send("notify-song", title)
});

