import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// ⚙️ Cloudinary Settings
const CLOUD_NAME = "hrobsz6n";
const UPLOAD_PRESET = "spymo_reels"; 

const videoInput = document.getElementById('video-input');
const captionInput = document.getElementById('caption-input');
const uploadBtn = document.getElementById('upload-btn');
const statusMsg = document.getElementById('status-msg');
const fileNameDisplay = document.getElementById('file-name');

// 📊 Progress elements
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const percentageText = document.getElementById('percentage-text');

const currentUser = JSON.parse(localStorage.getItem("infinity_user") || "{}");
let isVideoValid = false;

// ⏱️ 1. വീഡിയോ ദൈർഘ്യം ಚೆക്ക് ചെയ്യുന്ന ഭാഗം (Max 60s)
videoInput.addEventListener('change', () => {
    const file = videoInput.files[0];
    if (file) {
        const tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';

        tempVideo.onloadedmetadata = () => {
            window.URL.revokeObjectURL(tempVideo.src);
            const duration = tempVideo.duration;

            if (duration > 60) {
                fileNameDisplay.style.color = "#ff1e42";
                fileNameDisplay.innerText = `❌ Video length must be under ${Math.round(duration)}s (Max 60s)`;
                isVideoValid = false;
            } else {
                fileNameDisplay.style.color = "#00ff88";
                fileNameDisplay.innerText = `Selected: ${file.name} (${Math.round(duration)}s)`;
                isVideoValid = true;
            }
        };

        tempVideo.src = URL.createObjectURL(file);
    }
});

// 🚀 2. അപ്‌ലോഡ് ലോജിക്
uploadBtn.addEventListener('click', async () => {
    const file = videoInput.files[0];
    const caption = captionInput.value.trim();

    if (!currentUser.username) {
        alert("Please log in to upload");
        return;
    }

    if (!file) {
        alert("Please select a video");
        return;
    }

    if (!isVideoValid) {
        alert("Video length must be less than 60 seconds");
        return;
    }

    try {
        uploadBtn.disabled = true;
        statusMsg.style.color = "#aaa";
        statusMsg.innerText = "Uploading...⏳";
        
        progressContainer.style.display = "block";
        percentageText.style.display = "block";
        progressBar.style.width = "0%";
        percentageText.innerText = "0%";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        // ☁️ Cloudinary Upload (With Percentage Loading)
        const cloudinaryData = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + "%";
                    percentageText.innerText = percentComplete + "%";
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error("Upload failed!"));
                }
            };

            xhr.onerror = () => reject(new Error("Network Error!"));
            xhr.send(formData);
        });

        if (!cloudinaryData.secure_url) {
            throw new Error("Invalid Cloudinary Response");
        }

        // 🎥 ഓറിയന്റേഷൻ ക്രോപ്പ് ചെയ്യാതെ തനത് ക്വാളിറ്റിയിൽ ഓട്ടോമാറ്റിക് ഓപ്റ്റിമൈസേഷൻ മാത്രം ചേർക്കുന്നു
        let rawUrl = cloudinaryData.secure_url;
        let optimizedUrl = rawUrl.replace('/upload/', '/upload/q_auto,f_auto/');

        statusMsg.innerText = "Saving... 💾";

        // 🔥 Firestore Data Saving
        await addDoc(collection(db, "posts"), {
            type: "video",
            mediaUrl: optimizedUrl,
            caption: caption,
            username: currentUser.username,
            userId: currentUser.uid || "",
            userAvatar: currentUser.avatar || "https://via.placeholder.com/40",
            likes: [],
            likeCount: 0,
            commentCount: 0,
            createdAt: serverTimestamp()
        });

        statusMsg.style.color = "#00ff88";
        statusMsg.innerText = "Reel uploaded";

        setTimeout(() => {
            window.location.href = "reels.html";
        }, 1000);

    } catch (error) {
        console.error("Upload Error:", error);
        statusMsg.style.color = "#ff1e42";
        statusMsg.innerText = "Upload interrupted! Try again";
        uploadBtn.disabled = false;
        progressContainer.style.display = "none";
        percentageText.style.display = "none";
    }
});
