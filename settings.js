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

// 🔑 1. ഫയർബേസ് Auth ഇമ്പോർട്ട് ചെയ്യുന്നു
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth = getAuth(app); // 🔑 Auth ഇനീഷ്യലൈസ് ചെയ്യുന്നു

// 🔑 Secret Passcode for Music Upload
const SECRET_PASSCODE = "2425";

// 🔑 Random ID ഉണ്ടാക്കുന്നത് മാറ്റി, ലോഗിൻ ചെയ്ത യൂസറുടെ UID പിന്നീട് ലഭിക്കാനായി null ആക്കി
let currentUserId = null;
// 1. യൂസറുടെ വിവരങ്ങൾ കൃത്യമായി ലോഡ് ചെയ്യുന്ന ഫങ്ഷൻ
async function loadUserSettings() {
    onAuthStateChanged(auth, async (user) => {
        // 🔒 ലോഗിൻ ചെയ്ത യൂസർ ഇല്ലെങ്കിൽ പ്രോസസ്സ് നിർത്തുന്നു
        if (!user) {
            console.log("No authenticated user found.");
            return;
        }

        currentUserId = user.uid;

        try {
            const userRef = doc(db, "users", currentUserId);
            const docSnap = await getDoc(userRef);

            let username = "";

            if (docSnap.exists()) {
                const data = docSnap.data();
                // 1. ഫയർബേസ് ഡാറ്റാബേസിലെ Username, ഇല്ലെങ്കിൽ Auth DisplayName
                username = data.username || user.displayName || "";

                // Account Center Banner Update (Username ഉണ്ടെങ്കിൽ മാത്രം കാണിക്കും)
                const usernameElement = document.getElementById("acc-username");
                if (usernameElement) {
                    usernameElement.innerText = username ? `@${username} • ${data.wins || 0} Wins` : `${data.wins || 0} Wins`;
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
                // 🟢 പുതിയ യൂസർ ആണെങ്കിൽ റാൻഡം നെയിം ഉണ്ടാക്കില്ല. ലോഗിൻ ചെയ്ത പേര് ഉണ്ടെങ്കിൽ മാത്രം എടുക്കും.
                username = user.displayName || "";

                await setDoc(userRef, {
                    username: username, // ലോഗിൻ പേര് മാത്രം (ഇല്ലെങ്കിൽ Blank ആയിരിക്കും)
                    wins: 0,
                    bio: "",
                    isVerified: false,
                    settings: {
                        allowMentions: true,
                        isMuted: false,
                        dataSaver: false,
                        familyMode: false,
                        messages: "everyone"
                    }
                });

                const usernameElement = document.getElementById("acc-username");
                if (usernameElement) {
                    usernameElement.innerText = username ? `@${username} • 0 Wins` : "0 Wins";
                }
            }

            // 🟢 വെരിഫിക്കേഷൻ സ്റ്റാറ്റസ് ചെക്ക് ചെയ്യുന്നു
            await checkVerificationStatus();

        } catch (e) {
            console.error("Error loading settings:", e);
        }
    });
}

// 2. സെറ്റിംഗ്സ് ടോഗിളുകൾ ഫയർബേസിലേക്ക് ഓട്ടോ-സേവ് ചെയ്യുന്നു
window.toggleSetting = async function(key, value) {
    if (!currentUserId) return;
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
    if (!currentUserId) return;
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
    if (!currentUserId) return;
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
    if (!currentUserId) return;
    const inviteUrl = `https://spymo.app/invite?ref=${currentUserId}`;
    navigator.clipboard.writeText(inviteUrl);
    alert("🔗 Spymo Invite Link copied to clipboard!\n" + inviteUrl);
};

// 5. 🌟 Creator Badge Application Pop-up Logic
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzMM-fKI6CPLFbgKJDhO1LqRTUdlXKTr_3k9mV51L5oEW9ckjbQ-9J82agWWRDOzL2u/exec";

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

    if (!statusTag || !currentUserId) return;

    try {
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        // 🟢 1. അക്കൗണ്ട് വെരിഫൈഡ് ആണെങ്കിൽ (Green Badge)
        if (userDocSnap.exists() && userDocSnap.data().isVerified === true) {
            statusTag.innerText = "✓ Verified Creator";
            statusTag.className = "status-badge status-verified";
            if (submitBtn) {
                submitBtn.innerText = "Already Verified";
                submitBtn.disabled = true;
            }
            return;
        }

        // 🟠 2. അപേക്ഷ സമർപ്പിച്ച് റിവ്യൂവിൽ ആണെങ്കിൽ (Orange Badge)
        const q = query(
            collection(db, "verification_requests"), 
            where("userId", "==", currentUserId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            statusTag.innerText = "⏳ Under Review";
            statusTag.className = "status-badge status-pending";
            if (submitBtn) {
                submitBtn.innerText = "Application Submitted";
                submitBtn.disabled = true;
            }
        } else {
            // 🔴 3. വെരിഫൈഡ് അല്ല / അപേക്ഷിച്ചിട്ടില്ല (Red Badge)
            statusTag.innerText = "✖ Not Verified";
            statusTag.className = "status-badge status-not-verified";
            if (submitBtn) {
                submitBtn.innerText = "Submit Application";
                submitBtn.disabled = false;
            }
        }

    } catch (error) {
        console.error("Error checking verification status:", error);
    }
}

window.submitBadgeApplication = async function(event) {
    event.preventDefault();
    if (!currentUserId) return;

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
        await checkVerificationStatus();
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
    if (!currentUserId) return;
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
