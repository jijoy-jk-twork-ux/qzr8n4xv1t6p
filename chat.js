// ==========================================
// 1. FIREBASE SETUP
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, getDoc, 
    deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; 

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
const auth = getAuth(app);

// ==========================================
// 2. DOM SELECTORS & STATE
// ==========================================
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const chatHeaderName = document.getElementById("chat-user-name");
const chatHeaderSub = document.getElementById("chat-user-subname");
const headerAvatar = document.getElementById("header-user-avatar");
const voiceRecordBtn = document.getElementById("voice-record-btn");

let roomId = "";
let myUid = "";
let theirUid = ""; 
let currentUserData = null;

// Voice Recording Variables (Prepared for future Cloudinary connection)
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// LocalStorage User State Backup
const userDataString = localStorage.getItem("infinity_user");
if (userDataString) {
    try {
        currentUserData = JSON.parse(userDataString);
        myUid = currentUserData.uid || "";
    } catch (e) {
        console.error("Local storage parse error:", e);
    }
}

// Get Target UID from URL Parameters
const urlParams = new URLSearchParams(window.location.search);
theirUid = urlParams.get('target'); 

// ==========================================
// 3. AUTH STATE & ROOM INITIALIZATION
// ==========================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        myUid = user.uid;
    }
    
    if (myUid) {
        if (!theirUid) {
            setupUserSelector();
        } else {
            initializeChatRoom();
        }
    } else {
        alert("Authentication required! Redirecting to login page...");
        window.location.href = "index.html";
    }
});

// Initialize active chat room
function initializeChatRoom() {
    roomId = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
    fetchChatPartnerProfile();
    listenForMessages();
}

