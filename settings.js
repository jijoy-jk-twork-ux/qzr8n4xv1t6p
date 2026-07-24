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

// 🔑 ലോഗിൻ ചെയ്ത യൂസറുടെ UID
let currentUserId = null;

// 🚀 2. ഫയർബേസ് സെഷൻ വഴി Profile, Verified Badge, Followers/Following എന്നിവ ലോഡ് ചെയ്യുന്ന ഫങ്ഷൻ
async function loadUserSettings() {
    const usernameElement = document.getElementById("acc-username");
    const followersElem = document.getElementById("acc-followers");
    const followingElem = document.getElementById("acc-following");

    // 1. LocalStorage ഡാറ്റ വെച്ച് UI അതിവേഗം ലോഡ് ആക്കുന്നു
    const cachedUser = localStorage.getItem("infinity_user") || localStorage.getItem("spy_active_user");
    let cachedUsername = localStorage.getItem("infinity_username");

    if (cachedUser) {
        try {
            const parsed = JSON.parse(cachedUser);
            cachedUsername = parsed.username || cachedUsername;
        } catch(e) {}
    }

    if (cachedUsername && usernameElement) {
        usernameElement.innerText = `@${cachedUsername}`;
    }

    // 2. ഫയർബേസ് ഓതന്റിക്കേഷൻ സെഷൻ കൈകാര്യം ചെയ്യുന്നു
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;

            try {
                const userRef = doc(db, "users", currentUserId);
                const docSnap = await getDoc(userRef);

                let currentUsername = "";

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    currentUsername = data.username || user.displayName || cachedUsername || "";

                    if (currentUsername) {
                        localStorage.setItem("infinity_username", currentUsername);
                    }

                    // 🔵 Blue Tick Badge HTML
                    const blueTickHTML = data.isVerified 
                        ? `<span title="Verified" style="color: #1DA1F2; margin-left: 4px; font-size: 0.9em;">☑️</span>` 
                        : "";

                    // Username & Wins Display Update
                    if (usernameElement) {
                        const winsText = data.wins !== undefined ? ` • ${data.wins} Wins` : "";
                        usernameElement.innerHTML = `@${currentUsername}${blueTickHTML}${winsText}`;
                    }

                    // 👥 Followers & Following Update (Array Length or Numeric Count)
                    const followersCount = Array.isArray(data.followers) 
                        ? data.followers.length 
                        : (data.followersCount || 0);

                    const followingCount = Array.isArray(data.following) 
                        ? data.following.length 
                        : (data.followingCount || 0);

                    if (followersElem) followersElem.innerText = followersCount;
                    if (followingElem) followingElem.innerText = followingCount;

                    // Settings Toggles Load
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
                    // പുതിയ യൂസർ അക്കൗണ്ട് സെറ്റ് ചെയ്യുമ്പോൾ
                    currentUsername = user.displayName || cachedUsername || "";

                    if (currentUsername) {
                        localStorage.setItem("infinity_username", currentUsername);
                    }

                    await setDoc(userRef, {
                        username: currentUsername,
                        wins: 0,
                        bio: "",
                        isVerified: false,
                        followers: [],
                        following: [],
                        followersCount: 0,
                        followingCount: 0,
                        settings: {
                            allowMentions: true,
                            isMuted: false,
                            dataSaver: false,
                            familyMode: false,
                            messages: "everyone"
                        }
                    });

                    if (usernameElement) {
                        usernameElement.innerText = currentUsername ? `@${currentUsername} • 0 Wins` : "0 Wins";
                    }
                    if (followersElem) followersElem.innerText = "0";
                    if (followingElem) followingElem.innerText = "0";
                }

                // 🟢 Verification Badge Modal Status Update
                await checkVerificationStatus();

            } catch (e) {
                console.error("Error loading user profile:", e);
            }
        } else {
            if (!cachedUsername && usernameElement) {
                usernameElement.innerText = "Guest User";
            }
        }
    });
}

window.updateSetting = async function(key, value) {
    if (typeof window.toggleSetting === 'function') {
        window.toggleSetting(key, value);
    }
};

// 3. 💎 Account Center Pop-up Logic
window.openAccountCenter = async function() {
    if (!currentUserId) return;
    try {
        const userRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const d = docSnap.data();
            if (document.getElementById("accUserId")) document.getElementById("accUserId").value = currentUserId;
            if (document.getElementById("accDisplayUsername")) document.getElementById("accDisplayUsername").value = d.username || currentUserId;
            if (document.getElementById("accBio")) document.getElementById("accBio").value = d.bio || "";
            if (document.getElementById("accWins")) document.getElementById("accWins").value = d.wins || 0;
            
            const modal = document.getElementById("accountModal");
            if (modal) modal.style.display = "flex";
        }
    } catch(e) {
        console.error("Account Center Error:", e);
    }
};

