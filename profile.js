// Firebase SDKs ഇമ്പോർട്ട് ചെയ്യുന്നു
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// നിന്റെ Firebase കോൺഫിഗറേഷൻ
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

// 1. ലോഗിൻ ചെയ്ത യൂസറുടെ വിവരങ്ങൾ ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് എടുക്കുന്നു
const localUserData = localStorage.getItem("infinity_user");

if (!localUserData) {
    alert("ദയവായി ലോഗിൻ ചെയ്യുക!");
    window.location.href = "index.html"; 
} else {
    const loggedInUser = JSON.parse(localUserData);

    // 2. URL-ൽ വേറെ ആരുടെയെങ്കിലും 'id' ഉണ്ടോ എന്ന് നോക്കുന്നു (ഉദാഹരണം: profile.html?id=OTHER_USER_ID)
    const urlParams = new URLSearchParams(window.location.search);
    const searchedUserId = urlParams.get('id');

    // ലിങ്കിൽ ഐഡി ഉണ്ടെങ്കിൽ അത് നോക്കും, ഇല്ലെങ്കിൽ സ്വന്തം ഐഡി എടുക്കും
    const targetUserId = searchedUserId ? searchedUserId : loggedInUser.uid;

    // പ്രൊഫൈൽ ഡാറ്റ ലോഡ് ചെയ്യാൻ തുടങ്ങുന്നു
    initProfile(targetUserId, loggedInUser);
}

// പ്രൊഫൈൽ വിവരങ്ങൾ സെറ്റ് ചെയ്യുന്ന പ്രധാന ഫങ്ഷൻ
async function initProfile(targetUserId, loggedInUser) {
    // 🎲 റാൻഡം ഡിഫോൾട്ട് ബയോകൾ
    const defaultBios = [
        "Exploring the digital space! 🚀",
        "On a journey to build an empire. 💼",
        "Creativity is intelligence having fun. 🎨",
        "Keep it simple, keep it real. ✨",
        "Just another star in the InfinitySpot! 🌌"
    ];
    const randomBio = defaultBios[Math.floor(Math.random() * defaultBios.length)];

    let username = "User";
    let bio = randomBio;
    let profilePic = "";

    // കേസ് 1: സ്വന്തം പ്രൊഫൈൽ ആണെങ്കിൽ (ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് ഡാറ്റ എടുക്കാം)
    if (targetUserId === loggedInUser.uid) {
        username = loggedInUser.username || "User";
        bio = loggedInUser.bio || randomBio;
        profilePic = loggedInUser.profilePic || "";
        
        // ടൈറ്റിൽ ബാർ 'എന്റെ പ്രൊഫൈൽ' എന്ന് കാണിക്കാൻ
        document.querySelector(".my-posts-title").innerText = "Posts";
        
        setProfileUI(username, bio, profilePic);
        fetchPosts(targetUserId); // പോസ്റ്റുകൾ ലോഡ് ചെയ്യുന്നു
    } 
    // കേസ് 2: മറ്റൊരാളുടെ പ്രൊഫൈൽ ആണെങ്കിൽ (ഫയർബേസിൽ പോയി അവരുടെ വിവരങ്ങൾ എടുക്കണം)
    else {
        document.querySelector(".my-posts-title").innerText = "പോസ്റ്റുകൾ";
        
        try {
            const userDocRef = doc(db, "users", targetUserId); // നിന്റെ യൂസേഴ്സ് കളക്ഷന്റെ പേര് 'users' ആണെങ്കിൽ
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                username = userData.username || "User";
                bio = userData.bio || randomBio;
                profilePic = userData.profilePic || "";
            } else {
                username = "Unknown User";
                bio = "No bio available";
            }
        } catch (error) {
            console.error("യൂസർ വിവരങ്ങൾ എടുക്കുന്നതിൽ പരാജയപ്പെട്ടു:", error);
        }
        
        setProfileUI(username, bio, profilePic);
        fetchPosts(targetUserId); // ആ യൂസറുടെ പോസ്റ്റുകൾ ലോഡ് ചെയ്യുന്നു
    }
}

// UI-ൽ പേരും ഫോട്ടോയും സെറ്റ് ചെയ്യാനുള്ള ഹെൽപ്പർ ഫങ്ഷൻ
function setProfileUI(username, bio, profilePic) {
    document.getElementById("user-display-name").innerText = username;
    document.getElementById("user-handle").innerText = `@${username.toLowerCase()}`;
    document.getElementById("user-bio").innerText = bio;

    if (profilePic) {
        document.getElementById("user-profile-pic").src = profilePic;
    } else {
        document.getElementById("user-profile-pic").src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
    }
}

// നിശ്ചിത യൂസറുടെ പോസ്റ്റുകൾ മാത്രം എടുക്കാനുള്ള ഫങ്ഷൻ
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
            postsGrid.innerHTML = "<div class='no-posts'>No posts available!</div>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const postData = doc.data();
            const gridItem = document.createElement("div");
            gridItem.classList.add("grid-item");

            // നിന്റെ ഡാറ്റാബേസിൽ ഫീൽഡിന്റെ പേര് 'url' അല്ലെങ്കിൽ 'imageUrl' ഏതാണെന്ന് നോക്കി താഴെ കൊടുക്കുക
            const fileUrl = postData.url || postData.imageUrl; 

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

