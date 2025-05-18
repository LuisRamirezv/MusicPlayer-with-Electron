// Import necessary Electron modules and Node.js modules
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// Declare a variable to hold the main application window
let win;

// Function to create the main application window
const createWindow = () => {
  win = new BrowserWindow({
    width: 950,
    height: 715,
    frame: false,
    resizable: true,
    transparent: true,
    icon: path.join(__dirname, 'image/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  });

  // Load the main HTML file into the window
  win.loadFile('index.html');

  // Add media control buttons to the Windows taskbar
  win.setThumbarButtons([
    {
      tooltip: 'Previous',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'prev.png')),
      click: () => win.webContents.send('media-control', 'previous')
    },
    {
      tooltip: 'Play/Pause',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'play.png')),
      click: () => win.webContents.send('media-control', 'play-pause')
    },
    {
      tooltip: 'Next',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'next.png')),
      click: () => win.webContents.send('media-control', 'next')
    }
  ]);
};

// Handle file loading from the music folder
ipcMain.handle('get-songs', async () => {
  const musicDir = path.join(__dirname, 'music');
  const files = fs.readdirSync(musicDir);
  return files.filter(file => file.match(/\.(mp3|wav|ogg)$/i));
});

// Allow folder selection by the user
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'], // Allow selecting files and multiple selections
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] } // Filter for audio files
    ]
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths; // Return the selected file paths
});

// Listen for track change events and send notifications
ipcMain.on('track-changed', (event, trackInfo) => {
  // Create and show the notification
  const notification = new Notification({
    title: 'Track Changed',
    body: `Now playing: ${trackInfo.title} by ${trackInfo.artist}`,
    icon: path.join(__dirname, 'image/logo.png') // Optional: Customize the icon
  });

  notification.show();
});

// Update playback state and taskbar buttons
ipcMain.on('playback-state-changed', (event, isPlaying) => {
  win.setThumbarButtons([
    {
      tooltip: 'Previous',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'prev.png')),
      click: () => win.webContents.send('media-control', 'previous')
    },
    {
      tooltip: isPlaying ? 'Pause' : 'Play',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', isPlaying ? 'pause.png' : 'play.png')),
      click: () => win.webContents.send('media-control', 'play-pause')
    },
    {
      tooltip: 'Next',
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'next.png')),
      click: () => win.webContents.send('media-control', 'next')
    }
  ]);
});

// Initialize the application when ready
app.whenReady().then(() => {
  createWindow();

  // Recreate the window if all windows are closed
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle custom window controls (minimize, maximize, close)
let isCustomMaximized = false; // Track custom maximize state
let originalBounds; // Store original window bounds

ipcMain.on('window-control', (event, action) => {
  if (!win) return;

  switch (action) {
    case 'close':
      win.close();
      break;

    case 'minimize':
      win.minimize();
      break;

    case 'maximize':
      if (!isCustomMaximized) {
        originalBounds = win.getBounds(); // Save original size/position
        win.setSize(600, 150);            // Custom "maximized" size
        // win.center();                     // Optional: center the window
        isCustomMaximized = true;
      } else {
        win.setBounds(originalBounds);   // Restore original size/position
        isCustomMaximized = false;
      }
      break;
  }
});

// Quit the application when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Notify the user of the currently playing song
ipcMain.on("notify-song", (event, title) => {
  new Notification({
    title: "Now Playing",
    body: title,
    silent: true
  }).show();
});

