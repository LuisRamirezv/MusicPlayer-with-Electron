// Get references to DOM elements
const audio = document.getElementById("audio");
const playButton = document.getElementById("play");
const pauseButton = document.getElementById("pause");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
const stopButton = document.getElementById("stop");
const songTitle = document.getElementById("song-title");
const seekBar = document.getElementById("seek-bar");
const volumeBar = document.getElementById("volume-bar");
const themeToggle = document.getElementById("theme-toggle");
const eqBars = document.querySelectorAll(".eq-bar");
const playlistEl = document.querySelector("#playlist ul");
const addFolderButton = document.getElementById("add-folder");
const volumeIcon = document.querySelector('.volume-icon');
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");
const lyricsDisplay = document.getElementById("lyrics");

// Initialize state variables
let isMuted = false;
let previousVolume = 0.5;
let isShuffle = false;
let isRepeat = false;

// Shuffle button toggle functionality
shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
});

// Repeat button toggle functionality
repeatBtn.addEventListener("click", () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle("active", isRepeat);
});

// Set up Web Audio API for equalizer and visualizer
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createMediaElementSource(audio);

// Equalizer filters
const bassEQ = audioContext.createBiquadFilter();
bassEQ.type = "lowshelf";
bassEQ.frequency.value = 200;

const midEQ = audioContext.createBiquadFilter();
midEQ.type = "peaking";
midEQ.frequency.value = 1000;
midEQ.Q.value = 1;

const trebleEQ = audioContext.createBiquadFilter();
trebleEQ.type = "highshelf";
trebleEQ.frequency.value = 3000;

// Analyzer for visualizer
const analyser = audioContext.createAnalyser();
analyser.fftSize = 32;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Connect audio nodes
source
    .connect(bassEQ)
    .connect(midEQ)
    .connect(trebleEQ)
    .connect(analyser)
    .connect(audioContext.destination);

// Initialize playlist and current song index
let songs = [];
let currentSongIndex = 0;
let currentTrackElement = null;
let isPlaying = false;

// Timer updated for current-time and total-duration
const currentTimeEl = document.getElementById("current-time");
const totalDurationEl = document.getElementById("total-duration");

// Format time for display
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
        totalDurationEl.textContent = formatTime(audio.duration);
    }
});

audio.addEventListener("timeupdate", () => {
    if (!isNaN(audio.currentTime)) {
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }

    seekBar.max = audio.duration;
    seekBar.value = audio.currentTime;
});

// Equalizer animation
function startEqualizer() {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    function animateEqualizer() {
        analyser.getByteFrequencyData(dataArray);
        eqBars.forEach((bar, index) => {
            let value = dataArray[index] / 2;
            bar.style.height = `${Math.max(value, 5)}px`;
        });

        if (!audio.paused) {
            requestAnimationFrame(animateEqualizer);
        } else {
            stopEqualizer();
        }
    }

    animateEqualizer();
}

function stopEqualizer() {
    eqBars.forEach(bar => {
        bar.style.height = "5px";
    });
}

// Load and play a song
function loadSong(index = currentSongIndex) {
    if (!songs.length) return;
    currentSongIndex = index;
    audio.src = songs[currentSongIndex];
    const songName = songs[currentSongIndex].replace(/\\/g, '/').split('/').pop().replace(/\.[^/.]+$/, '');
    songTitle.textContent = songName;

    // Send alert to Electron main process
    if (window.musicAPI.notifySong) {
        window.musicAPI.notifySong(songName);
    }

    loadLyricsForSong(songName);
    updateActiveTrack();
}

function playSong() {
    if (!audio.src) loadSong();
    audio.play();
    startEqualizer();
    window.musicAPI.controlMedia('playback-state-changed', true); // Notify main process
}

function pauseSong() {
    audio.pause();
    window.musicAPI.controlMedia('playback-state-changed', false); // Notify main process
}