window.closeAccountModal = function() {
    const modal = document.getElementById("accountModal");
    if (modal) modal.style.display = "none";
};

window.saveAccountDetails = async function(event) {
    event.preventDefault();
    if (!currentUserId) return;
    const bioElem = document.getElementById("accBio");
    const bio = bioElem ? bioElem.value : "";
    
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
    const badgeModal = document.getElementById("badgeModal");
    if (badgeModal) badgeModal.style.display = "flex";
    await checkVerificationStatus();
};

window.closeBadgeModal = function() {
    const badgeModal = document.getElementById("badgeModal");
    if (badgeModal) badgeModal.style.display = "none";
};

// 🟢 Verification Status Check Logic
async function checkVerificationStatus() {
    const statusTag = document.getElementById("badge-status-tag");
    const submitBtn = document.getElementById("submitBtn");

    if (!currentUserId) return;

    try {
        const userDocRef = doc(db, "users", currentUserId);
        const userDocSnap = await getDoc(userDocRef);

        // 🟢 1. അക്കൗണ്ട് വെരിഫൈഡ് ആണെങ്കിൽ
        if (userDocSnap.exists() && userDocSnap.data().isVerified === true) {
            if (statusTag) {
                statusTag.innerText = "✓ Verified Creator";
                statusTag.className = "status-badge status-verified";
            }
            if (submitBtn) {
                submitBtn.innerText = "Already Verified";
                submitBtn.disabled = true;
            }
            return;
        }

        // 🟠 2. അപേക്ഷ സമർപ്പിച്ച് റിവ്യൂവിൽ ആണെങ്കിൽ
        const q = query(
            collection(db, "verification_requests"), 
            where("userId", "==", currentUserId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            if (statusTag) {
                statusTag.innerText = "⏳ Under Review";
                statusTag.className = "status-badge status-pending";
            }
            if (submitBtn) {
                submitBtn.innerText = "Application Submitted";
                submitBtn.disabled = true;
            }
        } else {
            // 🔴 3. വെരിഫൈഡ് അല്ല
            if (statusTag) {
                statusTag.innerText = "✖ Not Verified";
                statusTag.className = "status-badge status-not-verified";
            }
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
    if (submitBtn) {
        submitBtn.innerText = "Submitting...";
        submitBtn.disabled = true;
    }

    const username = document.getElementById("badgeUsername") ? document.getElementById("badgeUsername").value : "";
    const email = document.getElementById("badgeEmail") ? document.getElementById("badgeEmail").value : "";
    const message = document.getElementById("badgeMessage") ? document.getElementById("badgeMessage").value : "";

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
        const badgeForm = document.getElementById("badgeForm");
        if (badgeForm) badgeForm.reset();
        await checkVerificationStatus();
        closeBadgeModal();

    } catch (error) {
        console.error("Submission Error: ", error);
        alert("❌ Something went wrong. Please try again!");
    } finally {
        if (submitBtn) {
            submitBtn.innerText = "Submit Application";
            submitBtn.disabled = false;
        }
    }
};

// 6. 🎵 Music Passcode & Upload Logic
window.openMusicPasscodeModal = function() {
    const modal = document.getElementById("musicPasscodeModal");
    if (modal) modal.style.display = "flex";
    if (document.getElementById("musicPasscode")) document.getElementById("musicPasscode").value = "";
    if (document.getElementById("passcodeError")) document.getElementById("passcodeError").style.display = "none";
};

window.closeMusicPasscodeModal = function() {
    const modal = document.getElementById("musicPasscodeModal");
    if (modal) modal.style.display = "none";
};

window.closeMusicUploadModal = function() {
    const modal = document.getElementById("musicUploadModal");
    if (modal) modal.style.display = "none";
};

window.verifyMusicPasscode = function() {
    const inputCode = document.getElementById("musicPasscode") ? document.getElementById("musicPasscode").value : "";
    if (inputCode === SECRET_PASSCODE) {
        closeMusicPasscodeModal();
        const uploadModal = document.getElementById("musicUploadModal");
        if (uploadModal) uploadModal.style.display = "flex";
    } else {
        const err = document.getElementById("passcodeError");
        if (err) err.style.display = "block";
    }
};

window.uploadMusicToFirestore = async function(event) {
    event.preventDefault();
    const btn = document.getElementById("mSubmitBtn");
    if (btn) {
        btn.innerText = "Uploading...";
        btn.disabled = true;
    }

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
        const mForm = document.getElementById("musicForm");
        if (mForm) mForm.reset();
        closeMusicUploadModal();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to add music: " + error.message);
    } finally {
        if (btn) {
            btn.innerText = "Save Song to Library";
            btn.disabled = false;
        }
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
