// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP (v10 SDK)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

console.log("Auth System Connected successfully!");

// ==========================================
// 2. 🔒 STRICT REDIRECT LOGIC (യൂസർ ഉണ്ടെങ്കിൽ auth പേജ് കാണിക്കില്ല)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const currentUser = localStorage.getItem("infinity_user");
    if (currentUser) {
        // ഡാറ്റ ഉണ്ടെങ്കിൽ നേരെ ഹോമിലേക്ക് വിടുന്നു (GitHub Pages friendly relative path)
        window.location.replace("./home.html"); 
    } else {
        document.body.style.display = "flex"; 
    }
});

// HTML എലമെന്റുകൾ
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const usernameInput = document.getElementById('usernameInput');
const fullNameInput = document.getElementById('fullNameInput');
const signUpBtn = document.getElementById('signUpBtn');
const usernameStatus = document.getElementById('usernameStatus');

const randomStickers = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=Felix",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Jack",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Midnight",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Buddy"
];

let isUsernameValid = false;

// ==========================================
// 3. REALTIME USERNAME AVAILABILITY CHECK
// ==========================================
if (usernameInput) {
    usernameInput.addEventListener('input', async () => {
        const username = usernameInput.value.trim().toLowerCase();
        const usernameRegex = /^[a-zA-Z0-9_]+$/;

        usernameStatus.style.display = "block";
        usernameStatus.style.color = "#aaaaaa";
        usernameStatus.innerText = "checking...";
        isUsernameValid = false;
        checkFormValidity();

        if (username.length < 3) {
            usernameStatus.style.color = "#ff4d4d";
            usernameStatus.innerText = "യൂസർനെയിമിന് കുറഞ്ഞത് 3 അക്ഷരങ്ങൾ വേണം!";
            return;
        }

        if (!usernameRegex.test(username)) {
            usernameStatus.style.color = "#ff4d4d";
            usernameStatus.innerText = "യൂസർനെയിമിൽ സ്പേസോ സ്പെഷ്യൽ ക്യാരക്ടറോ പാടില്ല!";
            return;
        }

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                usernameStatus.style.color = "#ff4d4d";
                usernameStatus.innerText = "❌ This username is already taken!";
                isUsernameValid = false;
            } else {
                usernameStatus.style.color = "#00ff66";
                usernameStatus.innerText = "✅ This username is available!";
                isUsernameValid = true;
            }
            checkFormValidity();
        } catch (error) {
            console.error("Error checking username: ", error);
            usernameStatus.style.color = "#ff4d4d";
            usernameStatus.innerText = "⚠️ Error.";
            isUsernameValid = false;
            checkFormValidity();
        }
    });
}

if (emailInput && passwordInput && fullNameInput) {
    [emailInput, passwordInput, fullNameInput].forEach(input => {
        input.addEventListener('input', checkFormValidity);
    });
}

function checkFormValidity() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const fullName = fullNameInput.value.trim();

    if (isUsernameValid && email.includes('@') && password.length >= 6 && fullName.length > 0) {
        signUpBtn.disabled = false;
    } else {
        signUpBtn.disabled = true;
    }
}

// ==========================================
// 4. SIGN UP LOGIC & LOCALSTORAGE SAVE
// ==========================================
if (signUpBtn) {
    signUpBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const username = usernameInput.value.trim().toLowerCase();
        const fullName = fullNameInput.value.trim();

        signUpBtn.innerText = "Creating account...";
        signUpBtn.disabled = true;

        const randomProfilePic = randomStickers[Math.floor(Math.random() * randomStickers.length)];

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userUid = userCredential.user.uid; 

            const userDataForFirestore = {
                uid: userUid,
                email: email,
                username: username,
                fullName: fullName,
                profilePic: randomProfilePic,
                isVerified: false, 
                createdAt: serverTimestamp() 
            };

            await setDoc(doc(db, "users", userUid), userDataForFirestore);

            // 💾 ലോക്കൽ സ്റ്റോറേജിലേക്ക് ഡാറ്റ സേവ് ചെയ്യുന്നു
            const userDataForLocal = {
                uid: userUid,
                email: email,
                username: username,
                fullName: fullName,
                profilePic: randomProfilePic,
                isVerified: false,
                createdAt: new Date().toISOString() 
            };

            localStorage.setItem("infinity_user", JSON.stringify(userDataForLocal));

            alert("Account created successfully!");
            
            // ലോക്കൽ സ്റ്റോറേജ് സെറ്റ് ചെയ്ത ശേഷം നേരെ ഹോമിലേക്ക് വിടുന്നു
            window.location.replace("./home.html"); 

        } catch (error) {
            console.error("Error signing up:", error);
            localStorage.removeItem("infinity_user"); // എറർ വന്നാൽ ഡാറ്റ ഉണ്ടെന്ന് തെറ്റിദ്ധരിക്കാതിരിക്കാൻ ക്ലിയർ ചെയ്യുന്നു
            alert("Sign up unsuccessful: " + error.message);
            signUpBtn.innerText = "തുടങ്ങാം!";
            signUpBtn.disabled = false;
        }
    });
}
