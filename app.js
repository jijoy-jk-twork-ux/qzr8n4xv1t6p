// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP (Imports must be at the top)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; 

// Cloudinary ഡാറ്റ
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

// നിന്റെ Firebase കോൺഫിഗറേഷൻ
const firebaseConfig = {
    apiKey: "AIzaSyCNQaHi-L3fninLxkePZBaNR7vu6JiYEwQ",
    authDomain: "infinityspotx.firebaseapp.com",
    projectId: "infinityspotx",
    storageBucket: "infinityspotx.firebasestorage.app",
    messagingSenderId: "400346792298",
    appId: "1:400346792298:web:5fd101c225a547902b6513"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("Firebase Connected successfully!");

// ==========================================
// 2. SAFE USER AUTH CHECK (സുരക്ഷിതമായ ലോഗിൻ ചെക്കിംഗ്)
// ==========================================
let currentUserData = null;
const userDataString = localStorage.getItem("infinity_user");

if (!userDataString) {
    // ലോഗിൻ ചെയ്തിട്ടില്ലെങ്കിൽ മാത്രം ഇൻഡെക്സ് പേജിലേക്ക് റീഡയറക്ട് ചെയ്യുന്നു
    window.location.replace("./index.html");
} else {
    try {
        currentUserData = JSON.parse(userDataString);
        console.log("Welcome to InfinitySpot,", currentUserData.username);
    } catch (e) {
        console.error("Local storage temporary parse error", e);
        localStorage.removeItem("infinity_user");
        window.location.replace("./index.html");
    }
}

// ==========================================
// 3. HTML ELEMENTS SELECTORS
// ==========================================
const uploadBtn = document.getElementById('upload-btn');
const uploadModal = document.getElementById('upload-modal');
const closeModal = document.getElementById('close-modal');
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const videoPreview = document.getElementById('video-preview');
const removeFileBtn = document.getElementById('remove-file-btn');
const submitPostBtn = document.getElementById('submit-post-btn');
const captionInput = document.getElementById('caption-input');

// ==========================================
// 4. MODAL & PREVIEW CONTROLS
// ==========================================
if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
        uploadModal.style.display = 'flex';
    });
}

if (closeModal) {
    closeModal.addEventListener('click', resetAndCloseModal);
}

window.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        resetAndCloseModal();
    }
});

if (fileInput) {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const fileType = file.type;
            const reader = new FileReader();

            reader.onload = function(e) {
                dropArea.classList.add('hidden'); 
                previewContainer.classList.remove('hidden'); 

                if (fileType.startsWith('image/')) {
                    imagePreview.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                    videoPreview.classList.add('hidden');
                } else if (fileType.startsWith('video/')) {
                    videoPreview.src = e.target.result;
                    videoPreview.classList.remove('hidden');
                    imagePreview.classList.add('hidden');
                }
            }
            reader.readAsDataURL(file);
        }
    });
}

if (removeFileBtn) {
    removeFileBtn.addEventListener('click', resetFileSelection);
}

function resetFileSelection() {
    fileInput.value = '';
    imagePreview.src = '';
    videoPreview.src = '';
    imagePreview.classList.add('hidden');
    videoPreview.classList.add('hidden');
    previewContainer.classList.add('hidden');
    dropArea.classList.remove('hidden');
}

function resetAndCloseModal() {
    uploadModal.style.display = 'none';
    resetFileSelection();
    captionInput.value = '';
}

// ==========================================
// 5. CLOUDINARY & FIREBASE UPLOAD LOGIC
// ==========================================
if (submitPostBtn) {
    submitPostBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        const caption = captionInput.value;

        if (!file) {
            alert("Please select a photo!");
            return;
        }

        submitPostBtn.innerText = "Uploading...";
        submitPostBtn.disabled = true;

        try {
            console.log("1. അപ്‌ലോഡിങ് സ്റ്റാർട്ട് ചെയ്തു...");
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            console.log("2. posting...");
            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log("3. Ready:", data);
            
            if (data.secure_url) {
                const mediaUrl = data.secure_url;
                const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
                const publicId = data.public_id;

                console.log("4. wait");
                await savePostToFirebase(mediaUrl, mediaType, caption, publicId);
                
                alert("Post uploaded successfully!");
                resetAndCloseModal();
                fetchAndDisplayPosts(); 
            } else {
                throw new Error("Cloudinary Error: " + (data.error ? data.error.message : "Upload failed"));
            }

        } catch (error) {
            console.error("Error:", error);
            alert("Upload failed: " + error.message);
        } finally {
            submitPostBtn.innerText = "Post";
            submitPostBtn.disabled = false;
        }
    });
}

async function savePostToFirebase(mediaUrl, mediaType, caption, publicId) {
    try {
        let userId = "anonymous";
        let username = "Anonymous User";
        let profilePic = "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

        if (currentUserData) {
            userId = currentUserData.uid || "anonymous";
            username = currentUserData.username || "Anonymous User";
            profilePic = currentUserData.profilePic || profilePic;
        }

        await addDoc(collection(db, "posts"), {
            url: mediaUrl,
            type: mediaType,
            caption: caption,
            public_id: publicId,
            createdAt: new Date(),
            likes: 0,
            userId: userId,        
            username: username,    
            profilePic: profilePic 
        });
        console.log("Post saved to Firestore successfully with User ID!");
    } catch (error) {
        console.error("Firebase saving error:", error);
        throw error;
    }
}

