import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyCNQaHi-L3fninLxkePZBaNR7vu6JiYEwQ",
    authDomain: "infinityspotx.firebaseapp.com",
    projectId: "infinityspotx",
    storageBucket: "infinityspotx.firebasestorage.app",
    messagingSenderId: "400346792298",
    appId: "1:400346792298:web:5fd101c225a547902b6513" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Audio Element Setup
let audioPlayer = document.getElementById("global-audio-player");
if (!audioPlayer) {
    audioPlayer = document.createElement("audio");
    audioPlayer.id = "global-audio-player";
    audioPlayer.preload = "metadata";
    document.body.appendChild(audioPlayer);
}

let selectedMusicData = null;

// 1. 🎧 Fetch Music from Firebase DB Collection: "music_library"
function loadMusicLibrary() {
    const musicListContainer = document.getElementById("music-list");

    if (!musicListContainer) {
        console.error("❌ Error: HTML-ൽ 'music-list' എന്ന ID ഉള്ള element കാണുന്നില്ല!");
        return;
    }

    onSnapshot(collection(db, "music_library"), (snapshot) => {
        musicListContainer.innerHTML = "";

        if (snapshot.empty) {
            musicListContainer.innerHTML = "<p style='color:#aaa; text-align:center; padding: 20px;'>No tracks found in Spymo Library!</p>";
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            data.id = docSnap.id;

            const musicCard = document.createElement("div");
            musicCard.className = "music-card";

            const logoHTML = data.coverUrl 
                ? `<img src="${data.coverUrl}" class="track-logo" alt="logo">`
                : `<div class="track-logo" style="font-size:24px;">🎵</div>`;

            musicCard.innerHTML = `
                <div class="track-info">
                    ${logoHTML}
                    <div class="track-details">
                        <h4>${data.title || "Untitled Track"}</h4>
                        <p>${data.artist || "Spymo Official"}</p>
                    </div>
                </div>
                <span class="play-icon-badge">▶</span>
            `;

            musicCard.addEventListener("click", () => openMusicModal(data));
            musicListContainer.appendChild(musicCard);
        });
    }, (error) => {
        console.error("❌ Firestore Read Error: ", error);
    });
}

// 2. 🎵 Open Player Pop-Up & Load Audio Details
window.openMusicModal = function(music) {
    selectedMusicData = music;

    const titleElem = document.getElementById("modal-title");
    const artistElem = document.getElementById("modal-artist");
    const artContainer = document.getElementById("modal-art");

    if (titleElem) titleElem.innerText = music.title || "Unknown Track";
    if (artistElem) artistElem.innerText = music.artist || "Unknown Artist";

    if (artContainer) {
        if (music.coverUrl) {
            artContainer.innerHTML = `<img src="${music.coverUrl}">`;
        } else {
            artContainer.innerHTML = "🎵";
        }
    }

    // Set Audio Source & Reset Timeline
    if (music.audioUrl) {
        audioPlayer.src = music.audioUrl;
        audioPlayer.currentTime = 0;

        const modal = document.getElementById("music-modal");
        if (modal) modal.style.display = "flex";

        // Play Audio
        audioPlayer.play().then(() => {
            updatePlayBtnUI(true);
        }).catch(e => {
            console.log("Auto-play blocked or error:", e);
            updatePlayBtnUI(false);
        });
    } else {
        alert("⚠️ Audio URL missing for this song!");
    }
};

// 3. ⏹ Close Player
window.closePlayer = function() {
    audioPlayer.pause();
    const modal = document.getElementById("music-modal");
    if (modal) modal.style.display = "none";
};

// 4. ⏯ Play / Pause Toggle
window.togglePlay = function() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        updatePlayBtnUI(true);
    } else {
        audioPlayer.pause();
        updatePlayBtnUI(false);
    }
};

function updatePlayBtnUI(isPlaying) {
    const playBtn = document.getElementById("play-pause-btn");
    if (playBtn) {
        playBtn.innerText = isPlaying ? "⏸ Pause" : "▶ Play";
    }
}

// 5. ⏱ Seek Bar & Time Updates (Event Listeners Setup)
audioPlayer.onloadedmetadata = function() {
    const durElem = document.getElementById("duration-time");
    if (durElem) durElem.innerText = formatTime(audioPlayer.duration);
};

audioPlayer.ontimeupdate = function() {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    const curElem = document.getElementById("current-time");
    if (curElem) curElem.innerText = formatTime(current);

    const seekBar = document.getElementById("seek-bar");
    if (duration && seekBar) {
        seekBar.value = (current / duration) * 100;
    }
};

// Seek Bar User Input Logic
document.addEventListener("DOMContentLoaded", () => {
    const seekBar = document.getElementById("seek-bar");
    if (seekBar) {
        seekBar.addEventListener("input", () => {
            const duration = audioPlayer.duration;
            if (duration) {
                audioPlayer.currentTime = (seekBar.value / 100) * duration;
            }
        });
    }
});

function formatTime(seconds) {
    if (isNaN(seconds) || !seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// 6. 📸 Add Music to Story Logic
window.addToStoryDraft = function() {
    if (!selectedMusicData) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isFromStory = urlParams.get('source') === 'story';
    const hasStoryImg = localStorage.getItem("temp_story_image");

    if (!hasStoryImg && !isFromStory) {
        alert("Please select an image first!");
        window.location.href = "create-story.html";
        return;
    }

    localStorage.setItem("selected_story_music", JSON.stringify({
        id: selectedMusicData.id || "",
        title: selectedMusicData.title,
        artist: selectedMusicData.artist,
        audioUrl: selectedMusicData.audioUrl,
        coverUrl: selectedMusicData.coverUrl || ""
    }));

    audioPlayer.pause(); // Story-ലേക്ക് പോകുമ്പോൾ ഓഡിയോ നിർത്തുന്നു
    alert(`🎵 "${selectedMusicData.title}" attached to your story!`);
    
    window.location.href = "story.html";
};

// Start Loading Music
loadMusicLibrary();