function stopSong() {
    audio.pause();
    audio.currentTime = 0;
    stopEqualizer();
}

function prevSong() {
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    loadSong();
    playSong();
}

function nextSong() {
    playNextSong();
}

// Updated playNextSong function
function playNextSong() {
    const items = [...document.querySelectorAll(".playlist-item")];
    let currentIndex = items.findIndex(btn => btn.classList.contains("playing"));
    let nextIndex;

    if (isShuffle) {
        do {
            nextIndex = Math.floor(Math.random() * items.length);
        } while (nextIndex === currentIndex);
    } else {
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
            if (isRepeat) {
                nextIndex = 0; // Loop back to the first song
            } else {
                return; // Stop if no repeat
            }
        }
    }

    items[currentIndex]?.classList.remove("playing");
    items[nextIndex].classList.add("playing");
    items[nextIndex].click();
}

audio.addEventListener("ended", () => {
    if (isRepeat) {
        // Replay the current song
        audio.currentTime = 0;
        audio.play();
    } else if (isShuffle || currentSongIndex < songs.length - 1) {
        playNextSong();
    }
});

// Seek bar and volume controls
seekBar.addEventListener("input", () => {
    audio.currentTime = seekBar.value;
});

volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value;
    isMuted = false;
    updateVolumeIcon(audio.volume);
});

// Theme toggle functionality
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
});

// Update active track in the playlist
function updateActiveTrack() {
    const playlistItems = document.querySelectorAll('.playlist-item');
    playlistItems.forEach((item, index) => {
        item.classList.remove('active', 'playing');
        if (index === currentSongIndex) {
            item.classList.add('active', 'playing');
            currentTrackElement = item;
        }
    });
}

// Load playlist from the main process
window.musicAPI.getSongs().then(fileList => {
    if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
    }

    playlistEl.innerHTML = "";
    songs = fileList.map(name => `music/${name}`);

    songs.forEach((src, index) => {
        const fileName = src.split('/').pop();
        const [artist, title] = fileName.replace('.mp3', '').split(' - ').map(part => part.trim());

        const li = document.createElement("li");
        li.draggable = true;
        const button = document.createElement("button");
        button.classList.add("playlist-item");
        button.dataset.src = src;
        button.textContent = artist && title ? `🎵 ${artist} - ${title}` : `🎵 ${fileName}`;
        li.appendChild(button);
        playlistEl.appendChild(li);
    });

    addDragAndDropListeners();
    updatePlaylistEventListeners(); // Ensure click listeners are assigned
    loadSong();
});

// Drag-and-drop functionality for playlist
function addDragAndDropListeners() {
    let draggedItemIndex;

    playlistEl.querySelectorAll("li").forEach((li, index) => {
        li.addEventListener("dragstart", () => {
            draggedItemIndex = index;
        });

        li.addEventListener("dragover", (e) => {
            e.preventDefault();
            li.style.borderTop = "2px solid #4af";
        });

        li.addEventListener("dragleave", () => {
            li.style.borderTop = "";
        });

        li.addEventListener("drop", () => {
            li.style.borderTop = "";
            if (draggedItemIndex === index) return;

            // Update the songs array
            const dragged = songs[draggedItemIndex];
            songs.splice(draggedItemIndex, 1);
            songs.splice(index, 0, dragged);

            // Update the playlist DOM
            const draggedEl = playlistEl.children[draggedItemIndex];
            playlistEl.removeChild(draggedEl);
            playlistEl.insertBefore(draggedEl, playlistEl.children[index]);

            // Update the current song index if the currently playing song was moved
            if (draggedItemIndex === currentSongIndex) {
                currentSongIndex = index;
            } else if (draggedItemIndex < currentSongIndex && index >= currentSongIndex) {
                currentSongIndex -= 1;
            } else if (draggedItemIndex > currentSongIndex && index <= currentSongIndex) {
                currentSongIndex += 1;
            }

            // Reassign click event listeners to reflect the new order
            updatePlaylistEventListeners();

            // Update the active track highlight
            updateActiveTrack();

            // Reattach drag-and-drop listeners
            addDragAndDropListeners();
        });
    });
}

