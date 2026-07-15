// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; 

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

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
const auth = getAuth(app);

console.log("Firebase Connected successfully!");

// ==========================================
// 2. 🔒 SAFE USER AUTH CHECK (ലോഗിൻ ഡാറ്റ ഇല്ലെങ്കിൽ മാത്രം തിരിച്ചയക്കും)
// ==========================================
let currentUserData = null;
const userDataString = localStorage.getItem("infinity_user");

if (!userDataString) {
    // ലോക്കൽ സ്റ്റോറേജിൽ ഡാറ്റ ഇല്ലെങ്കിൽ ലോഗിൻ പേജിലേക്ക് പോകും
    window.location.replace("./index.html"); 
} else {
    try {
        currentUserData = JSON.parse(userDataString);
        console.log("Welcome to InfinitySpot,", currentUserData.username);
    } catch (e) {
        console.error("Local storage error", e);
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

            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.secure_url) {
                const mediaUrl = data.secure_url;
                const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
                const publicId = data.public_id;

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

// 🌟 എഡിറ്റ് ചെയ്ത സെക്യൂർ ഫങ്ക്ഷൻ (വരി 145)
async function savePostToFirebase(mediaUrl, mediaType, caption, publicId) {
    try {
        // ഫയർബേസ് Auth-ൽ നിന്ന് ലോഗിൻ ചെയ്ത യൂസറുടെ ഒറിജിനൽ സെഷൻ എടുക്കുന്നു
        const user = auth.currentUser;

        if (!user) {
            throw new Error("യൂസർ ഫയർബേസിൽ ലോഗിൻ ചെയ്തിട്ടില്ല! ദയവായി അക്കൗണ്ട് ഒന്നുകൂടി പരിശോധിക്കുക.");
        }

        let userId = user.uid; // ഒറിജിനൽ UID ഫയർബേസ് റൂൾസിന് വേണ്ടി
        let username = "Anonymous User";
        let profilePic = "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

        // ബാക്കി വിവരങ്ങൾ ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് എടുക്കുന്നു
        if (currentUserData) {
            username = currentUserData.username || username;
            profilePic = currentUserData.profilePic || profilePic;
        }

        // Firestore-ലേക്ക് പോസ്റ്റ് സേവ് ചെയ്യുന്നു
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
    } catch (error) {
        console.error("Firebase saving error:", error);
        throw error;
    }
}

// ==========================================
// 6. FETCH & DISPLAY POSTS
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

            // പ്രൊഫഷണൽ ബ്ലൂ ടിക്ക് SVG
            const verifiedBadgeHtml = postData.isVerified 
                ? `<span class="verified-badge" title="Official Spot" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle;"><svg viewBox="0 0 24 24" width="16" height="16" fill="#0095f6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></span>` 
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

    try {
        const postDocRef = doc(db, "posts", postId);
        await deleteDoc(postDocRef);
        alert("Post deleted successfully!");
        fetchAndDisplayPosts(); 
    } catch (error) {
        console.error("Error deleting post:", error);
        alert("Failed to delete: " + error.message);
    }
}

// ഫീഡ് കാണിക്കാൻ വിളിക്കുന്നു
fetchAndDisplayPosts();
