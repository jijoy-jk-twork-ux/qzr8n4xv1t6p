import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc,
    query,       // 🔹 വിട്ടുപോയത് ചേർത്തു
    where,       // 🔹 വിട്ടുപോയത് ചേർത്തു
    getDocs      // 🔹 വിട്ടുപോയത് ചേർത്തു
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentUserId = localStorage.getItem("userUid");
if (!currentUserId) {
    currentUserId = "USER_" + Math.floor(Math.random() * 10000);
    localStorage.setItem("userUid", currentUserId);
}

// 1. ഫയർബേസിൽ നിന്ന് യൂസറുടെ സെറ്റിംഗ്സും അക്കൗണ്ട് വിവരങ്ങളും ലോഡ് ചെയ്യുന്നു
async function loadUserSettings() {
    try {
        const userRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Account Center Banner Update (Username, Wins, Name, Email)
            const displayUser = data.username || currentUserId;
            document.getElementById("acc-username").innerText = `@${displayUser} • ${data.wins || 0} Wins`;

            // Toggles load
            if (data.settings) {
                if (document.getElementById("setting-mentions")) document.getElementById("setting-mentions").checked = data.settings.allowMentions || false;
                if (document.getElementById("setting-muted")) document.getElementById("setting-muted").checked = data.settings.isMuted || false;
                if (document.getElementById("setting-datasaver")) document.getElementById("setting-datasaver").checked = data.settings.dataSaver || false;
                if (document.getElementById("setting-family")) document.getElementById("setting-family").checked = data.settings.familyMode || false;
                if (document.getElementById("setting-messages") && data.settings.messages) {
                    document.getElementById("setting-messages").value = data.settings.messages;
                }
            }
        } else {
            // പുതിയ യൂസർമാർക്കായി ബോക്സ് ക്രിയേറ്റ് ചെയ്യുന്നു
            await setDoc(userRef, {
                username: "User_" + Math.floor(Math.random() * 1000),
                name: "User Name",
                email: "user@example.com",
                wins: 0,
                bio: "Welcome to my Spymo profile!",
                isVerified: false,
                settings: {
                    allowMentions: true,
                    isMuted: false,
                    dataSaver: false,
                    familyMode: false,
                    messages: "everyone"
                }
            });
            loadUserSettings();
        }
    } catch (e) {
        console.error("Error loading user settings: ", e);
    }
}

// 3. 💎 Account Center Pop-up Logic (Username, Name, Email, Bio ശരിയായി കാണിക്കുന്നു)
window.openAccountCenter = async function() {
    try {
        const userRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const d = docSnap.data();
            
            if (document.getElementById("accUserId")) document.getElementById("accUserId").value = currentUserId;
            if (document.getElementById("accDisplayUsername")) document.getElementById("accDisplayUsername").value = d.username || "";
            if (document.getElementById("accDisplayName")) document.getElementById("accDisplayName").value = d.name || "";
            if (document.getElementById("accDisplayEmail")) document.getElementById("accDisplayEmail").value = d.email || "";
            if (document.getElementById("accBio")) document.getElementById("accBio").value = d.bio || "";
            if (document.getElementById("accWins")) document.getElementById("accWins").value = d.wins || 0;
            
            document.getElementById("accountModal").style.display = "flex";
        }
    } catch (e) {
        console.error("Error opening account modal: ", e);
    }
};

window.closeAccountModal = function() {
    document.getElementById("accountModal").style.display = "none";
};

// അക്കൗണ്ട് വിവരങ്ങൾ അപ്‌ഡേറ്റ് ചെയ്യുന്നു
window.saveAccountDetails = async function(event) {
    event.preventDefault();
    
    const newUsername = document.getElementById("accDisplayUsername") ? document.getElementById("accDisplayUsername").value : "";
    const newName = document.getElementById("accDisplayName") ? document.getElementById("accDisplayName").value : "";
    const newEmail = document.getElementById("accDisplayEmail") ? document.getElementById("accDisplayEmail").value : "";
    const newBio = document.getElementById("accBio") ? document.getElementById("accBio").value : "";
    
    try {
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, { 
            username: newUsername,
            name: newName,
            email: newEmail,
            bio: newBio 
        });
        
        alert("✅ Account details saved successfully!");
        closeAccountModal();
        loadUserSettings(); // ഡാറ്റ പുതുക്കാൻ ഫംഗ്ഷൻ വീണ്ടും റൺ ചെയ്യുന്നു
    } catch (e) {
        console.error("Save error: ", e);
        alert("❌ Failed to save changes.");
    }
};


