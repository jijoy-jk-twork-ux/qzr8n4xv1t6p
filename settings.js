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
    getDocs,
    serverTimestamp
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

// 🔑 Secret Passcode for Music Upload
const SECRET_PASSCODE = "2425";

let currentUserId = localStorage.getItem("userUid");
if (!currentUserId) {
    currentUserId = "USER_" + Math.floor(Math.random() * 10000);
    localStorage.setItem("userUid", currentUserId);
}

// 1. ഫയർബേസിൽ നിന്ന് യൂസറുടെ സെറ്റിംഗ്സ് ഡാറ്റ ലോഡ് ചെയ്യുന്നു
async function loadUserSettings() {
    try {
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
    } catch (e) {
        console.error("Error loading settings:", e);
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
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFgihF_1-_tknI04jzKAySeJxD3tbtVOorlreveAPqGVXCyBbaaj7Lsz9p1JFLLcCX/exec";

window.applyCreatorBadge = async function() {
    document.getElementById("badgeModal").style.display = "flex";
    await checkVerificationStatus();
};

window.closeBadgeModal = function() {
    document.getElementById("badgeModal").style.display = "none";
};

async function checkVerificationStatus() {
    const statusTag = document.getElementById("badge-status-tag");
    const submitBtn = document.getElementById("submitBtn");

    if (!statusTag || !submitBtn) return;

    try {
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        // 🟢 1. അക്കൗണ്ട് വെരിഫൈഡ് ആണെങ്കിൽ (Green Badge)
        if (userDocSnap.exists() && userDocSnap.data().isVerified === true) {
            statusTag.innerText = "✓ Verified Creator";
            statusTag.className = "status-badge status-verified";
            submitBtn.innerText = "Already Verified";
            submitBtn.disabled = true;
            return;
        }

        // 🟠 2. അപേക്ഷ സമർപ്പിച്ച് റിവ്യൂവിൽ ആണെങ്കിൽ (Orange Badge)
        // 💡 ശ്രദ്ധിക്കുക: Firestore-ലെ കളക്ഷൻ പേര് 'verification_requests' എന്ന് തന്നെ ഉറപ്പാക്കുക
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
            // 🔴 3. വെരിഫൈഡ് അല്ല / അപേക്ഷിച്ചിട്ടില്ല (Red Badge)
            statusTag.innerText = "✖ Not Verified";
            statusTag.className = "status-badge status-not-verified"; // 'status-not-verified' ആക്കി
            submitBtn.innerText = "Submit Application";
            submitBtn.disabled = false;
        }

    } catch (error) {
        console.error("Error checking verification status:", error);
    }
}

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

// 6. 🎵 Music Passcode & Upload Logic
window.openMusicPasscodeModal = function() {
    document.getElementById("musicPasscodeModal").style.display = "flex";
    document.getElementById("musicPasscode").value = "";
    document.getElementById("passcodeError").style.display = "none";
};

window.closeMusicPasscodeModal = function() {
    document.getElementById("musicPasscodeModal").style.display = "none";
};

window.closeMusicUploadModal = function() {
    document.getElementById("musicUploadModal").style.display = "none";
};

window.verifyMusicPasscode = function() {
    const inputCode = document.getElementById("musicPasscode").value;
    if (inputCode === SECRET_PASSCODE) {
        closeMusicPasscodeModal();
        document.getElementById("musicUploadModal").style.display = "flex";
    } else {
        document.getElementById("passcodeError").style.display = "block";
    }
};

window.uploadMusicToFirestore = async function(event) {
    event.preventDefault();
    const btn = document.getElementById("mSubmitBtn");
    btn.innerText = "Uploading...";
    btn.disabled = true;

    const title = document.getElementById("mTitle").value;
    const artist = document.getElementById("mArtist").value;
    const audioUrl = document.getElementById("mAudioUrl").value;
    const duration = document.getElementById("mDuration").value;

    try {
        await addDoc(collection(db, "music_library"), {
            title: title,
            artist: artist,
            audioUrl: audioUrl,
            duration: duration,
            createdAt: serverTimestamp()
        });

        alert("🎉 Music successfully added to Spymo Library!");
        document.getElementById("musicForm").reset();
        closeMusicUploadModal();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to add music: " + error.message);
    } finally {
        btn.innerText = "Save Song to Library";
        btn.disabled = false;
    }
};

// 7. Report Issue
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

// Initial Load
loadUserSettings();
