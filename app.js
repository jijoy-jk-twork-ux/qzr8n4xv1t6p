// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP
// ==========================================
// Cloudinary ഡാറ്റ
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

// Firebase core SDKs ഇമ്പോർട്ട് ചെയ്യുന്നു
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

console.log("Firebase Connected successfully!");

// ==========================================
// 2. HTML ELEMENTS SELECTORS
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
// 3. MODAL & PREVIEW CONTROLS (വിൻഡോ കൺട്രോളുകൾ)
// ==========================================

// പ്ലസ് ബട്ടൺ അമർത്തുമ്പോൾ വിൻഡോ കാണിക്കാൻ
if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
        uploadModal.style.display = 'flex';
    });
}

// 'X' ബട്ടൺ അമർത്തുമ്പോൾ അടയ്ക്കാൻ
if (closeModal) {
    closeModal.addEventListener('click', resetAndCloseModal);
}

// വിൻഡോയ്ക്ക് പുറത്ത് ക്ലിക്ക് ചെയ്താൽ അടയ്ക്കാൻ
window.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        resetAndCloseModal();
    }
});

// ഫയൽ സെലക്ട് ചെയ്യുമ്പോൾ പ്രിവ്യൂ കാണിക്കാൻ
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

// സെലക്ട് ചെയ്ത ഫയൽ മാറ്റാൻ
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
// 4. CLOUDINARY & FIREBASE UPLOAD LOGIC
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

// Firebase Firestore-ലേക്ക് ഡാറ്റ സേവ് ചെയ്യാനുള്ള ഫങ്ഷൻ
async function savePostToFirebase(mediaUrl, mediaType, caption, publicId) {
    try {
        // ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് ലോഗിൻ ചെയ്ത യൂസറുടെ വിവരങ്ങൾ എടുക്കുന്നു
        const localUserData = localStorage.getItem("infinity_user");
        let userId = "anonymous";
        let username = "Anonymous User";
        let profilePic = "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

        if (localUserData) {
            const user = JSON.parse(localUserData);
            userId = user.uid || "anonymous";
            username = user.username || "Anonymous User";
            profilePic = user.profilePic || profilePic;
        }

        // പോസ്റ്റ് ഡാറ്റ ഫയർബേസിലേക്ക് അയക്കുന്നു
        await addDoc(collection(db, "posts"), {
            url: mediaUrl,
            type: mediaType,
            caption: caption,
            public_id: publicId,
            createdAt: new Date(),
            likes: 0,
            userId: userId,        // 🔒 ഡിലീറ്റ് ഓപ്ഷൻ സെക്യൂർ ആക്കാൻ യൂസർ ഐഡി ചേർക്കുന്നു
            username: username,    // ഫീഡിൽ പേര് കാണിക്കാൻ
            profilePic: profilePic // ഫീഡിൽ പ്രൊഫൈൽ പിക്ചർ കാണിക്കാൻ
        });
        console.log("Post saved to Firestore successfully with User ID!");
    } catch (error) {
        console.error("Firebase saving error:", error);
        throw error;
    }
}

// ==========================================
// 5. FETCH & DISPLAY POSTS (ഫീഡിൽ കാണിക്കാൻ)
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

        // ലോഗിൻ ചെയ്തിരിക്കുന്ന യൂസറുടെ ഐഡി ലോക്കൽ സ്റ്റോറേജിൽ നിന്ന് എടുക്കുന്നു
        const localUserData = localStorage.getItem("infinity_user");
        let currentUserId = "";
        if (localUserData) {
            currentUserId = JSON.parse(localUserData).uid;
        }

        querySnapshot.forEach((documentSnapshot) => {
            const postData = documentSnapshot.data();
            const postId = documentSnapshot.id;

            let mediaHtml = "";
            if (postData.type === 'image') {
                mediaHtml = `<img src="${postData.url}" alt="Post Image" class="main-media">`;
            } else if (postData.type === 'video') {
                mediaHtml = `<video src="${postData.url}" controls class="main-media"></video>`;
            }

            // 🔒 സ്വന്തം പോസ്റ്റ് ആണെങ്കിൽ മാത്രമേ ഡിലീറ്റ് ഐക്കൺ HTML-ൽ കാണിക്കൂ!
            let deleteIconHtml = "";
            if (postData.userId === currentUserId) {
                deleteIconHtml = `<i class="fa-regular fa-trash-can delete-icon" style="margin-left: auto; cursor: pointer; color: #ff4d4d;" data-id="${postId}"></i>`;
            }

            const postElement = document.createElement('article');
            postElement.classList.add('post');
            postElement.innerHTML = `
                <div class="post-header">
                    <img src="${postData.profilePic || 'https://via.placeholder.com/40/ff1e42/ffffff?text=U'}" alt="Profile" class="profile-pic">
                    <span class="username">${postData.username || 'Anonymous User'}</span>
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
                    <p><strong>${postData.username || 'Anonymous User'}</strong> ${postData.caption || ""}</p>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });

        // ഡിലീറ്റ് ഐക്കണുകൾക്ക് ഇവന്റ് ലിസണർ നൽകുന്നു
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
// 6. PERMANENT DELETE POST LOGIC (Updated)
// ==========================================
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; // ഇത് മുകളിൽ ഇമ്പോർട്ട് ചെയ്യണം

async function deletePost(postId) {
    const confirmation = confirm("Are you sure you want to permanently delete this post?");
    if (!confirmation) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        alert("നിങ്ങൾ ലോഗിൻ ചെയ്തിട്ടില്ല!");
        return;
    }

    try {
        const postDocRef = doc(db, "posts", postId);
        
        // ഫയർബേസിൽ നിന്ന് ഡിലീറ്റ് ചെയ്യുന്നു
        await deleteDoc(postDocRef);
        
        alert("Post deleted successfully!");
        fetchAndDisplayPosts(); 
    } catch (error) {
        console.error("Error deleting post:", error);
        
        // പെർമിഷൻ എറർ ആണോ എന്ന് നോക്കുന്നു
        if (error.code === 'permission-denied') {
            alert("നിങ്ങൾക്ക് ഈ പോസ്റ്റ് ഡിലീറ്റ് ചെയ്യാൻ അനുവാദമില്ല!");
        } else {
            alert("Failed to delete: " + error.message);
        }
    }
}

// ആപ്പ് ലോഡ് ചെയ്യുമ്പോൾ ഫീഡ് കാണിക്കാൻ വിളിക്കുന്നു
fetchAndDisplayPosts();
