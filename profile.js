// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Config
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

// ⚙️ Cloudinary Settings
const CLOUD_NAME = "wbmr3lkx";
const UPLOAD_PRESET = "Infinity_preset";

// 1. ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് യൂസർ ഡാറ്റ എടുക്കുന്നു
const localUserData = localStorage.getItem("infinity_user");

if (!localUserData) {
    alert("ദയവായി ലോഗിൻ ചെയ്യുക!");
    window.location.href = "index.html"; 
} else {
    const loggedInUser = JSON.parse(localUserData);

    // 2. URL-ൽ മറ്റ് ആരുടെയെങ്കിലും 'id' അല്ലെങ്കിൽ 'username' ഉണ്ടോ എന്ന് നോക്കുന്നു
    const urlParams = new URLSearchParams(window.location.search);
    const searchedUserId = urlParams.get('id');
    const searchedUsername = urlParams.get('username');

    initProfile(searchedUserId, searchedUsername, loggedInUser);
}

// 🎯 പ്രൊഫൈൽ ഡാറ്റ ഇൻഷ്യലൈസ് ചെയ്യുന്ന ഫങ്ഷൻ
async function initProfile(searchedUserId, searchedUsername, loggedInUser) {
    let targetUserData = null;
    let targetUserId = searchedUserId;

    try {
        if (searchedUsername) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", searchedUsername.trim().toLowerCase()));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                const userDoc = querySnap.docs[0];
                targetUserId = userDoc.id;
                targetUserData = userDoc.data();
            }
        } 
        else if (searchedUserId) {
            const userDocRef = doc(db, "users", searchedUserId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                targetUserData = userDocSnap.data();
            }
        }
    } catch (err) {
        console.error("Target user fetch error:", err);
    }

    const isOwnProfile = !targetUserId || (targetUserId === loggedInUser.uid);

    let displayUsername = "";
    let displayBio = "";
    let displayPic = "";
    let followersList = [];
    let followingList = [];
    let isVerified = false;

    if (isOwnProfile) {
        targetUserId = loggedInUser.uid;
        
        // 🔹 ഫയർബേസിൽ നിന്ന് യൂസറുടെ ലേറ്റസ്റ്റ് isVerified സ്റ്റാറ്റസ് എടുക്കുന്നു
        try {
            const mySnap = await getDoc(doc(db, "users", loggedInUser.uid));
            if (mySnap.exists()) {
                const myData = mySnap.data();
                isVerified = myData.isVerified === true;
                displayBio = myData.bio || loggedInUser.bio || "Exploring the digital space! 🚀";
                displayPic = myData.profilePic || loggedInUser.profilePic || "";
            }
        } catch(e) {
            isVerified = loggedInUser.isVerified === true;
            displayBio = loggedInUser.bio || "Exploring the digital space! 🚀";
            displayPic = loggedInUser.profilePic || loggedInUser.avatar || "";
        }

        displayUsername = loggedInUser.username || "User";
        followersList = loggedInUser.followers || [];
        followingList = loggedInUser.following || [];

        const editLabel = document.getElementById("edit-pic-label");
        if (editLabel) editLabel.style.display = "flex";
        setupProfilePicUpload(loggedInUser);

        setupActionButton(true, false, targetUserId, displayUsername, loggedInUser);
    } else {
        displayUsername = targetUserData ? targetUserData.username : "User";
        displayBio = targetUserData ? (targetUserData.bio || "Exploring the digital space! 🚀") : "";
        displayPic = targetUserData ? (targetUserData.profilePic || targetUserData.avatar || "") : "";
        followersList = targetUserData && Array.isArray(targetUserData.followers) ? targetUserData.followers : [];
        followingList = targetUserData && Array.isArray(targetUserData.following) ? targetUserData.following : [];
        isVerified = targetUserData ? (targetUserData.isVerified === true) : false;

        let myFollowing = loggedInUser.following || [];
        let isFollowing = myFollowing.includes(displayUsername);

        setupActionButton(false, isFollowing, targetUserId, displayUsername, loggedInUser);
    }

    setProfileUI(displayUsername, displayBio, displayPic, followersList.length, followingList.length, isVerified);
    fetchPosts(targetUserId);
}

