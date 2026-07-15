// ==========================================
// 1. FIREBASE SETUP
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

let roomId = "";
let myUid = "";
let theirUid = ""; // ഡൈനാമിക് ആയി സെറ്റ് ചെയ്യാൻ let ആക്കി മാറ്റിയത്
let currentUserData = null;

// 🔄 ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് യൂസർ ഡാറ്റ ബാക്കപ്പ് ആയി എടുക്കുന്നു
const userDataString = localStorage.getItem("infinity_user");
if (userDataString) {
    try {
        currentUserData = JSON.parse(userDataString);
        myUid = currentUserData.uid || "";
    } catch (e) {
        console.error("Local storage parse error", e);
    }
}

// URL-ൽ നിന്ന് ചാറ്റ് ചെയ്യേണ്ട ആളുടെ ഐഡി (target) എടുക്കുന്നു
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
        // 🌟 URL-ൽ target UID ഇല്ലെങ്കിൽ ഓട്ടോമാറ്റിക് ആയി യൂസർ ലിസ്റ്റ് കാണിക്കും
        if (!theirUid) {
            console.log("Target UID ലഭ്യമല്ല, യൂസർ ലിസ്റ്റ് ലോഡ് ചെയ്യുന്നു...");
            setupUserSelector();
        } else {
            initializeChatRoom();
        }
    } else {
        console.log("യൂസർ ലോഗിൻ ചെയ്തിട്ടില്ല! ലോക്കൽ സ്റ്റോറേജും ഫയർബേസും ആക്ടീവ് അല്ല.");
        window.location.href = "index.html";
    }
});

// 🚀 ചാറ്റ് റൂം ആക്ടിവേറ്റ് ചെയ്യുന്ന മെയിൻ ഫങ്ക്ഷൻ
function initializeChatRoom() {
    // രണ്ട് പേരുടെയും UID വെച്ച് യുണീക്ക് റൂം ഐഡി ഉണ്ടാക്കുന്നു
    roomId = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
    
    // മറ്റേ യൂസറുടെ വിവരങ്ങൾ ഫയർബേസിൽ നിന്ന് കണ്ടുപിടിക്കുന്നു
    fetchChatPartnerName();
    
    // മെസ്സേജുകൾ തത്സമയം കാണാൻ ലിസൺ ചെയ്യുന്നു
    listenForMessages();
}

// ==========================================
// 4. AUTOMATIC USER SELECTOR LOGIC
// ==========================================
async function setupUserSelector() {
    chatHeaderName.innerText = "Select a User to Chat";
    chatBox.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>ചാറ്റ് ചെയ്യേണ്ട യൂസറെ മുകളിൽ നിന്ന് തിരഞ്ഞെടുക്കുക.</p>";

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        // ഹെഡറിൽ ഒരു സെലക്ട് ബോക്സ് ഉണ്ടാക്കുന്നു
        const selectElement = document.createElement("select");
        selectElement.id = "user-select-dropdown";
        selectElement.style.cssText = "margin-top: 10px; padding: 8px; border-radius: 20px; border: 1px solid #ccc; width: 80%; max-width: 300px; text-align: center; outline: none;";
        
        const defaultOption = document.createElement("option");
        defaultOption.text = "-- Choose a User --";
        defaultOption.value = "";
        selectElement.appendChild(defaultOption);

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            const userId = userDoc.id;

            // സ്വന്തം പേര് ചാറ്റ് ലിസ്റ്റിൽ വരാതിരിക്കാൻ
            if (userId !== myUid) {
                const option = document.createElement("option");
                option.value = userId;
                option.text = userData.username || "Unknown User";
                selectElement.appendChild(option);
            }
        });

        // ഹെഡറിലേക്ക് സെലക്ട് ബോക്സ് കയറ്റുന്നു
        chatHeaderName.parentNode.appendChild(selectElement);

        // യൂസറെ സെലക്ട് ചെയ്യുമ്പോൾ ഓട്ടോമാറ്റിക് ആയി ചാറ്റ് റൂം സ്വിച്ച് ചെയ്യും
        selectElement.addEventListener("change", (e) => {
            const selectedUid = e.target.value;
            if (selectedUid) {
                // പേജ് റീഫ്രഷ് ചെയ്യാതെ തന്നെ URL അപ്ഡേറ്റ് ചെയ്യുന്നു
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?target=${selectedUid}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
                
                theirUid = selectedUid;
                
                // പഴയ സബ്‌നാമം ലിസ്റ്റിൽ കിടപ്പുണ്ടെങ്കിൽ കളയുന്നു
                const oldSub = document.getElementById("chat-user-subname");
                if (oldSub) oldSub.remove();

                initializeChatRoom();
            }
        });

    } catch (error) {
        console.error("യൂസർ ലിസ്റ്റ് എടുക്കുന്നതിൽ പരാജയം:", error);
    }
}

// ==========================================
// 5. CHAT FUNCTIONS
// ==========================================

// 🔍 ചാറ്റ് പാർട്ണറുടെ വിവരങ്ങൾ Firestore-ൽ നിന്ന് എടുക്കുന്നു
async function fetchChatPartnerName() {
    try {
        const userDocRef = doc(db, "users", theirUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const partnerUsername = userData.username || "Unknown User";
            
            chatHeaderName.innerText = partnerUsername;
            displaySubUsername(partnerUsername);
        } else {
            chatHeaderName.innerText = "Chat User";
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        chatHeaderName.innerText = "Chat Room";
    }
}

// 🔍 യൂസർനെയിം സബ്‌ടൈറ്റിൽ ആയി കാണിക്കുന്നു
function displaySubUsername(username) {
    let usernameSubElement = document.getElementById("chat-user-subname");
    
    if (!usernameSubElement) {
        usernameSubElement = document.createElement("small");
        usernameSubElement.id = "chat-user-subname";
        usernameSubElement.style.display = "block";
        usernameSubElement.style.fontSize = "0.75rem";
        usernameSubElement.style.opacity = "0.8";
        usernameSubElement.style.marginTop = "2px";
        
        chatHeaderName.parentNode.appendChild(usernameSubElement);
    }
    usernameSubElement.innerText = `@${username}`;
}

// 📥 റിയൽ-ടൈം ലിസണർ
function listenForMessages() {
    if (!roomId) return;
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = ""; 
        
        snapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");

            if (data.sender === myUid) {
                msgDiv.classList.add("sent");
            } else {
                msgDiv.classList.add("received");
            }

            msgDiv.innerText = data.text;
            chatBox.appendChild(msgDiv);
        });
        
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// 📤 മെസ്സേജ് സെന്റിങ് ലോജിക് (300 ലിമിറ്റ് ഫിക്സിനൊപ്പം)
sendBtn.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (text === "" || !roomId || !myUid) return;

    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    messageInput.value = ""; // ഇൻപുട്ട് പെട്ടെന്ന് ക്ലിയർ ചെയ്യുന്നു (Better UX)

    try {
        await addDoc(messagesRef, {
            text: text,
            sender: myUid,
            createdAt: serverTimestamp()
        });

        // 300 മെസ്സേജിൽ കൂടുതൽ ഉണ്ടെങ്കിൽ പഴയവ ഡിലീറ്റ് ചെയ്യാനുള്ള ലോജിക്
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
        console.error("Message sending failed:", error);
    }
});

// Enter കീ പ്രസ്സ് ചെയ്യുമ്പോൾ സെന്റ് ആകാൻ
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendBtn.click();
    }
});
