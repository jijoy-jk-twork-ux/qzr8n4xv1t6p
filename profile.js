// Firebase SDKs ഇമ്പോർട്ട് ചെയ്യുന്നു
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// ലോഗിൻ ചെയ്ത യൂസറുടെ വിവരങ്ങൾ ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് എടുക്കുന്നു
const localUserData = localStorage.getItem("infinity_user");

if (!localUserData) {
    alert("ദയവായി ലോഗിൻ ചെയ്യുക!");
    window.location.href = "index.html"; 
} else {
    const user = JSON.parse(localUserData);
    
    // 🎲 റാൻഡം ഡിഫോൾട്ട് ബയോകൾ
    const defaultBios = [
        "Exploring the digital space! 🚀",
        "On a journey to build an empire. 💼",
        "Creativity is intelligence having fun. 🎨",
        "Keep it simple, keep it real. ✨",
        "Just another star in the InfinitySpot! 🌌"
    ];
    const randomBio = defaultBios[Math.floor(Math.random() * defaultBios.length)];

    // HTML-ൽ വിവരങ്ങൾ ചേർക്കുന്നു
    const username = user.username || "User";
    document.getElementById("user-display-name").innerText = username;
    document.getElementById("user-handle").innerText = `@${username.toLowerCase()}`;
    
    // യൂസർക്ക് ബയോ ഇല്ലെങ്കിൽ ഒരു റാൻഡം ബയോ കൊടുക്കും
    document.getElementById("user-bio").innerText = user.bio || randomBio;

    // 🎨 യൂസർക്ക് പ്രൊഫൈൽ പിക്ചർ ഇല്ലെങ്കിൽ യൂസർനെയിം വെച്ച് ഒരു റാൻഡം അവതാർ സെറ്റ് ചെയ്യും
    if (user.profilePic) {
        document.getElementById("user-profile-pic").src = user.profilePic;
    } else {
        document.getElementById("user-profile-pic").src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
    }

    // യൂസറുടെ പോസ്റ്റുകൾ മാത്രം ലോഡ് ചെയ്യുന്നു
    fetchMyPosts(user.uid);
}

// യൂസറുടെ സ്വന്തം പോസ്റ്റുകൾ എടുക്കാനുള്ള ഫങ്ഷൻ
async function fetchMyPosts(userId) {
    const postsGrid = document.getElementById("my-posts-grid");
    if (!postsGrid) return;

    try {
        const postsQuery = query(
            collection(db, "posts"), 
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(postsQuery);
        postsGrid.innerHTML = "";

        if (querySnapshot.empty) {
            postsGrid.innerHTML = "<div class='no-posts'>നിങ്ങൾ ഇതുവരെ പോസ്റ്റുകൾ ഒന്നും ഇട്ടിട്ടില്ല!</div>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const postData = doc.data();
            const gridItem = document.createElement("div");
            gridItem.classList.add("grid-item");

            if (postData.type === 'image') {
                gridItem.innerHTML = `<img src="${postData.url}" alt="My Post">`;
            } else if (postData.type === 'video') {
                gridItem.innerHTML = `<video src="${postData.url}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>`;
            }

            postsGrid.appendChild(gridItem);
        });

    } catch (error) {
        console.error("പോസ്റ്റുകൾ ലോഡ് ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു:", error);
    }
}
