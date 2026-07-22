// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

    // 2. URL-ൽ മറ്റ് ആരുടെയെങ്കിലും 'id' ഉണ്ടോ എന്ന് നോക്കുന്നു
    const urlParams = new URLSearchParams(window.location.search);
    const searchedUserId = urlParams.get('id');

    const targetUserId = searchedUserId ? searchedUserId : loggedInUser.uid;

    initProfile(targetUserId, loggedInUser);
}

// 🎯 പ്രൊഫൈൽ ഡാറ്റ ഇൻഷ്യലൈസ് ചെയ്യുന്ന ഫങ്ഷൻ
async function initProfile(targetUserId, loggedInUser) {
    let username = loggedInUser.username || "User";
    let bio = loggedInUser.bio || "Exploring the digital space! 🚀";
    let profilePic = loggedInUser.profilePic || loggedInUser.avatar || "";

    const isOwnProfile = (targetUserId === loggedInUser.uid);

    // സ്വന്തം പ്രൊഫൈൽ ആണെങ്കിൽ മാത്രം ക്യാമറ എഡിറ്റ് ബട്ടൺ കാണിക്കുക
    if (isOwnProfile) {
        const editLabel = document.getElementById("edit-pic-label");
        if (editLabel) editLabel.style.display = "flex";
        setupProfilePicUpload(loggedInUser);
    }

    try {
        const userDocRef = doc(db, "users", targetUserId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            username = userData.username || username;
            bio = userData.bio || bio;
            profilePic = userData.profilePic || userData.avatar || profilePic;
        }
    } catch (error) {
        console.error("User data fetch error:", error);
    }

    setProfileUI(username, bio, profilePic);
    fetchPosts(targetUserId);
}

// 🎨 UI-ൽ പ്രൊഫൈൽ വിവരങ്ങൾ നൽകുന്ന ഹെൽപ്പർ ഫങ്ഷൻ
function setProfileUI(username, bio, profilePic) {
    document.getElementById("user-display-name").innerText = username;
    document.getElementById("user-handle").innerText = `@${username.toLowerCase()}`;
    document.getElementById("user-bio").innerText = bio;

    const imgElem = document.getElementById("user-profile-pic");

    // പേരിന്റെ ആദ്യ അക്ഷരം വെച്ചുള്ള ചുവന്ന ആവതാർ generator (Image load ആയില്ലെങ്കിൽ)
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=ff1e42&color=fff&size=128`;

    if (profilePic && profilePic.trim() !== "") {
        imgElem.src = profilePic;
    } else {
        imgElem.src = fallbackAvatar;
    }

    // ഫോട്ടോയുടെ ലിങ്ക് കേടാണെങ്കിൽ (Broken Image) ഓട്ടോമാറ്റിക് ആയി Fallback Avatar കാണിക്കും
    imgElem.onerror = function() {
        this.src = fallbackAvatar;
    };
}

// 📸 ഗാലറിയിൽ നിന്ന് ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുന്ന ഫങ്ഷൻ
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
            profileImgElem.style.opacity = "0.4"; // Uploading Visual Effect

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);

            // Cloudinary അപ്‌ലോഡ് API Call
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (!data.secure_url) {
                throw new Error("Upload Failed!");
            }

            // ക്യാഷിംഗ് ഒഴിവാക്കാൻ ടൈംസ്റ്റാമ്പ് ചേർക്കുന്നു
            const newPicUrl = data.secure_url;

            // 1. Firestore Database അപ്‌ഡേറ്റ് (profilePic, avatar രണ്ടിലും സേവ് ചെയ്യും)
            await setDoc(doc(db, "users", loggedInUser.uid), {
                profilePic: newPicUrl,
                avatar: newPicUrl
            }, { merge: true });

            // 2. LocalStorage അപ്‌ഡേറ്റ്
            loggedInUser.profilePic = newPicUrl;
            loggedInUser.avatar = newPicUrl;
            localStorage.setItem("infinity_user", JSON.stringify(loggedInUser));

            // 3. UI ഉടനടി അപ്‌ഡേറ്റ് ചെയ്യുന്നു
            profileImgElem.src = newPicUrl;
            profileImgElem.style.opacity = "1";

            alert("പ്രൊഫൈൽ ചിത്രം വിജയകരമായി മാറ്റി! 🔥");

        } catch (err) {
            console.error("Profile Pic Update Error:", err);
            alert("അപ്‌ലോഡിൽ തടസ്സം വന്നു. അപ്‌ലോഡ് പ്രീസെറ്റ് (UPLOAD_PRESET) ശരിയാണോ എന്ന് പരിശോധിക്കുക!");
            profileImgElem.style.opacity = "1";
        }
    });
}

// 📱 പോസ്റ്റുകൾ കാണിക്കുന്ന ഗ്രിഡ് ലോഡർ
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
