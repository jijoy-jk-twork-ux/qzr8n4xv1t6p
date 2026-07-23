import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc 
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

// 1. ഫയർബേസിൽ നിന്ന് യൂസറുടെ സെറ്റിംഗ്സ് ഡാറ്റ ലോഡ് ചെയ്യുന്നു
async function loadUserSettings() {
    const userRef = doc(db, "users", currentUserId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Account Center Banner Update
        document.getElementById("acc-username").innerText = `@${data.username || currentUserId} • ${data.wins || 0} Wins`;

        // Toggles load
        if (data.settings) {
            document.getElementById("setting-mentions").checked = data.settings.allowMentions || false;
            document.getElementById("setting-muted").checked = data.settings.isMuted || false;
            document.getElementById("setting-datasaver").checked = data.settings.dataSaver || false;
            document.getElementById("setting-family").checked = data.settings.familyMode || false;
            if (data.settings.messages) {
                document.getElementById("setting-messages").value = data.settings.messages;
            }
        }
    } else {
        await setDoc(userRef, {
            username: "User_" + Math.floor(Math.random() * 1000),
            wins: 0,
            bio: "",
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
}

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

// 3. 💎 Account Center Pop-up Logic
window.openAccountCenter = async function() {
    const userRef = doc(db, "users", currentUserId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById("accUserId").value = currentUserId;
        document.getElementById("accDisplayUsername").value = d.username || currentUserId;
        document.getElementById("accBio").value = d.bio || "";
        document.getElementById("accWins").value = d.wins || 0;
        
        document.getElementById("accountModal").style.display = "flex";
    }
};

window.closeAccountModal = function() {
    document.getElementById("accountModal").style.display = "none";
};

window.saveAccountDetails = async function(event) {
    event.preventDefault();
    const bio = document.getElementById("accBio").value;
    
    try {
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, { bio: bio });
        alert("✅ Account details saved successfully!");
        closeAccountModal();
    } catch (e) {
        console.error("Save error: ", e);
        alert("❌ Failed to save changes.");
    }
};

// 4. Follow & Invite Link Share
window.shareInviteLink = function() {
    const inviteUrl = `https://spymo.app/invite?ref=${currentUserId}`;
    navigator.clipboard.writeText(inviteUrl);
    alert("🔗 Spymo Invite Link copied to clipboard!\n" + inviteUrl);
};

// 5. 🌟 Creator Badge Application Pop-up Logic
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxKZvJ3OWuPdkCfxQk2WhMmUi7lY024ZNeBMnRa65NyE6CTYM1dkAn0N7NVQ4SmeF8J/exec";

window.applyCreatorBadge = function() {
    document.getElementById("badgeModal").style.display = "flex";
};

window.closeBadgeModal = function() {
    document.getElementById("badgeModal").style.display = "none";
};

window.submitBadgeApplication = async function(event) {
    event.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.innerText = "Submitting...";
    submitBtn.disabled = true;

    const username = document.getElementById("badgeUsername").value;
    const email = document.getElementById("badgeEmail").value;
    const message = document.getElementById("badgeMessage").value;

    const payload = {
        userId: currentUserId,
        username: username,
        email: email,
        message: message,
        appliedAt: new Date().toLocaleString()
    };

    try {
        await addDoc(collection(db, "badge_requests"), payload);

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
// Modal Open ചെയ്യുന്ന ഫംഗ്ഷനിൽ സ്റ്റാറ്റസ് ചെക്ക് കൂടി ഉൾപ്പെടുത്തുന്നു
window.applyCreatorBadge = async function() {
    document.getElementById("badgeModal").style.display = "flex";
    await checkVerificationStatus();
};

async function checkVerificationStatus() {
    const statusTag = document.getElementById("badge-status-tag");
    const submitBtn = document.getElementById("submitBtn");
    const badgeForm = document.getElementById("badgeForm");

    if (!statusTag || !submitBtn) return;

    try {
        // 1. യൂസർ Verified ആണോ എന്ന് ആദ്യം ഫയർബേസിൽ നോക്കുന്നു
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().isVerified === true) {
            statusTag.innerText = "✓ Verified Creator";
            statusTag.className = "status-badge status-verified";
            submitBtn.innerText = "Already Verified";
            submitBtn.disabled = true;
            return;
        }

        // 2. Verified അല്ലെങ്കില്‍, അപേക്ഷ സമർപ്പിച്ച് Pending ആണോ എന്ന് നോക്കുന്നു
        const q = query(
            collection(db, "badge_requests"), 
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
