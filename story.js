import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Secondary DB Config (For Stories)
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

const CLOUD_NAME = "d7b90apq";
const UPLOAD_PRESET = "spymo_story";

// 🔗 Google Apps Script Auto-cleanup Trigger URL
const CLEANUP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1c3B4rTm9RX2IOtSKeMp2Ypg43BH4YJli_sFkkdYF-2VPaAdumk3ndUleK2vGbLcL/exec";

let attachedMusic = null;

// Global Function to Trigger File Input
window.triggerFileInput = function() {
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.click();
};

window.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file-input");

    if (fileInput) {
        fileInput.addEventListener("change", function(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 🛑 Block MP4 Video
            if (file.type.startsWith("video") || file.name.endsWith(".mp4")) {
                alert("⚠️ Video format (MP4) is not supported! Please select an Image (PNG, JPG, etc.).");
                fileInput.value = ""; 
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;

                img.onload = function() {
                    // Compress Image using Canvas
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");

                    const maxWidth = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

                    try {
                        localStorage.setItem("temp_story_image", compressedBase64);
                        showImagePreview(compressedBase64);
                    } catch (err) {
                        console.error("LocalStorage Error:", err);
                        showImagePreview(compressedBase64);
                    }
                };
            };

            reader.readAsDataURL(file);
        });
    }

    const savedDraftImg = localStorage.getItem("temp_story_image");
    if (savedDraftImg) {
        showImagePreview(savedDraftImg);
    }

    const musicData = localStorage.getItem("selected_story_music");
    if (musicData) {
        try {
            attachedMusic = JSON.parse(musicData);
            displayMusicSticker(attachedMusic);
        } catch(e) {
            console.error(e);
        }
    }
});

function showImagePreview(src) {
    const imgElem = document.getElementById("story-img-preview");
    const placeholder = document.getElementById("upload-placeholder");

    if (imgElem) {
        imgElem.src = src;
        imgElem.style.display = "block";
    }
    if (placeholder) {
        placeholder.style.display = "none";
    }
}

window.openMusicPicker = function() {
    const savedImg = localStorage.getItem("temp_story_image");
    const imgElem = document.getElementById("story-img-preview");

    if ((!savedImg || savedImg === "") && (!imgElem || imgElem.style.display === "none" || !imgElem.src)) {
        alert("⚠️ Please select an image first before choosing music!");
        
        const fileInput = document.getElementById("file-input");
        if (fileInput) fileInput.click();
        return;
    }

    window.location.href = "music.html?source=story";
};

function displayMusicSticker(music) {
    const sticker = document.getElementById("attached-music-sticker");
    const stickerText = document.getElementById("sticker-text");
    if (sticker && stickerText) {
        stickerText.innerText = `${music.title} - ${music.artist}`;
        sticker.style.display = "flex";
    }
}

window.removeAttachedMusic = function(e) {
    if (e) e.stopPropagation();
    attachedMusic = null;
    localStorage.removeItem("selected_story_music");
    const sticker = document.getElementById("attached-music-sticker");
    if (sticker) sticker.style.display = "none";
};

window.focusCaption = function() {
    const capInput = document.getElementById("story-caption");
    if (capInput) capInput.focus();
};

// 🚀 Publish Story
window.publishStory = async function() {
    const draftImg = localStorage.getItem("temp_story_image") || document.getElementById("story-img-preview")?.src;
    
    if (!draftImg || draftImg.includes("window.location")) {
        alert("Please select an image for your story!");
        return;
    }

    const shareBtn = document.getElementById("upload-story-btn");
    if (shareBtn) {
        shareBtn.innerText = "Sharing...";
        shareBtn.disabled = true;
    }

    try {
        const formData = new FormData();
        formData.append("file", draftImg);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("tags", "story");

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        if (!data.secure_url) throw new Error("Cloudinary Upload Failed");

        const caption = document.getElementById("story-caption")?.value.trim() || "";
        const activeUser = JSON.parse(localStorage.getItem("infinity_user") || "{}");

        await addDoc(collection(db, "stories"), {
            userId: activeUser.uid || "guest",
            username: activeUser.username || "Anonymous",
            imageUrl: data.secure_url,
            caption: caption,
            music: attachedMusic || null,
            createdAt: serverTimestamp()
        });

        // 🧹 Google Apps Script ക്ലീനപ്പ് സ്ക്രിപ്റ്റ് ബാക്ക്ഗ്രൗണ്ടിൽ റൺ ചെയ്യുന്നു
        fetch(CLEANUP_SCRIPT_URL, { mode: 'no-cors' })
            .catch(err => console.error("Cleanup Trigger Error:", err));

        localStorage.removeItem("temp_story_image");
        localStorage.removeItem("selected_story_music");

        alert("🎉 Story shared successfully!");
        
        // 🔄 `home.html` പേജിലേക്ക് റീഡയറക്ട് ചെയ്യുന്നു
        window.location.href = "home.html";

    } catch (err) {
        console.error("Story Publish Error:", err);
        alert("Failed to share story. Try again!");
    } finally {
        if (shareBtn) {
            shareBtn.innerText = "Share";
            shareBtn.disabled = false;
        }
    }
};
