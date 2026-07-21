import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ഫയർബേസ് കോൺഫിഗറേഷൻ
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

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const emailInput = document.getElementById('login-email').value.trim().toLowerCase();

    loginBtn.innerText = "Verifying...";
    loginBtn.disabled = true;

    try {
        // 1. ഡാറ്റാബേസിൽ ഈ ഇമെയിൽ ഉള്ള യൂസറെ തിരയുന്നു
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", emailInput));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            let userFound = false;

            querySnapshot.forEach((docSnap) => {
                const userData = docSnap.data();

                // 2. ഇമെയിലും യൂസർ ടൈപ്പ് ചെയ്ത Username-ഉം മാച്ച് ആവുന്നുണ്ടോ എന്ന് നോക്കുന്നു
                if (userData.username.toLowerCase() === usernameInput) {
                    userFound = true;

                    // 3. LocalStorage-ൽ ലോഗിൻ വിവരങ്ങൾ സേവ് ചെയ്യുന്നു
                    const userInfo = {
                        uid: userData.uid || docSnap.id,
                        username: userData.username,
                        profilePic: userData.profilePic || "https://via.placeholder.com/40/ff1e42/ffffff?text=U"
                    };
                    localStorage.setItem("infinity_user", JSON.stringify(userInfo));

                    alert("Login successful");
                    window.location.href = "home.html"; // ഹോം പേജിലേക്ക് പോകുന്നു
                }
            });

            if (!userFound) {
                alert("The provided username does not match this emai!");
            }

        } else {
            alert("No account found with this email!");
        }

    } catch (error) {
        console.error("Login Error:", error);
        alert("Unable to login: " + error.message);
    } finally {
        loginBtn.innerText = "Log In";
        loginBtn.disabled = false;
    }
});
