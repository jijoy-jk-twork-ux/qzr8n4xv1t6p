import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    const btn = document.getElementById('search-btn');
    const input = document.getElementById('search-input');
    const display = document.getElementById('search-results');

    if (btn) {
        btn.addEventListener('click', async () => {
            const term = input.value.trim().toLowerCase();
            if (!term) return;

            display.innerHTML = "<p style='text-align:center; color: #888;'>Searching...</p>";

            try {
                // Firestore Query
                const q = query(collection(db, "users"), where("username", "==", term));
                const snap = await getDocs(q);

                display.innerHTML = "";

                if (snap.empty) {
                    display.innerHTML = "<p style='text-align:center; color:#888;'>That username does not exist!</p>";
                } else {
                    snap.forEach((doc) => {
                        const user = doc.data();
                        // യൂസറുടെ UID ഡോക്യുമെന്റ് ഐഡിയിൽ നിന്നോ അല്ലെങ്കിൽ ഫീൽഡിൽ നിന്നോ എടുക്കുന്നു
                        const userUid = user.uid || doc.id; 
                        const userName = user.username;

                        // തനിമയുള്ള കാർഡ് ഉണ്ടാക്കുന്നു
                        const card = document.createElement("div");
                        card.className = "user-card";
                        
                        // യൂസർക്ക് ക്ലിക്ക് ചെയ്യാൻ സാധിക്കുമെന്ന് മനസ്സിലാക്കാൻ പോയിന്റർ സ്റ്റൈൽ നൽകുന്നു
                        card.style.cursor = "pointer"; 

                        // കാർഡിന്റെ അകത്തുള്ള HTML സെറ്റ് ചെയ്യുന്നു
                        card.innerHTML = `
                            <span style="flex-grow: 1; font-weight: bold;">${userName}</span>
                            <!-- ചാറ്റ് ചെയ്യാനുള്ള ബട്ടൺ -->
                            <button class="chat-btn" id="chat-btn-${userUid}">Chat</button>
                        `;

                        // 1. ചാറ്റ് ബട്ടണിൽ ക്ലിക്ക് ചെയ്താൽ ചാറ്റ് പേജിലേക്ക് പോകാൻ
                        const chatBtn = card.querySelector(`#chat-btn-${userUid}`);
                        chatBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); // 👈 ഇത് വളരെ പ്രധാനമാണ്! കാർഡിന്റെ ക്ലിക്ക് ഇവന്റ് വർക്ക് ആകുന്നത് ഇത് തടയും.
                            window.startChat(userUid, userName);
                        });

                        // 2. ചാറ്റ് ബട്ടൺ അല്ലാത്ത ബാക്കി കാർഡിൽ എവിടെ ഞെക്കിയാലും ആ യൂസറുടെ പ്രൊഫൈൽ ജസ്റ്റ് കാണാൻ (View Only)
                        card.addEventListener('click', () => {
                            window.location.href = `profile.html?id=${userUid}`;
                        });

                        display.appendChild(card);
                    });
                }
            } catch (error) {
                console.error("Firebase Error:", error);
                display.innerHTML = "<p style='color:red; text-align:center;'>എറർ! ഒന്നുകൂടി നോക്കൂ.</p>";
            }
        });
    }
});

// ചാറ്റ് പേജിലേക്ക് യുആർഎൽ വഴി ഡാറ്റ കൊണ്ടുപോകുന്ന ഫങ്ഷൻ
window.startChat = (uid, username) => {
    if (!uid) {
        alert("that username does not exist!");
        return;
    }
    window.location.href = `chat.html?target=${uid}&name=${encodeURIComponent(username)}`;
};