// 🎨 UI-ൽ പ്രൊഫൈൽ വിവരങ്ങളും Verified Badge-ഉം നൽകുന്ന ഫങ്ഷൻ
function setProfileUI(username, bio, profilePic, followersCount, followingCount, isVerified) {
    document.getElementById("user-display-name").innerText = username;
    document.getElementById("user-handle").innerText = `@${username.toLowerCase()}`;
    document.getElementById("user-bio").innerText = bio;

    document.getElementById("followers-count").innerText = followersCount;
    document.getElementById("following-count").innerText = followingCount;

    // 🔵 Verified Badge Show / Hide Logic (All users-നും വ്യക്തമായി കാണും)
    const tickBadge = document.getElementById("profile-blue-tick");
    if (tickBadge) {
        if (isVerified) {
            tickBadge.style.display = "inline-flex";
        } else {
            tickBadge.style.display = "none";
        }
    }

    const imgElem = document.getElementById("user-profile-pic");
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=ff1e42&color=fff&size=128`;

    if (profilePic && profilePic.trim() !== "") {
        imgElem.src = profilePic;
    } else {
        imgElem.src = fallbackAvatar;
    }

    imgElem.onerror = function() {
        this.src = fallbackAvatar;
    };
}

// 🤝 ACTION BUTTON (Edit Profile Modal vs Follow / Unfollow)
function setupActionButton(isOwnProfile, isFollowing, targetUserId, targetUsername, loggedInUser) {
    const actionBtn = document.getElementById("profile-action-btn");
    if (!actionBtn) return;

    actionBtn.style.display = "inline-block";

    if (isOwnProfile) {
        actionBtn.innerText = "Edit Profile";
        actionBtn.className = "profile-action-btn";

        const modal = document.getElementById("edit-profile-modal");
        const closeModalBtn = document.getElementById("close-modal-btn");
        const saveBioBtn = document.getElementById("save-bio-btn");
        const bioInput = document.getElementById("edit-bio-input");

        // Edit Profile ബട്ടൺ ക്ലിക്ക് ചെയ്യുമ്പോൾ Pop-up Modal തുറക്കുന്നു
        actionBtn.onclick = () => {
            bioInput.value = loggedInUser.bio || "Exploring the digital space! 🚀";
            modal.style.display = "flex";
        };

        // Pop-up അടയ്ക്കുന്നു
        closeModalBtn.onclick = () => {
            modal.style.display = "none";
        };

        // Modal-ന് പുറത്ത് ക്ലിക്ക് ചെയ്താൽ ക്ലോസ് ആകും
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        };

        // Save Bio Logic
        saveBioBtn.onclick = async () => {
            const newBio = bioInput.value.trim();
            if (!newBio) return;

            saveBioBtn.innerText = "Saving...";
            saveBioBtn.disabled = true;

            try {
                // 1. Firestore Database അപ്‌ഡേറ്റ്
                await setDoc(doc(db, "users", loggedInUser.uid), {
                    bio: newBio
                }, { merge: true });

                // 2. LocalStorage അപ്‌ഡേറ്റ്
                loggedInUser.bio = newBio;
                localStorage.setItem("infinity_user", JSON.stringify(loggedInUser));

                // 3. UI അപ്‌ഡേറ്റ്
                document.getElementById("user-bio").innerText = newBio;
                modal.style.display = "none";

            } catch (err) {
                console.error("Bio Update Error:", err);
                alert("Bio അപ്‌ഡേറ്റ് ചെയ്യാൻ പറ്റിയില്ല!");
            } finally {
                saveBioBtn.innerText = "Save Changes";
                saveBioBtn.disabled = false;
            }
        };

    } else {
        function updateBtnState(followingState) {
            if (followingState) {
                actionBtn.innerText = "Following";
                actionBtn.className = "profile-action-btn following";
            } else {
                actionBtn.innerText = "Follow";
                actionBtn.className = "profile-action-btn follow-btn";
            }
        }

        updateBtnState(isFollowing);

        actionBtn.onclick = async () => {
            actionBtn.disabled = true;

            let myFollowing = loggedInUser.following || [];
            let followersSpan = document.getElementById("followers-count");
            let currentFollowersCount = parseInt(followersSpan.innerText) || 0;

            try {
                const myDocRef = doc(db, "users", loggedInUser.uid);
                const targetDocRef = doc(db, "users", targetUserId);

                if (!isFollowing) {
                    isFollowing = true;
                    myFollowing.push(targetUsername);
                    updateBtnState(true);
                    followersSpan.innerText = currentFollowersCount + 1;

                    await updateDoc(myDocRef, { following: arrayUnion(targetUsername) });
                    if (targetUserId) {
                        await updateDoc(targetDocRef, { followers: arrayUnion(loggedInUser.username) });
                    }
                } else {
                    isFollowing = false;
                    myFollowing = myFollowing.filter(u => u !== targetUsername);
                    updateBtnState(false);
                    followersSpan.innerText = Math.max(0, currentFollowersCount - 1);

                    await updateDoc(myDocRef, { following: arrayRemove(targetUsername) });
                    if (targetUserId) {
                        await updateDoc(targetDocRef, { followers: arrayRemove(loggedInUser.username) });
                    }
                }

                loggedInUser.following = myFollowing;
                localStorage.setItem("infinity_user", JSON.stringify(loggedInUser));

            } catch (error) {
                console.error("Follow Toggle Error:", error);
                isFollowing = !isFollowing;
                updateBtnState(isFollowing);
            } finally {
                actionBtn.disabled = false;
            }
        };
    }
}

// 📸 പ്രൊഫൈൽ ഫോട്ടോ അപ്‌ലോഡ്
function setupProfilePicUpload(loggedInUser) {
    const fileInput = document.getElementById("profile-pic-input");
    if (!fileInput) return;

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("5MB-യിൽ താഴെയുള്ള ഫോട്ടോ തിരഞ്ഞെടുക്കുക!");
            return;
        }

        const profileImgElem = document.getElementById("user-profile-pic");

        try {
            profileImgElem.style.opacity = "0.4";

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (!data.secure_url) {
                throw new Error("Upload Failed!");
            }

            const newPicUrl = data.secure_url;

            await setDoc(doc(db, "users", loggedInUser.uid), {
                profilePic: newPicUrl,
                avatar: newPicUrl
            }, { merge: true });

            loggedInUser.profilePic = newPicUrl;
            loggedInUser.avatar = newPicUrl;
            localStorage.setItem("infinity_user", JSON.stringify(loggedInUser));

            profileImgElem.src = newPicUrl;
            profileImgElem.style.opacity = "1";

            alert("പ്രൊഫൈൽ ചിത്രം വിജയകരമായി മാറ്റി! 🔥");

        } catch (err) {
            console.error("Profile Pic Update Error:", err);
            alert("അപ്‌ലോഡിൽ തടസ്സം വന്നു. UPLOAD_PRESET പരിശോധിക്കുക!");
            profileImgElem.style.opacity = "1";
        }
    });
}

// 📱 പോസ്റ്റ് ഗ്രിഡ് ലോഡർ
async function fetchPosts(userId) {
    const postsGrid = document.getElementById("my-posts-grid");
    if (!postsGrid) return;

    try {
        const postsQuery = query(
            collection(db, "posts"), 
            where("userId", "==", userId)
        );
        
        const querySnapshot = await getDocs(postsQuery);
        postsGrid.innerHTML = "";

        if (querySnapshot.empty) {
            postsGrid.innerHTML = "<div style='grid-column: span 3; text-align:center; padding: 40px; color: #888;'>No posts found</div>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const postData = doc.data();
            const gridItem = document.createElement("div");
            gridItem.classList.add("grid-item");

            const fileUrl = postData.mediaUrl || postData.url || postData.imageUrl; 

            if (postData.type === 'image' || postData.type === 'photo') {
                gridItem.innerHTML = `<img src="${fileUrl}" alt="Post">`;
            } else if (postData.type === 'video') {
                gridItem.innerHTML = `<video src="${fileUrl}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>`;
            }

            postsGrid.appendChild(gridItem);
        });

    } catch (error) {
        console.error("Unable to load posts:", error);
    }
}
