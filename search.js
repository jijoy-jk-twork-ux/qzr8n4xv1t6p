import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    const display = document.getElementById('search-results');

    if (input) {
        input.addEventListener('input', async () => {
            const term = input.value.trim().toLowerCase();

            if (!term) {
                display.innerHTML = "";
                return;
            }

            try {
                // 1. ഫയർബേസിൽ നിന്ന് യൂസേഴ്സിന്റെ ഡാറ്റ എടുക്കുന്നു
                const snap = await getDocs(collection(db, "users"));
                display.innerHTML = "";

                let hasResults = false;

                snap.forEach((doc) => {
                    const user = doc.data();
                    const userName = (user.username || "").toLowerCase();
                    const userUid = user.uid || doc.id;

                    // 2. അടിക്കുന്ന അക്ഷരം പേരിൽ എവിടെയെങ്കിലും ഉണ്ടോ എന്ന് നോക്കുന്നു (.includes)
                    if (userName.includes(term)) {
                        hasResults = true;

                        const card = document.createElement("div");
                        card.className = "user-card";
                        card.style.cursor = "pointer";

                        card.innerHTML = `
                            <span style="flex-grow: 1; font-weight: bold;">${user.username}</span>
                            <button class="chat-btn" id="chat-btn-${userUid}">Chat</button>
                        `;

                        // ചാറ്റ് ബട്ടൺ ക്ലിക്ക്
                        const chatBtn = card.querySelector(`#chat-btn-${userUid}`);
                        chatBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.startChat(userUid, user.username);
                        });

                        // പ്രൊഫൈൽ പേജിലേക്ക്
                        card.addEventListener('click', () => {
                            window.location.href = `profile.html?id=${userUid}`;
                        });

                        display.appendChild(card);
                    }
                });

                if (!hasResults) {
                    display.innerHTML = "<p style='text-align:center; color:#888;'>No users found!</p>";
                }

            } catch (error) {
                console.error("Firebase Search Error:", error);
                display.innerHTML = "<p style='color:red; text-align:center;'>Error loading results.</p>";
            }
        });
    }
});

window.startChat = (uid, username) => {
    if (!uid) {
        alert("That username does not exist!");
        return;
    }
    window.location.href = `chat.html?target=${uid}&name=${encodeURIComponent(username)}`;
};
