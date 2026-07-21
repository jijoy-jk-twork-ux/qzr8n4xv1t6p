// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP
// ==========================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, 
    doc, deleteDoc, setDoc, updateDoc, increment, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; 

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
// 2. PAGE GUARD & USER DATA RETRIEVAL
// ==========================================
let currentUserData = null;
const userDataString = localStorage.getItem("infinity_user");

if (!userDataString) {
    window.location.replace("index.html");
} else {
    currentUserData = JSON.parse(userDataString);
    console.log("Logged in user:", currentUserData.username);
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

// 💡 Native WebView-ൽ ഗാലറി നിർബന്ധമായി ഓപ്പൺ ആകാനുള്ള കോഡ്
if (fileInput) {
    fileInput.setAttribute("accept", "image/*,video/*");
}

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
                if (dropArea) dropArea.classList.add('hidden'); 
                if (previewContainer) previewContainer.classList.remove('hidden'); 

                if (fileType.startsWith('image/')) {
                    if (imagePreview) {
                        imagePreview.src = e.target.result;
                        imagePreview.classList.remove('hidden');
                    }
                    if (videoPreview) videoPreview.classList.add('hidden');
                } else if (fileType.startsWith('video/')) {
                    if (videoPreview) {
                        videoPreview.src = e.target.result;
                        videoPreview.classList.remove('hidden');
                    }
                    if (imagePreview) imagePreview.classList.add('hidden');
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
    if (fileInput) fileInput.value = '';
    if (imagePreview) { imagePreview.src = ''; imagePreview.classList.add('hidden'); }
    if (videoPreview) { videoPreview.src = ''; videoPreview.classList.add('hidden'); }
    if (previewContainer) previewContainer.classList.add('hidden');
    if (dropArea) dropArea.classList.remove('hidden');
}

function resetAndCloseModal() {
    if (uploadModal) uploadModal.style.display = 'none';
    resetFileSelection();
    if (captionInput) captionInput.value = '';
}

// ==========================================
// 5. CLOUDINARY & FIREBASE UPLOAD LOGIC
// ==========================================
if (submitPostBtn) {
    submitPostBtn.addEventListener('click', async () => {
        const file = fileInput ? fileInput.files[0] : null;
        const caption = captionInput ? captionInput.value : '';

        if (!file) {
            alert("Please select a photo or video!");
            return;
        }

        submitPostBtn.innerText = "Uploading...";
        submitPostBtn.disabled = true;

        try {
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

async function savePostToFirebase(mediaUrl, mediaType, caption, publicId) {
    try {
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

        await addDoc(collection(db, "posts"), {
            url: mediaUrl,
            type: mediaType,
            caption: caption,
            public_id: publicId,
            createdAt: new Date(),
            likes: [], // അറേ ആയി സെറ്റ് ചെയ്യുന്നു
            likeCount: 0,
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

            let deleteIconHtml = "";
            if (postData.userId === currentUserId && currentUserId !== "") {
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
                <div class="post-actions" style="display: flex; gap: 15px; align-items: center; padding: 10px 0 5px 0;">
                    <i class="fa-regular fa-heart like-icon" style="cursor: pointer; font-size: 1.4rem; color: white;"></i>
                    <i class="fa-regular fa-comment comment-icon" style="cursor: pointer; font-size: 1.4rem;" onclick="openCommentSheet('${postId}')"></i>
                </div>
                <div class="post-details">
                    <span class="likes-count" style="font-weight: bold; display: block; margin-bottom: 5px; font-size: 0.9rem; color: #fff;">0 likes</span>
                    <p><strong>${postData.username || 'Anonymous User'}</strong> ${postData.caption || ""}</p>
                </div>
            `;
            feedContainer.appendChild(postElement);

            // 💡 പോസ്റ്റ് ഡാറ്റ കൂടി ഇവിടെ പാസ്സ് ചെയ്യുന്നു (ലൈക്ക് വർക്ക് ചെയ്യാൻ)
            setupLikeButton(postElement, postId, postData);
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
// 7. LIKE BUTTON LOGIC (FIXED 🔥)
// ==========================================
async function setupLikeButton(postElement, postId, postData) {
    const likeIcon = postElement.querySelector('.like-icon');
    const likesCountSpan = postElement.querySelector('.likes-count');
    
    if (!likeIcon || !likesCountSpan) return;

    const postDocRef = doc(db, "posts", postId);
    const localUserData = localStorage.getItem("infinity_user");
    
    let currentUserId = "";
    if (localUserData) {
        const currentUser = JSON.parse(localUserData);
        currentUserId = currentUser.uid;
    }

    // ലൈക്ക് അറേ കൈകാര്യം ചെയ്യുന്നു
    const likedUsersList = Array.isArray(postData.likes) ? postData.likes : []; 
    const totalLikes = postData.likeCount !== undefined ? postData.likeCount : likedUsersList.length;
    
    likesCountSpan.innerText = `${totalLikes} likes`;

    let hasLiked = currentUserId && likedUsersList.includes(currentUserId);

    // പേജ് ലോഡാകുമ്പോൾ കളർ സെറ്റ് ചെയ്യുന്നു
    if (hasLiked) {
        likeIcon.classList.remove('fa-regular');
        likeIcon.classList.add('fa-solid');
        likeIcon.style.color = '#ff3366';
    } else {
        likeIcon.classList.remove('fa-solid');
        likeIcon.classList.add('fa-regular');
        likeIcon.style.color = 'white';
    }

    // ക്ലിക്ക് ചെയ്യുമ്പോൾ
    likeIcon.addEventListener('click', async () => {
        if (!currentUserId) {
            alert("Please log in to like this post!");
            return;
        }

        let displayLikes = parseInt(likesCountSpan.innerText) || 0;

        try {
            if (!hasLiked) {
                likeIcon.classList.remove('fa-regular');
                likeIcon.classList.add('fa-solid');
                likeIcon.style.color = '#ff3366';
                likesCountSpan.innerText = `${displayLikes + 1} likes`;
                hasLiked = true;

                await updateDoc(postDocRef, {
                    likeCount: increment(1),
                    likes: arrayUnion(currentUserId)
                });

            } else {
                likeIcon.classList.remove('fa-solid');
                likeIcon.classList.add('fa-regular');
                likeIcon.style.color = 'white';
                likesCountSpan.innerText = `${Math.max(0, displayLikes - 1)} likes`;
                hasLiked = false;

                await updateDoc(postDocRef, {
                    likeCount: increment(-1),
                    likes: arrayRemove(currentUserId)
                });
            }
        } catch (error) {
            hasLiked = !hasLiked;
            likesCountSpan.innerText = `${displayLikes} likes`;
            likeIcon.classList.toggle('fa-solid');
            likeIcon.classList.toggle('fa-regular');
            likeIcon.style.color = hasLiked ? '#ff3366' : 'white';
            console.error("Like Error:", error);
        }
    });
}

// ==========================================
// 8. PERMANENT DELETE POST LOGIC
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

// ==========================================
// 9. NEW USER SIGN-UP LOGIC
// ==========================================
window.handleRegisterUser = async (email, password, username) => {
    try {
        const formattedUsername = username.trim().toLowerCase();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const newUid = user.uid;
        const defaultProfilePic = "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

        await setDoc(doc(db, "users", newUid), {
            uid: newUid,
            username: formattedUsername,
            email: email,
            profilePic: defaultProfilePic,
            createdAt: new Date().toISOString()
        });

        const userInfo = {
            uid: newUid,
            username: formattedUsername,
            profilePic: defaultProfilePic
        };
        localStorage.setItem("infinity_user", JSON.stringify(userInfo));

        alert("ലോഗിൻ വിജയകരമായി പൂർത്തിയായി!");
        window.location.href = "home.html";

    } catch (error) {
        console.error("Registration failed:", error);
        alert("രജിസ്ട്രേഷൻ എറർ: " + error.message);
    }
};

// ==========================================
// 10. SHOW USER DATA ON DOM CONTENT LOADED
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (currentUserData) {
        const mainContent = document.getElementById("mainContent");
        if (mainContent) {
            mainContent.style.display = "block";
        }

        const userDisplay = document.getElementById("navUsername");
        const profileDisplay = document.getElementById("navProfilePic");

        if (userDisplay) {
            userDisplay.innerText = `@${currentUserData.username}`;
        }
        if (profileDisplay && currentUserData.profilePic) {
            profileDisplay.src = currentUserData.profilePic;
        }
    }
});

// ==========================================
// 11. LOGOUT FUNCTIONALITY
// ==========================================
export function handleLogout() {
    localStorage.removeItem("infinity_user");
    localStorage.clear(); 
    sessionStorage.clear();
    window.location.replace("index.html"); 
}

// ==========================================
// 12. COMMENT LOGIC
// ==========================================
window.openCommentSheet = function(postId) {
    const sheet = document.getElementById('comment-sheet');
    if (!sheet) return;

    window.currentActivePostId = postId;

    sheet.style.display = 'flex';
    setTimeout(() => {
        sheet.classList.add('show');
    }, 10);

    window.loadCommentsForPost(postId);
};

window.loadCommentsForPost = async function(postId) {
    const container = document.getElementById('comments-container');
    if (!container) return;

    container.innerHTML = "<p style='text-align:center; color:#666;'>Loading comments...</p>";

    try {
        const commentsQuery = query(
            collection(db, "posts", postId, "comments"), 
            orderBy("createdAt", "asc")
        );
        
        const querySnapshot = await getDocs(commentsQuery);
        container.innerHTML = "";

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="no-comments">No comments yet. Start the conversation!</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const commentData = docSnap.data();
            
            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';
            commentItem.innerHTML = `
                <div class="comment-details">
                    <strong>@${commentData.username || 'anonymous'}</strong>
                    <p>${commentData.text}</p>
                </div>
            `;
            container.appendChild(commentItem);
        });
        
        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error("Error loading comments:", error);
        container.innerHTML = "<p style='color:red; text-align:center;'>Comments ലോഡ് ചെയ്യാൻ പറ്റിയില്ല!</p>";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const sheet = document.getElementById('comment-sheet');
    const closeBtn = document.getElementById('close-comments');
    const overlay = document.querySelector('.sheet-overlay');
    const commentInput = document.getElementById('comment-input');
    const submitCommentBtn = document.getElementById('submit-comment-btn');

    function closeCommentSheet() {
        if (sheet) {
            sheet.classList.remove('show');
            setTimeout(() => { sheet.style.display = 'none'; }, 300);
        }
    }

    if (closeBtn) closeBtn.addEventListener('click', closeCommentSheet);
    if (overlay) overlay.addEventListener('click', closeCommentSheet);

    if (submitCommentBtn) {
        submitCommentBtn.addEventListener('click', async () => {
            const text = commentInput.value.trim();
            const postId = window.currentActivePostId; 

            if (!text) return;
            
            const localUserData = localStorage.getItem("infinity_user");
            if (!localUserData) {
                alert("കമന്റ് ഇടാൻ ആദ്യം ലോഗിൻ ചെയ്യണം!");
                return;
            }

            if (!postId) { 
                alert("Error: "); 
                return; 
            }

            submitCommentBtn.disabled = true;

            try {
                const user = JSON.parse(localUserData);
                const username = user.username || "Anonymous";
                const profilePic = user.profilePic || "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

                await addDoc(collection(db, "posts", postId, "comments"), {
                    text: text,
                    username: username,
                    profilePic: profilePic,
                    createdAt: new Date()
                });

                commentInput.value = ""; 
                window.loadCommentsForPost(postId); 

            } catch (error) {
                console.error("Detailed error posting comment:", error);
                alert(" : " + error.message);
            } finally {
                submitCommentBtn.disabled = false;
            }
        });
    }
});

// ആദ്യ ലോഡിങ്ങിൽ ഫീഡ് ലോഡ് ചെയ്യുന്നു
fetchAndDisplayPosts();