// 2. സെറ്റിംഗ്സ് ടോഗിളുകൾ ഫയർബേസിലേക്ക് ഓട്ടോ-സേവ് ചെയ്യുന്നു
window.toggleSetting = async function(key, value) {
    try {
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, {
            [`settings.${key}`]: value
        });
    } catch (e) {
        console.error("Error updating setting: ", e);
    }
};

window.updateSetting = async function(key, value) {
    window.toggleSetting(key, value);
};


// 4. Follow & Invite Link Share
window.shareInviteLink = function() {
    const inviteUrl = `https://spymo.app/invite?ref=${currentUserId}`;
    navigator.clipboard.writeText(inviteUrl);
    alert("🔗 Spymo Invite Link copied to clipboard!\n" + inviteUrl);
};

// 5. 🌟 Creator Badge Application Pop-up Logic
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxKZvJ3OWuPdkCfxQk2WhMmUi7lY024ZNeBMnRa65NyE6CTYM1dkAn0N7NVQ4SmeF8J/exec";

window.applyCreatorBadge = async function() {
    document.getElementById("badgeModal").style.display = "flex";
    await checkVerificationStatus();
};

window.closeBadgeModal = function() {
    document.getElementById("badgeModal").style.display = "none";
};

window.submitBadgeApplication = async function(event) {
    event.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.innerText = "Submitting...";
    submitBtn.disabled = true;

    // HTML-ലെ correct ID കൃത്യമായി കൊടുക്കുക (badgeMessage അല്ലെങ്കിൽ badgeReason)
const username = document.getElementById("badgeUsername").value;
const email = document.getElementById("badgeEmail").value;
const reasonText = document.getElementById("badgeMessage") ? document.getElementById("badgeMessage").value : "";

const payload = {
    userId: currentUserId,
    username: username,
    email: email,
    reason: reasonText, // 🔹 'message' എന്നതിന് പകരം 'reason' എന്ന് നൽകുക
    appliedAt: new Date().toLocaleString()
};


    try {
        // 🔹 'verification_requests' എന്ന കളക്ഷനിലേക്ക് മാറ്റിയതുകൊണ്ട് ഇനി Security Rule എറർ വരില്ല
        await addDoc(collection(db, "verification_requests"), payload);

        if (GOOGLE_SCRIPT_URL) {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        alert("🎉 Creator Badge Application Submitted Successfully!");
        document.getElementById("badgeForm").reset();
        closeBadgeModal();

    } catch (error) {
        console.error("Submission Error: ", error);
        alert("❌ Something went wrong. Please try again!");
    } finally {
        submitBtn.innerText = "Submit Application";
        submitBtn.disabled = false;
    }
};

async function checkVerificationStatus() {
    const statusTag = document.getElementById("badge-status-tag");
    const submitBtn = document.getElementById("submitBtn");

    if (!statusTag || !submitBtn) return;

    try {
        // 1. യൂസർ Verified ആണോ എന്ന് ഫയർബേസിലെ 'users' കളക്ഷനിൽ നോക്കുന്നു
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // 🔹 boolean true ആണോ അതോ string "true" ആണോ എന്ന് രണ്ട് തരത്തിലും ചെക്ക് ചെയ്യുന്നു
            if (userData.isVerified === true || userData.isVerified === "true") {
                statusTag.innerText = "✓ Verified Creator";
                statusTag.className = "status-badge status-verified";
                submitBtn.innerText = "Already Verified";
                submitBtn.disabled = true;
                return; // Verified ആണെങ്കിൽ ഇവിടെ വെച്ച് സ്റ്റോപ്പ് ചെയ്യും
            }
        }

        // 2. Verified അല്ലെങ്കില്‍ മാത്രം അപേക്ഷ സമർപ്പിച്ച് Pending ആണോ എന്ന് നോക്കുന്നു
        const q = query(
            collection(db, "verification_requests"), 
            where("userId", "==", currentUserId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            statusTag.innerText = "⏳ Under Review";
            statusTag.className = "status-badge status-pending";
            submitBtn.innerText = "Application Submitted";
            submitBtn.disabled = true;
        } else {
            statusTag.innerText = "Not Verified";
            statusTag.className = "status-badge status-unverified";
            submitBtn.innerText = "Submit Application";
            submitBtn.disabled = false;
        }

    } catch (error) {
        console.error("Error checking verification status:", error);
    }
}


// 6. Report Issue
window.reportIssue = async function() {
    const issue = prompt("Describe the bug or problem you are facing:");
    if (issue) {
        await addDoc(collection(db, "reports"), {
            userId: currentUserId,
            issue: issue,
            reportedAt: new Date().toISOString()
        });
        alert("✅ Thank you! Your report has been submitted to Spymo support.");
    }
};

loadUserSettings();
