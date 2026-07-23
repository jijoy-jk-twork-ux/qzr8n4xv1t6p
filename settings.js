import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc,
    query,       
    where,       
    getDocs      
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
            
            // Account Center Banner Update (Username, Wins)
            const displayUser = data.username || currentUserId;
            if(document.getElementById("acc-username")) {
                document.getElementById("acc-username").innerText = `@${displayUser} • ${data.wins || 0} Wins`;
            }

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

// 2. 💎 Account Center Pop-up Logic
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
        loadUserSettings(); 
    } catch (e) {
        console.error("Save error: ", e);
        alert("❌ Failed to save changes.");
    }
};

// 3. സെറ്റിംഗ്സ് ടോഗിളുകൾ
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

// 4. Invite Share
window.shareInviteLink = function() {
    const inviteUrl = `https://spymo.app/invite?ref=${currentUserId}`;
    navigator.clipboard.writeText(inviteUrl);
    alert("🔗 Spymo Invite Link copied to clipboard!\n" + inviteUrl);
};

// 5. 🌟 Creator Badge Application Pop-up Logic
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxKZvJ3OWuPdkCfxQk2WhMmUi7lY024ZNeBMnRa65NyE6CTYM1dkAn0N7NVQ4SmeF8J/exec";

window.applyCreatorBadge = async function() {
    const badgeModal = document.getElementById("badgeModal");
    if (badgeModal) badgeModal.style.display = "flex";
    
    // ഫയർബേസിൽ നിന്ന് യൂസറുടെ ഇൻഫോ എടുത്ത് Form-ൽ തനിയെ ഫിൽ ചെയ്യുന്നു
    try {
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (document.getElementById("badgeUsername")) document.getElementById("badgeUsername").value = userData.username || "";
            if (document.getElementById("badgeEmail")) document.getElementById("badgeEmail").value = userData.email || "";
        }
    } catch(err) {
        console.error("Error pre-filling badge form: ", err);
    }

    checkVerificationStatus(); // status ഓട്ടോമാറ്റിക്കായി ബാക്ക്ഗ്രൗണ്ടിൽ ചെക്ക് ചെയ്യും
};

window.closeBadgeModal = function() {
    const badgeModal = document.getElementById("badgeModal");
    if (badgeModal) badgeModal.style.display = "none";
};

window.submitBadgeApplication = async function(event) {
    if (event) event.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
        submitBtn.innerText = "Submitting...";
        submitBtn.disabled = true;
    }

    const usernameObj = document.getElementById("badgeUsername");
    const emailObj = document.getElementById("badgeEmail");
    const msgObj = document.getElementById("badgeMessage") || document.getElementById("badgeReason");

    const username = usernameObj ? usernameObj.value : "";
    const email = emailObj ? emailObj.value : "";
    const reasonText = msgObj ? msgObj.value : "";

    const payload = {
        userId: currentUserId,
        username: username,
        email: email,
        reason: reasonText,
        appliedAt: new Date().toLocaleString()
    };

    try {
        // 1. ഫയർബേസിലേക്ക് റിക്വസ്റ്റ് ചേർക്കുന്നു
        await addDoc(collection(db, "verification_requests"), payload);

        // 2. Google Script (Telegram Bot)-ലേക്ക് അയക്കുന്നു
        if (GOOGLE_SCRIPT_URL) {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).catch(e => console.error("Google Script Fetch Error:", e));
        }

        alert("🎉 Creator Badge Application Submitted Successfully!");
        const badgeForm = document.getElementById("badgeForm");
        if (badgeForm) badgeForm.reset();
        closeBadgeModal();

    } catch (error) {
        console.error("Submission Error: ", error);
        alert("❌ Something went wrong while submitting. Please check your rules!");
    } finally {
        if (submitBtn) {
            submitBtn.innerText = "Submit Application";
            submitBtn.disabled = false;
        }
    }
};

async function checkVerificationStatus() {
    const statusTag = document.getElementById("badge-status-tag");
    const submitBtn = document.getElementById("submitBtn");

    if (!statusTag || !submitBtn) return;

    try {
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.isVerified === true || userData.isVerified === "true") {
                statusTag.innerText = "✓ Verified Creator";
                statusTag.className = "status-badge status-verified";
                submitBtn.innerText = "Already Verified";
                submitBtn.disabled = true;
                return;
            }
        }

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

// പേജ് ലോഡ് ആവുമ്പോൾ റൺ ചെയ്യുന്നു
loadUserSettings();
