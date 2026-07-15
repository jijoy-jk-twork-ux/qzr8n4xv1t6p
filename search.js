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

// DOM എലമെന്റുകൾ ലോഡ് ആയെന്ന് ഉറപ്പാക്കാൻ DOMContentLoaded ഉപയോഗിക്കുന്നു
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('search-btn');
    const input = document.getElementById('search-input');
    const display = document.getElementById('search-results');

    if (btn) {
        btn.addEventListener('click', async () => {
            const term = input.value.trim().toLowerCase();
            if (!term) return;

            display.innerHTML = "<p style='text-align:center'>Searching...</p>";

            try {
                // ഇവിടെയാണ് Firestore Query
                const q = query(collection(db, "users"), where("username", "==", term));
                const snap = await getDocs(q);

                display.innerHTML = "";

                if (snap.empty) {
                    display.innerHTML = "<p style='text-align:center; color:#888;'>That username does not exist!</p>";
                } else {
                    snap.forEach((doc) => {
                        const user = doc.data();
                        display.innerHTML = `
                            <div class="user-card" style="background: #1a1a1a; padding: 15px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid #ff1e42; margin-top: 10px;">
                                <span><strong>${user.username}</strong></span>
                                <button onclick="window.startChat('${user.uid}')" style="background:#ff1e42; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer;">Chat</button>
                            </div>
                        `;
                    });
                }
            } catch (error) {
                console.error("Firebase Error:", error);
                display.innerHTML = "<p style='color:red;'>എറർ! ഒന്നുകൂടി നോക്കൂ.</p>";
            }
        });
    }
});

// Chat function
window.startChat = (uid) => {
    alert("ചാറ്റിംഗ് ഫീച്ചർ ഉടൻ വരുന്നു! (UID: " + uid + ")");
};
