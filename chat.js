// നിന്റെ ഫയർബേസ് കോൺഫിഗറേഷൻ ഫയലിൽ നിന്ന് db-യും auth-ഉം ഇമ്പോർട്ട് ചെയ്യുക
import { db, auth } from "./config.js"; 
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const chatHeaderName = document.getElementById("chat-user-name");

let roomId = "";
let myUid = "";

// 1. URL-ൽ നിന്ന് ചാറ്റ് ചെയ്യേണ്ട ആളുടെ ഐഡി (target) മാത്രം എടുക്കുന്നു
const urlParams = new URLSearchParams(window.location.search);
const theirUid = urlParams.get('target'); 

// 2. ഐഡി ഇല്ലെങ്കിൽ തിരികെ ഹോമിലേക്ക് വിടുന്നു
if (!theirUid) {
    alert("ആരുമായാണ് ചാറ്റ് ചെയ്യേണ്ടത് എന്ന് വ്യക്തമല്ല!");
    window.location.href = "home.html"; 
}

// 3. യൂസർ ലോഗിൻ സ്റ്റേറ്റ് ചെക്ക് ചെയ്യുന്നു
auth.onAuthStateChanged(async (user) => {
    if (user) {
        myUid = user.uid;
        
        // രണ്ട് പേരുടെയും UID വെച്ച് യുണീക്ക് റൂം ഐഡി ഉണ്ടാക്കുന്നു
        roomId = myUid < theirUid ? `${myUid}_${theirUid}` : `${theirUid}_${myUid}`;
        
        // ഓട്ടോമാറ്റിക് ആയി മറ്റേ യൂസറുടെ വിവരങ്ങൾ ഫയർബേസിൽ നിന്ന് കണ്ടുപിടിക്കുന്നു
        await fetchChatPartnerName();
        
        // മെസ്സേജുകൾ തത്സമയം കാണാൻ ലിസൺ ചെയ്യുന്നു
        listenForMessages();
    } else {
        console.log("യൂസർ ലോഗിൻ ചെയ്തിട്ടില്ല!");
    }
});

// 🔍 ചാറ്റ് ചെയ്യുന്ന ആളുടെ പേരും യൂസർനെയിമും ഫയർബേസിൽ നിന്ന് എടുക്കുന്ന ഫങ്ഷൻ
async function fetchChatPartnerName() {
    try {
        const userDocRef = doc(db, "users", theirUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // ഫയർബേസിലെ 'username' ഫീൽഡ് എടുക്കുന്നു
            const partnerUsername = userData.username || "unknown";
            
            // ഹെഡറിലെ മെയിൻ പേര് മാറ്റുന്നു
            chatHeaderName.innerText = partnerUsername;
            
            // 👈 താഴെ ചെറിയ അക്ഷരത്തിൽ @username എന്ന് കൂടി കാണിക്കാൻ വേണ്ടി
            displaySubUsername(partnerUsername);
            
        } else {
            chatHeaderName.innerText = "Chat User";
            console.log("അങ്ങനെയൊരു യൂസർ ഫയർബേസിൽ ഇല്ല!");
        }
    } catch (error) {
        console.error("യൂസറുടെ വിവരങ്ങൾ എടുക്കുന്നതിൽ എറർ:", error);
        chatHeaderName.innerText = "Chat Room";
    }
}

// 🔍 യൂസർനെയിം സബ്‌ടൈറ്റിൽ ആയി കാണിക്കുന്ന ഫങ്ഷൻ
function displaySubUsername(username) {
    let usernameSubElement = document.getElementById("chat-user-subname");
    
    if (!usernameSubElement) {
        usernameSubElement = document.createElement("small");
        usernameSubElement.id = "chat-user-subname";
        usernameSubElement.style.display = "block";
        usernameSubElement.style.fontSize = "0.75rem";
        usernameSubElement.style.opacity = "0.8";
        usernameSubElement.style.marginTop = "4px";
        
        chatHeaderName.parentNode.appendChild(usernameSubElement);
    }
    
    // പേരിന് താഴെ @username എന്ന് സെറ്റ് ചെയ്യുന്നു
    usernameSubElement.innerText = `@${username}`;
}

// 📥 മെസ്സേജുകൾ റിയൽ-ടൈം ആയി കാണിക്കുന്ന ഫങ്ഷൻ
function listenForMessages() {
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

// 📤 മെസ്സേജ് അയക്കാനും 300 ലിമിറ്റ് ചെക്ക് ചെയ്യാനുമുള്ള ലോജിക്
sendBtn.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (text === "" || !roomId) return;

    const messagesRef = collection(db, "chatRooms", roomId, "messages");

    try {
        await addDoc(messagesRef, {
            text: text,
            sender: myUid,
            createdAt: serverTimestamp()
        });

        messageInput.value = ""; 

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
        console.error("പ്രശ്നം:", error);
    }
});

// Enter കീ പ്രസ്സ് ചെയ്യുമ്പോൾ സെന്റ് ആകാൻ
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendBtn.click();
    }
});