// ==========================================
// 6. FETCH & DISPLAY POSTS WITH BLUE TICK SVG
// ==========================================
async function fetchAndDisplayPosts() {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return;

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);
        
        feedContainer.innerHTML = "";

        if (querySnapshot.empty) {
            feedContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>പോസ്റ്റുകൾ ഒന്നും ലഭ്യമല്ല!</p>";
            return;
        }

        let currentUserId = currentUserData ? currentUserData.uid : "";

        querySnapshot.forEach((documentSnapshot) => {
            const postData = documentSnapshot.data();
            const postId = documentSnapshot.id;

            let mediaHtml = "";
            if (postData.type === 'image') {
                mediaHtml = `<img src="${postData.url}" alt="Post Image" class="main-media">`;
            } else if (postData.type === 'video') {
                mediaHtml = `<video src="${postData.url}" controls class="main-media"></video>`;
            }

            let deleteIconHtml = "";
            if (postData.userId === currentUserId) {
                deleteIconHtml = `<i class="fa-regular fa-trash-can delete-icon" style="margin-left: auto; cursor: pointer; color: #ff4d4d;" data-id="${postId}"></i>`;
            }

            // 🌟 പ്രൊഫഷണൽ ബ്ലൂ ടിക്ക് SVG ലോജിക് (ഇമോജി അല്ലാത്ത കസ്റ്റം സ്പാൻ)
            // ഡാറ്റാബേസിൽ യൂസറുടെ 'isVerified' true ആണെങ്കിൽ മാത്രം കാണിക്കും
            const verifiedBadgeHtml = postData.isVerified 
                ? `<span class="verified-badge" title="Official Spot" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle; user-select:none;"><svg viewBox="0 0 24 24" width="16" height="16" fill="#0095f6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></span>` 
                : '';

            const postElement = document.createElement('article');
            postElement.classList.add('post');
            postElement.innerHTML = `
                <div class="post-header">
                    <img src="${postData.profilePic || 'https://via.placeholder.com/40/ff1e42/ffffff?text=U'}" alt="Profile" class="profile-pic">
                    <span class="username">${postData.username || 'Anonymous User'}${verifiedBadgeHtml}</span>
                    ${deleteIconHtml}
                </div>
                <div class="post-media">
                    ${mediaHtml}
                </div>
                <div class="post-actions">
                    <i class="fa-regular fa-heart"></i>
                    <i class="fa-regular fa-comment"></i>
                </div>
                <div class="post-details">
                    <p><strong>${postData.username || 'Anonymous User'}${verifiedBadgeHtml}</strong> ${postData.caption || ""}</p>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });

        document.querySelectorAll('.delete-icon').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deletePost(id);
            });
        });

    } catch (error) {
        console.error("Error fetching posts:", error);
    }
}

// ==========================================
// 7. PERMANENT DELETE POST LOGIC
// ==========================================
async function deletePost(postId) {
    const confirmation = confirm("Are you sure you want to permanently delete this post?");
    if (!confirmation) return;

    if (!auth.currentUser) {
        alert("നിങ്ങൾ ലോഗിൻ ചെയ്തിട്ടില്ല!");
        return;
    }

    try {
        const postDocRef = doc(db, "posts", postId);
        await deleteDoc(postDocRef);
        alert("Post deleted successfully!");
        fetchAndDisplayPosts(); 
    } catch (error) {
        console.error("Error deleting post:", error);
        if (error.code === 'permission-denied') {
            alert("നിങ്ങൾക്ക് ഈ പോസ്റ്റ് ഡിലീറ്റ് ചെയ്യാൻ അനുവാദമില്ല!");
        } else {
            alert("Failed to delete: " + error.message);
        }
    }
}

// ==========================================
// 8. NEW USER SIGN-UP LOGIC
// ==========================================
window.handleRegisterUser = async (email, password, username) => {
    try {
        const formattedUsername = username.trim().toLowerCase(); 
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const newUid = user.uid;

        const defaultProfilePic = "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

        // സുരക്ഷിതമായി ഡാറ്റാബേസിലേക്ക് വെരിഫിക്കേഷൻ ഫോൾസ് ആക്കി കയറ്റുന്നു
        await setDoc(doc(db, "users", newUid), {
            uid: newUid,
            username: formattedUsername,
            email: email,
            profilePic: defaultProfilePic,
            isVerified: false, 
            createdAt: new Date().toISOString()
        });

        const userInfo = {
            uid: newUid,
            username: formattedUsername,
            profilePic: defaultProfilePic,
            isVerified: false
        };
        localStorage.setItem("infinity_user", JSON.stringify(userInfo));

        console.log("New user registered and added to Firestore!");
        alert("ലോഗിൻ വിജയകരമായി പൂർത്തിയായി!");
        
        // സർവർ റീഡയറക്ട് എറർ വരാതിരിക്കാൻ സുരക്ഷിതമായ replace രീതി ഉപയോഗിക്കുന്നു
        window.location.replace("./home.html"); 

    } catch (error) {
        console.error("Registration failed:", error);
        alert("രജിസ്ട്രേഷൻ എറർ: " + error.message);
    }
};

// ആപ്പ് ലോഡ് ചെയ്യുമ്പോൾ ഫീഡ് കാണിക്കാൻ വിളിക്കുന്നു
fetchAndDisplayPosts();
