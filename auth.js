// 1. ഫയർബേസ് കോൺഫിഗറേഷൻ
const firebaseConfig = {
    apiKey: "AIzaSyCNQaHi-L3fninLxkePZBaNR7vu6JiYEwQ",
    authDomain: "infinityspotx.firebaseapp.com",
    projectId: "infinityspotx",
    storageBucket: "infinityspotx.firebasestorage.app",
    messagingSenderId: "400346792298",
    appId: "1:400346792298:web:5fd101c225a547902b6513"
};

// ഫയർബേസ് ഇനിഷ്യലൈസ് ചെയ്യുന്നു
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// 2. ലോഗിൻ ചെയ്തിട്ടുണ്ടെങ്കിൽ നേരെ home.html ലേക്ക് പോകും
document.addEventListener("DOMContentLoaded", () => {
    const currentUser = localStorage.getItem("infinity_user");
    if (currentUser) {
        window.location.href = "home.html"; 
    } else {
        document.body.style.display = "flex"; // സെന്റർ അലൈൻമെന്റ് തെറ്റാതിരിക്കാൻ 'flex' ആക്കി
    }
});

// HTML എലമെന്റുകൾ എടുക്കുന്നു
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

// 3. യൂസർനെയിം അവൈലബിലിറ്റി തത്സമയം പരിശോധിക്കുന്നു
usernameInput.addEventListener('input', async () => {
    const username = usernameInput.value.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_]+$/;

    // ടൈപ്പ് ചെയ്യാൻ തുടങ്ങുമ്പോൾ തന്നെ പഴയ സ്റ്റാറ്റസ് ക്ലിയർ ചെയ്യുക
    usernameStatus.style.display = "block";
    usernameStatus.style.color = "#aaaaaa";
    usernameStatus.innerText = "പരിശോധിക്കുന്നു...";
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
        const userRef = db.collection('users').doc(username);
        const doc = await userRef.get();

        if (doc.exists) {
            usernameStatus.style.color = "#ff4d4d";
            usernameStatus.innerText = "❌ ഈ യൂസർനെയിം ഇതിനകം എടുത്തതാണ്!";
            isUsernameValid = false;
        } else {
            usernameStatus.style.color = "#00ff66";
            usernameStatus.innerText = "✅ ഈ യൂസർനെയിം ലഭ്യമാണ്!";
            isUsernameValid = true;
        }
        checkFormValidity();
    } catch (error) {
        console.error("Error checking username: ", error);
        usernameStatus.style.color = "#ff4d4d";
        usernameStatus.innerText = "⚠️ ഡാറ്റാബേസ് എറർ! Firestore എനേബിൾ ചെയ്തിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക.";
        isUsernameValid = false;
        checkFormValidity();
    }
});

// ഫോമിലെ എല്ലാ ബോക്സുകളും ടൈപ്പ് ചെയ്യുമ്പോൾ വാലിഡിറ്റി ചെക്ക് ചെയ്യും
[emailInput, passwordInput, fullNameInput].forEach(input => {
    input.addEventListener('input', checkFormValidity);
});

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

// 4. സൈൻ അപ്പ് ബട്ടൺ ക്ലിക്ക് ചെയ്യുമ്പോൾ
signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    const fullName = fullNameInput.value.trim();

    signUpBtn.innerText = "അക്കൗണ്ട് നിർമ്മിക്കുന്നു...";
    signUpBtn.disabled = true;

    const randomProfilePic = randomStickers[Math.floor(Math.random() * randomStickers.length)];

    try {
        // എ) ഫയർബേസ് ഓതന്റിക്കേഷൻ വഴി യൂസറെ ക്രിയേറ്റ് ചെയ്യുന്നു
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userUid = userCredential.user.uid;

        // ബി) യൂസറുടെ ഡാറ്റ Firestore-ലേക്ക് സേവ് ചെയ്യുന്നു
        const userData = {
            uid: userUid,
            email: email,
            username: username,
            fullName: fullName,
            profilePic: randomProfilePic,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(username).set(userData);

        // സി) ലോക്കൽ സ്റ്റോറേജിലേക്ക് ഡാറ്റ മാറ്റുന്നു
        localStorage.setItem("infinity_user", JSON.stringify(userData));

        alert("അക്കൗണ്ട് വിജയകരമായി നിർമ്മിച്ചു!");
        window.location.href = "home.html"; 

    } catch (error) {
        console.error("Error signing up:", error);
        alert("സൈൻ അപ്പ് പരാജയപ്പെട്ടു: " + error.message);
        signUpBtn.innerText = "തുടങ്ങാം!";
        signUpBtn.disabled = false;
    }
});

// auth.js
// പുതിയ കോഡ്:
document.addEventListener("DOMContentLoaded", () => {
    const currentUser = localStorage.getItem("infinity_user");
    if (currentUser) {
        window.location.href = "home.html"; 
    } else {
        document.body.style.display = "flex"; // <-- ഇവിടെ 'flex' എന്ന് മാറ്റുക
    }
});