function updatePlaylistEventListeners() {
    const playlistItems = document.querySelectorAll(".playlist-item");
    playlistItems.forEach((item, index) => {
        item.removeEventListener("click", item._clickHandler); // Remove the old event listener
        item._clickHandler = () => {
            loadSong(index);
            playSong();
        };
        item.addEventListener("click", item._clickHandler); // Add the updated event listener
    });
}

// Playback control buttons
playButton.addEventListener("click", () => {
    if (audio.paused) {
        playSong();
        playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        isPlaying = true;
    } else {
        pauseSong();
        playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
        isPlaying = false;
    }
});

stopButton.addEventListener("click", () => {
    stopSong();
    playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
    isPlaying = false;
});

prevButton.addEventListener("click", () => {
    prevSong();
    playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    isPlaying = true;
});

nextButton.addEventListener("click", () => {
    nextSong();
    playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    isPlaying = true;
});

// Load lyrics for the current song
async function loadLyricsForSong(songName) {
    const [artist, title] = songName.replace('.mp3', '').split(' - ').map(part => part.trim());

    if (!artist || !title) {
        lyricsDisplay.textContent = "Unable to fetch lyrics. \nInvalid song format.";
        return;
    }

    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        if (!response.ok) throw new Error("Lyrics not found");
        const data = await response.json();
        lyricsDisplay.textContent = data.lyrics || "No lyrics available.";
    } catch (error) {
        lyricsDisplay.textContent = "No lyrics available online or \nexternal API error";
    }
}

// Add songs to the playlist
addFolderButton.addEventListener("click", async () => {
    const newSongs = await window.musicAPI.selectFolder();

    if (!newSongs.length) {
        // alert("No songs were added.");
        return;
    }

    playlistEl.innerHTML = "";
    songs = [];

    songs = [...songs, ...newSongs];

    songs.forEach((src, index) => {
        const fileName = src.split('\\').pop();
        const [artist, title] = fileName.replace('.mp3', '').split(' - ').map(part => part.trim());

        const li = document.createElement("li");
        li.draggable = true;
        const button = document.createElement("button");
        button.classList.add("playlist-item");
        button.dataset.src = src;
        button.textContent = artist && title ? `🎵 ${artist} - ${title}` : `🎵 ${fileName}`;
        button.addEventListener("click", () => {
            loadSong(index);
            playSong();
        });
        li.appendChild(button);
        playlistEl.appendChild(li);
    });

    addDragAndDropListeners();
    loadSong();
    // alert(`${newSongs.length} songs added to the playlist.`);
});

// Window control buttons
document.getElementById('buttonred').addEventListener('click', () => {
    window.musicAPI.controlWindow('close');
});
document.getElementById('buttonyellow').addEventListener('click', () => {
    window.musicAPI.controlWindow('minimize');
});
document.getElementById('buttongreen').addEventListener('click', () => {
    window.musicAPI.controlWindow('maximize');
});
document.getElementById('buttongreen').addEventListener('click', () => {
    window.musicAPI.controlWindow('shrink');
});
document.getElementById("buttongreen").addEventListener("click", () => {
    document.querySelector(".player-container").classList.toggle("compact");
});

// Equalizer slider controls
document.getElementById("bass").addEventListener("input", (e) => {
    bassEQ.gain.value = e.target.value;
});
document.getElementById("mid").addEventListener("input", (e) => {
    midEQ.gain.value = e.target.value;
});
document.getElementById("treble").addEventListener("input", (e) => {
    trebleEQ.gain.value = e.target.value;
});

