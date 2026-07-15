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
                        card.innerHTML = `
                            <span><strong>${userName}</strong></span>
                            <!-- ഇവിടെ startChat ലേക്ക് uid-യും പേരും പാസ്സ് ചെയ്യുന്നു -->
                            <button class="chat-btn" onclick="window.startChat('${userUid}', '${userName}')">Chat</button>
                        `;
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

// 👈 ഈ ഫങ്ഷനാണ് ഇപ്പോൾ ചാറ്റ് പേജിലേക്ക് യുആർഎൽ വഴി ഡാറ്റ കൊണ്ടുപോകുന്നത്
window.startChat = (uid, username) => {
    if (!uid) {
        alert("യൂസർ ഐഡി ലഭ്യമല്ല!");
        return;
    }
    // chat.html-ലേക്ക് UID-യും പേരും പാസ്സ് ചെയ്ത് വിടുന്നു
    window.location.href = `chat.html?target=${uid}&name=${encodeURIComponent(username)}`;
};