// Helper Avatar Generator
function getAvatarUrl(avatarUrl, username) {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&background=ff1e42&color=fff&size=128`;
}

// ==========================================
// 4. AUTOMATIC USER SELECTOR LOGIC
// ==========================================
async function setupUserSelector() {
    chatHeaderName.innerText = "Select a User";
    chatHeaderSub.innerText = "No chat target selected";
    chatBox.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>Please select a user to start chatting.</p>";

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        const existingDropdown = document.getElementById("user-select-dropdown");
        if (existingDropdown) existingDropdown.remove();

        const selectElement = document.createElement("select");
        selectElement.id = "user-select-dropdown";
        selectElement.className = "user-select-dropdown";
        
        const defaultOption = document.createElement("option");
        defaultOption.text = "-- Select User --";
        defaultOption.value = "";
        selectElement.appendChild(defaultOption);

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            const userId = userDoc.id;

            if (userId !== myUid) {
                const option = document.createElement("option");
                option.value = userId;
                option.text = userData.username || "Unknown User";
                selectElement.appendChild(option);
            }
        });

        if (chatBox && chatBox.parentNode) {
            chatBox.parentNode.insertBefore(selectElement, chatBox);
        }

        selectElement.addEventListener("change", (e) => {
            const selectedUid = e.target.value;
            if (selectedUid) {
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?target=${selectedUid}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
                
                theirUid = selectedUid;
                selectElement.remove();
                chatBox.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>Loading chat...</p>";
                initializeChatRoom();
            }
        });

    } catch (error) {
        console.error("Failed to load user list:", error);
        chatBox.innerHTML = `<p style='text-align:center; padding:20px; color:#ff4d4d;'>Firebase Connection Error! Check Database Rules.</p>`;
    }
}

// ==========================================
// 5. PROFILE & CHAT PARTNER FETCH
// ==========================================
async function fetchChatPartnerProfile() {
    try {
        const userDocRef = doc(db, "users", theirUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const username = userData.username || "User";
            const avatar = getAvatarUrl(userData.profilePic || userData.avatar, username);

            chatHeaderName.innerText = username;
            chatHeaderSub.innerText = `@${username.toLowerCase()}`;
            headerAvatar.src = avatar;
        } else {
            chatHeaderName.innerText = "Infinity User";
            chatHeaderSub.innerText = "@user";
        }
    } catch (error) {
        console.error("Error fetching partner profile:", error);
    }
}

// ==========================================
// 6. REALTIME MESSAGES LISTENER
// ==========================================
function listenForMessages() {
    if (!roomId) return;
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = ""; 
        
        if (snapshot.empty) {
            chatBox.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>No messages yet. Say hi! 👋</p>";
            return;
        }

        snapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            renderMessageItem(data);
        });
        
        chatBox.scrollTop = chatBox.scrollHeight;
    }, (error) => {
        console.error("Firestore Error:", error);
        chatBox.innerHTML = `<p style="text-align:center; padding:20px; color:#ff4d4d;">Database Error: ${error.message}</p>`;
    });
}

// 🎨 Render Message Item (Normal, Reel Card, & Voice)
function renderMessageItem(data) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");
    msgDiv.classList.add(data.sender === myUid ? "sent" : "received");

    // 1️⃣ Shared Reel Card (If Message Type is 'reel')
    if (data.type === "reel" || data.reelUrl) {
        msgDiv.classList.add("reel-message-box");
        msgDiv.innerHTML = `
            <div class="shared-reel-card" onclick="window.location.href='reels.html?id=${data.reelId || ''}'">
                <div class="reel-preview-media">
                    <video src="${data.reelUrl || data.text}" muted preload="metadata"></video>
                    <i class="fa-solid fa-circle-play play-icon"></i>
                </div>
                <div class="reel-card-info">
                    <span class="reel-badge"><i class="fa-solid fa-clapperboard"></i> Reel</span>
                    <p class="reel-caption">${data.caption || 'Shared a reel'}</p>
                </div>
            </div>
        `;
    } 
    // 2️⃣ Voice Message (If Message Type is 'voice')
    else if (data.type === "voice" || data.audioUrl) {
        msgDiv.classList.add("voice-message-box");
        msgDiv.innerHTML = `
            <div class="voice-player">
                <i class="fa-solid fa-waveform-lines voice-icon"></i>
                <audio controls src="${data.audioUrl || data.text}"></audio>
            </div>
        `;
    } 
    // 3️⃣ Normal Text Message
    else {
        msgDiv.innerText = data.text;
    }

    chatBox.appendChild(msgDiv);
}

// ==========================================
// 7. SEND MESSAGE LOGIC
// ==========================================
sendBtn.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (text === "" || !roomId || !myUid) return;

    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    messageInput.value = "";

    try {
        await addDoc(messagesRef, {
            text: text,
            type: "text",
            sender: myUid,
            createdAt: serverTimestamp()
        });

        // Maintain 300 message limit per room
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.size > 300) {
            const excessCount = snapshot.size - 300; 
            for (let i = 0; i < excessCount; i++) {
                const oldestDoc = snapshot.docs[i];
                await deleteDoc(doc(db, "chatRooms", roomId, "messages", oldestDoc.id));
            }
        }
    } catch (error) {
        console.error("Message send failed:", error);
        alert("Failed to send message. Please check permissions!");
    }
});

messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
});

// ==========================================
// 8. FUTURE VOICE RECORDING PREPARATION LOGIC
// ==========================================
if (voiceRecordBtn) {
    voiceRecordBtn.addEventListener("click", async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Voice recording is not supported on this browser!");
            return;
        }

        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    console.log("Audio Recorded Successfully:", audioBlob);
                    alert("Voice recorded! Future Cloudinary audio upload logic can be hooked here.");
                };

                mediaRecorder.start();
                isRecording = true;
                voiceRecordBtn.classList.add("recording");
                voiceRecordBtn.innerHTML = `<i class="fa-solid fa-stop"></i>`;
            } catch (err) {
                console.error("Microphone Access Error:", err);
                alert("Microphone permission denied.");
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            voiceRecordBtn.classList.remove("recording");
            voiceRecordBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
        }
    });
}