// Media control from the main process
window.musicAPI.onMediaControl((action) => {
    switch (action) {
        case 'previous':
            prevSong();
            playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
            isPlaying = true;
            break;
        case 'play-pause':
            if (audio.paused) {
                playSong();
                playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
                isPlaying = true;
            } else {
                pauseSong();
                playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
                isPlaying = false;
            }
            break;
        case 'next':
            nextSong();
            playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
            isPlaying = true;
            break;
    }
});

// Volume icon mute functionality
volumeIcon.addEventListener('click', () => {
    isMuted = !isMuted;

    if (isMuted) {
        previousVolume = audio.volume;
        audio.volume = 0;
        volumeBar.value = 0;
        volumeIcon.classList.remove('fa-volume-low', 'fa-volume-high', 'fa-volume-off');
        volumeIcon.classList.add('fa-volume-mute');
    } else {
        audio.volume = previousVolume;
        volumeBar.value = previousVolume;
        updateVolumeIcon(previousVolume);
    }
});

function updateVolumeIcon(volume) {
    volumeIcon.classList.remove('fa-volume-mute', 'fa-volume-low', 'fa-volume-high', 'fa-volume-off');
    if (volume === 0) {
        volumeIcon.classList.add('fa-volume-off');
    } else if (volume < 0.5) {
        volumeIcon.classList.add('fa-volume-low');
    } else {
        volumeIcon.classList.add('fa-volume-high');
    }
}

updateVolumeIcon(audio.volume);

// Audio visualizer setup
const canvas = document.getElementById('audio-visualizer');
const canvasCtx = canvas.getContext('2d');

// Resize canvas to fit container
canvas.width = canvas.parentElement.offsetWidth;
canvas.height = canvas.parentElement.offsetHeight;

// Web Audio API setup
const visualizerAnalyser = audioContext.createAnalyser();
source.connect(visualizerAnalyser);
visualizerAnalyser.connect(audioContext.destination);

// Configure analyser
visualizerAnalyser.fftSize = 256;
const visualizerBufferLength = visualizerAnalyser.frequencyBinCount;
const visualizerDataArray = new Uint8Array(visualizerBufferLength);

// Draw visualizer
function drawVisualizer() {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    visualizerAnalyser.getByteFrequencyData(visualizerDataArray);

    const barWidth = (canvas.width / visualizerBufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < visualizerBufferLength; i++) {
        barHeight = visualizerDataArray[i];

        const red = (barHeight + 100) % 255;
        const green = (i * 5) % 255;
        const blue = 200;

        canvasCtx.fillStyle = `rgb(${red},${green},${blue})`;

        // Draw bars extending both up and down from the middle
        const centerY = canvas.height / 2;
        canvasCtx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight / 2); // Top half
        canvasCtx.fillRect(x, centerY, barWidth, barHeight / 2); // Bottom half

        // Mirror the bars horizontally
        const mirroredX = canvas.width - x - barWidth;
        canvasCtx.fillRect(mirroredX, centerY - barHeight / 2, barWidth, barHeight / 2); // Top half mirrored
        canvasCtx.fillRect(mirroredX, centerY, barWidth, barHeight / 2); // Bottom half mirrored

        x += barWidth + 1;
    }

    requestAnimationFrame(drawVisualizer);
}

// Start visualizer when audio plays
audio.addEventListener('play', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    drawVisualizer();
});

// Theme persistence using localStorage
const icon = themeToggle.querySelector('i');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    icon.classList.remove('fa-toggle-off');
    icon.classList.add('fa-toggle-on');
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');

    // Update icon
    icon.classList.toggle('fa-toggle-on', isDark);
    icon.classList.toggle('fa-toggle-off', !isDark);

    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Update song title and show notification  
const songPath = songs[currentSongIndex] || '';
const songName = songPath.replace(/\\/g, '/').split('/').pop().replace(/\.[^/.]+$/, '');

songTitle.textContent = songName;

// Show system notification
if (window.notifier && window.notifier.showSongNotification) {
    window.notifier.showSongNotification("Now Playing", songName);
}
