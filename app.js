// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP
// ==========================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
// 3. HTML ELEMENTS SELECTORS (ഹോം പേജിൽ മാത്രം വർക്ക് ചെയ്യാൻ)
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
        const file = fileInput.files[0];
        const caption = captionInput.value;

        if (!file) {
            alert("Please select a photo!");
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
// 6. FETCH & DISPLAY POSTS (മിസ്സായ ഫങ്ഷൻ തിരികെ ചേർത്തു 🔥)
// ==========================================
async function fetchAndDisplayPosts() {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return; // ഹോം പേജിൽ അല്ലങ്കിൽ ഇവിടെ വെച്ച് നിർത്തും

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

            // 🔒 പേജ് ലോഡ് ആകുമ്പോൾ തന്നെ ലൈക്ക് സ്റ്റാറ്റസ് ചെക്ക് ചെയ്യുന്നു
            let heartClass = "fa-regular";
            let heartColor = "white";
            if (currentUserId !== "") {
                const storageKey = `liked_${currentUserId}_${postId}`;
                if (localStorage.getItem(storageKey) === 'true') {
                    heartClass = "fa-solid";
                    heartColor = "#ff3366";
                }
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
        <i class="${heartClass} fa-heart like-icon" style="cursor: pointer; font-size: 1.4rem; color: ${heartColor};"></i>
        
        <!-- 💬 ഇവിടെയാണ് മാറ്റം വരുത്തിയത്: post.id അല്ലെങ്കിൽ doc.id അല്ല, 'postId' എന്നാണ് നിന്റെ വേരിയബിൾ പേര് -->
        <i class="fa-regular fa-comment comment-icon" style="cursor: pointer; font-size: 1.4rem;" onclick="openCommentSheet('${postId}')"></i>
    </div>
    <div class="post-details">
        <span class="likes-count" style="font-weight: bold; display: block; margin-bottom: 5px; font-size: 0.9rem; color: #fff;">${postData.likes || 0} likes</span>
        <p><strong>${postData.username || 'Anonymous User'}</strong> ${postData.caption || ""}</p>
    </div>
`;
            feedContainer.appendChild(postElement);

            // ലൈക്ക് ഫങ്ഷൻ കണക്ട് ചെയ്യുന്നു
            setupLikeButton(postElement, postId);
        });

        // ഡിലീറ്റ് ഇവന്റ് ലിസണർ ബൈൻഡ് ചെയ്യുന്നു
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
// 7. LIKE BUTTON LOGIC (വൺ യൂസർ, വൺ ലൈക്ക് സിസ്റ്റം)
// ==========================================
async function setupLikeButton(postElement, postId) {
    const likeIcon = postElement.querySelector('.like-icon');
    const likesCountSpan = postElement.querySelector('.likes-count');
    
    if (!likeIcon || !likesCountSpan) return;

    const postDocRef = doc(db, "posts", postId);
    const localUserData = localStorage.getItem("infinity_user");
    
    let currentUserId = "";
    let storageKey = "";
    let hasLiked = false;

    if (localUserData) {
        const currentUser = JSON.parse(localUserData);
        currentUserId = currentUser.uid;
        storageKey = `liked_${currentUserId}_${postId}`;
        hasLiked = localStorage.getItem(storageKey) === 'true';
    }

    likeIcon.addEventListener('click', async () => {
        if (!localUserData) {
            alert("Please log in to like this post!");
            return;
        }

        let currentLikes = parseInt(likesCountSpan.innerText) || 0;
        
        try {
            if (!hasLiked) {
                likeIcon.classList.remove('fa-regular');
                likeIcon.classList.add('fa-solid');
                likeIcon.style.color = '#ff3366';
                
                currentLikes++;
                likesCountSpan.innerText = `${currentLikes} likes`;
                
                hasLiked = true;
                localStorage.setItem(storageKey, 'true');

                await updateDoc(postDocRef, { likes: currentLikes });
            } else {
                likeIcon.classList.remove('fa-solid');
                likeIcon.classList.add('fa-regular');
                likeIcon.style.color = 'white'; 
                
                currentLikes--;
                likesCountSpan.innerText = `${currentLikes} likes`;
                
                hasLiked = false;
                localStorage.removeItem(storageKey);

                await updateDoc(postDocRef, { likes: currentLikes });
            }
        } catch (error) {
            console.error("Like അപ്‌ഡേറ്റ് ചെയ്യാൻ പറ്റിയില്ല:", error);
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
// 12. 🔥 SEPARATE PAGE DEVELOPER ANNOUNCEMENTS LOGIC (FIXED)
// ==========================================
if (window.location.pathname.includes("updates.html")) {
    document.addEventListener("DOMContentLoaded", () => {
        const adminForm = document.getElementById("admin-update-form");
        
        if (currentUserData && currentUserData.username) {
            // യൂസർനെയിം കൃത്യമായി ചെറിയ അക്ഷരത്തിലാക്കി സ്പേസ് കളഞ്ഞു ചെക്ക് ചെയ്യുന്നു
            const loggedUsername = currentUserData.username.trim().toLowerCase();
            
            if (loggedUsername === "infinityspot") {
                if (adminForm) {
                    adminForm.style.display = "block";
                    console.log("Admin panel displayed for infinityspot");
                }
            } else {
                console.log("Logged in user is not admin:", loggedUsername);
            }
        } else {
            console.log("No user data found in localStorage");
        }

        fetchAnnouncements();

        // ഇവിടെ ബട്ടൺ ഐഡി 'post-update-btn' തന്നെയാണോ എന്ന് updates.html ഫയലിൽ ഉറപ്പുവരുത്തുക
        const postUpdateBtn = document.getElementById("post-update-btn");
        if (postUpdateBtn) {
            // പഴയ ലിസണർ ഉണ്ടെങ്കിൽ കൺഫ്യൂഷൻ ഒഴിവാക്കാൻ
            postUpdateBtn.replaceWith(postUpdateBtn.cloneNode(true));
            
            // പുതിയ ലിസണർ ആഡ് ചെയ്യുന്നു
            document.getElementById("post-update-btn").addEventListener("click", postNewAnnouncement);
        }
    });
}

// ==========================================
// 13. 💬 COMMENT LOGIC (UPDATED & FIXED 🔥)
// ==========================================

// കമന്റ് ബോക്സ് തുറക്കാനുള്ള ഫങ്ഷൻ
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

// കമന്റുകൾ ലോഡ് ചെയ്യാനുള്ള ഫങ്ഷൻ
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

// കമന്റ് ഷീറ്റ് കൺട്രോളുകളും സബ്മിറ്റ് ബട്ടണും വർക്ക് ആക്കാൻ
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
            
            // 🔒 ലോഗിൻ ചെക്കിങ് കുറച്ചുകൂടി സ്ട്രോങ്ങ് ആക്കുന്നു
            const localUserData = localStorage.getItem("infinity_user");
            if (!localUserData) {
                alert("അളിയാ, കമന്റ് ഇടാൻ ആദ്യം ലോഗിൻ ചെയ്യണം!");
                return;
            }

            if (!postId) { 
                alert("Error: Post ID കിട്ടിയില്ല!"); 
                return; 
            }

            submitCommentBtn.disabled = true;

            try {
                const user = JSON.parse(localUserData);
                const username = user.username || "Anonymous";
                const profilePic = user.profilePic || "https://via.placeholder.com/40/ff1e42/ffffff?text=U";

                // ഫയർബേസിലേക്ക് കമന്റ് വിടുന്നു
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
                alert("കമന്റ് ഇടാൻ പറ്റിയില്ല! കാരണം: " + error.message);
            } finally {
                submitCommentBtn.disabled = false;
            }
        });
    }
});


function triggerAnnouncement(hasNew) {
    const bell = document.getElementById('announcement-bell');
    const audio = new Audio('notification-sound.mp3'); // ഒരു സൗണ്ട് ഫയൽ ഇവിടെ നൽകുക

    if (hasNew) {
        bell.classList.add('blink-me');
        audio.play(); // സൗണ്ട് പ്ലേ ചെയ്യുന്നു
    } else {
        bell.classList.remove('blink-me');
    }
}

// അനൗൺസ്‌മെന്റ് വരുമ്പോൾ ഇത് വിളിക്കുക: triggerAnnouncement(true);

// ആദ്യ ലോഡിങ്ങിൽ ഹോം ഫീഡ് വർക്ക് ചെയ്യിക്കാൻ ഫങ്ഷൻ കോൾ ചെയ്യുന്നു
fetchAndDisplayPosts();
