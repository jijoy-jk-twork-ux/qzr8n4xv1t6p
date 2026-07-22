// ==========================================
// 1. CONFIGURATIONS & FIREBASE SETUP
// ==========================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/wbmr3lkx/upload';
const CLOUDINARY_UPLOAD_PRESET = 'Infinity_preset'; 

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, getDoc, query, orderBy, 
    doc, deleteDoc, setDoc, updateDoc, arrayUnion, arrayRemove, increment 
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

// ==========================================
// 4. MODAL & PREVIEW CONTROLS
// ==========================================
if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
        if (uploadModal) uploadModal.style.display = 'flex';
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

                if (fileType.startsWith('image/') && imagePreview) {
                    imagePreview.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                    if (videoPreview) videoPreview.classList.add('hidden');
                } else if (fileType.startsWith('video/') && videoPreview) {
                    videoPreview.src = e.target.result;
                    videoPreview.classList.remove('hidden');
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
        if (!fileInput || !fileInput.files[0]) {
            alert("Please select a photo or video!");
            return;
        }

        const file = fileInput.files[0];
        const caption = captionInput ? captionInput.value : "";

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
        let profilePic = "";

        if (localUserData) {
            const user = JSON.parse(localUserData);
            userId = user.uid || "anonymous";
            username = user.username || "Anonymous User";
            profilePic = user.profilePic || user.avatar || "";
        }

        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=ff1e42&color=fff&size=128`;

        await addDoc(collection(db, "posts"), {
            url: mediaUrl,
            type: mediaType,
            caption: caption,
            public_id: publicId,
            createdAt: new Date(),
            likes: [],
            likeCount: 0,
            userId: userId,
            username: username,
            profilePic: profilePic || fallbackAvatar
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

            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(postData.username || 'User')}&background=ff1e42&color=fff&size=128`;
            const userPic = postData.profilePic && postData.profilePic.trim() !== "" ? postData.profilePic : fallbackAvatar;

            const postElement = document.createElement('article');
            postElement.classList.add('post');
            postElement.innerHTML = `
    <div class="post-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px;">
        <!-- പ്രൊഫൈൽ ചിത്രവും യൂസർനെയിമും ഒന്നിച്ചു നിർത്താൻ ഒരു Wrapper -->
        <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${userPic}" alt="Profile" class="profile-pic" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;" onerror="this.src='${fallbackAvatar}'">
            <span class="username" style="font-weight: bold; cursor: pointer;" onclick="window.location.href='profile.html?id=${postData.userId}'">@${postData.username || 'anonymous'}</span>
        </div>
        
        <!-- Delete Icon ഇവിടെ വലത് വശത്ത് കൃത്യമായി നിൽക്കും -->
        ${deleteIconHtml}
    </div>
    <div class="post-media">
        ${mediaHtml}
    </div>
    <div class="post-actions" style="display: flex; gap: 15px; align-items: center; padding: 10px 0 5px 0;">
        <i class="fa-regular fa-heart like-icon" style="cursor: pointer; font-size: 1.4rem;"></i>
        <i class="fa-regular fa-comment comment-icon" style="cursor: pointer; font-size: 1.4rem;" onclick="openCommentSheet('${postId}')"></i>
    </div>
    <div class="post-details">
        <span class="likes-count" style="font-weight: bold; display: block; margin-bottom: 2px; font-size: 0.9rem; color: #fff;">0 likes</span>
        <p><strong>@${postData.username || 'anonymous'}</strong> ${postData.caption || ""}</p>
    </div>
`;

            feedContainer.appendChild(postElement);

            // ലൈക്ക് ഫങ്ഷൻ കണക്ട് ചെയ്യുന്നു
            setupLikeButton(postElement, postId, postData);
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
// 7. LIKE BUTTON LOGIC (FIXED)
// ==========================================
async function setupLikeButton(postElement, postId, postData) {
    const likeIcon = postElement.querySelector('.like-icon');
    const likesCountSpan = postElement.querySelector('.likes-count');
    
    if (!likeIcon || !likesCountSpan) return;

    const postDocRef = doc(db, "posts", postId);
    const localUserData = localStorage.getItem("infinity_user");
    
    let currentUserId = "";
    if (localUserData) {
        try {
            const currentUser = JSON.parse(localUserData);
            currentUserId = currentUser.uid || "";
        } catch (e) {
            console.error("Local storage user parse error:", e);
        }
    }

    let likedUsersList = Array.isArray(postData.likes) ? [...postData.likes] : []; 
    let hasLiked = currentUserId ? likedUsersList.includes(currentUserId) : false;

    let likedByText = postElement.querySelector('.liked-by-text');
    if (!likedByText) {
        likedByText = document.createElement('p');
        likedByText.className = 'liked-by-text';
        likedByText.style.cssText = "font-size: 0.8rem; color: #aaa; margin-top: 2px;";
        likesCountSpan.after(likedByText);
    }

    async function updateLikeUI() {
        likesCountSpan.innerText = `${likedUsersList.length} likes`;

        if (hasLiked) {
            likeIcon.classList.remove('fa-regular');
            likeIcon.classList.add('fa-solid');
            likeIcon.style.color = '#ff3366';
        } else {
            likeIcon.classList.remove('fa-solid');
            likeIcon.classList.add('fa-regular');
            likeIcon.style.color = 'white';
        }

        if (likedUsersList.length > 0) {
            const lastLikedUid = likedUsersList[likedUsersList.length - 1];
            try {
                const userDocSnap = await getDoc(doc(db, "users", lastLikedUid));
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    const username = userData.username || "User";
                    const othersCount = likedUsersList.length - 1;
                    likedByText.innerText = `Liked by @${username} ${othersCount > 0 ? `and ${othersCount} others` : ''}`;
                } else {
                    likedByText.innerText = `Liked by ${likedUsersList.length} people`;
                }
            } catch (e) {
                likedByText.innerText = `Liked by ${likedUsersList.length} people`;
            }
        } else {
            likedByText.innerText = "";
        }
    }

    await updateLikeUI();

    likeIcon.onclick = async () => {
        if (!currentUserId) {
            alert("Please log in to like this post!");
            return;
        }

        likeIcon.style.pointerEvents = 'none';

        try {
            if (!hasLiked) {
                hasLiked = true;
                likedUsersList.push(currentUserId);
                await updateLikeUI();

                await updateDoc(postDocRef, {
                    likeCount: increment(1),
                    likes: arrayUnion(currentUserId)
                });
            } else {
                hasLiked = false;
                likedUsersList = likedUsersList.filter(id => id !== currentUserId);
                await updateLikeUI();

                await updateDoc(postDocRef, {
                    likeCount: increment(-1),
                    likes: arrayRemove(currentUserId)
                });
            }
        } catch (error) {
            console.error("Like error:", error);
            hasLiked = !hasLiked;
            if (hasLiked) {
                likedUsersList.push(currentUserId);
            } else {
                likedUsersList = likedUsersList.filter(id => id !== currentUserId);
            }
            await updateLikeUI();
        } finally {
            likeIcon.style.pointerEvents = 'auto';
        }
    };
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
        const defaultProfilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(formattedUsername)}&background=ff1e42&color=fff&size=128`;

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
        if (profileDisplay) {
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.username)}&background=ff1e42&color=fff&size=128`;
            profileDisplay.src = currentUserData.profilePic || currentUserData.avatar || fallbackAvatar;
            profileDisplay.onerror = function() { this.src = fallbackAvatar; };
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
// 12. ANNOUNCEMENTS LOGIC
// ==========================================
if (window.location.pathname.includes("announcement.html")) {
    document.addEventListener("DOMContentLoaded", () => {
        const adminForm = document.getElementById("admin-update-form");
        
        if (currentUserData) {
            const loggedUsername = currentUserData.username.trim().toLowerCase();
            if (loggedUsername === "infinityspot") {
                if (adminForm) adminForm.style.display = "block";
            }
        }

        fetchAnnouncements();

        const postUpdateBtn = document.getElementById("post-update-btn");
        if (postUpdateBtn) {
            postUpdateBtn.addEventListener("click", postNewAnnouncement);
        }
    });
}

async function postNewAnnouncement() {
    const updateTextInput = document.getElementById("update-text");
    if (!updateTextInput || !updateTextInput.value.trim()) {
        alert("Start typing... !");
        return;
    }

    try {
        if (!currentUserData || currentUserData.username.trim().toLowerCase() !== "infinityspot") {
            alert("You don't have permission!");
            return;
        }

        await addDoc(collection(db, "announcements"), {
            text: updateTextInput.value.trim(),
            createdAt: new Date(),
            postedBy: "Developer"
        });

        updateTextInput.value = "";
        alert("Your update has been posted");
        fetchAnnouncements(); 

    } catch (error) {
        console.error("Error:", error);
        alert("Failed to post: " + error.message);
    }
}

async function fetchAnnouncements() {
    const updatesList = document.getElementById("updates-list");
    if (!updatesList) return;

    try {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        updatesList.innerHTML = "";

        if (querySnapshot.empty) {
            updatesList.innerHTML = "<p style='color:#666; text-align:center;'>No updates available!</p>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            let displayDate = "";
            if (data.createdAt) {
                const t = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
                displayDate = t.toLocaleDateString() + " " + t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            const card = document.createElement("div");
            card.className = "update-card";
            card.innerHTML = `
                <p>${data.text}</p>
                <div class="update-meta">
                    <span><i class="fa-solid fa-user-shield"></i> ${data.postedBy}</span>
                    <span><i class="fa-regular fa-clock"></i> ${displayDate}</span>
                </div>
            `;
            updatesList.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        updatesList.innerHTML = "<p style='color:red; text-align:center;'>Failed to load!</p>";
    }
}

// ==========================================
// 13. COMMENT LOGIC
// ==========================================
window.openCommentSheet = function(postId) {
    const sheet = document.getElementById('comment-sheet');
    if (!sheet) return;

    window.currentActivePostId = postId;

    sheet.style.display = 'flex';
    setTimeout(() => {
        sheet.classList.add('show');
    }, 10);

    if (typeof window.loadCommentsForPost === 'function') {
        window.loadCommentsForPost(postId);
    }
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
            container.innerHTML = '<p class="no-comments" style="text-align:center; color:#888; padding:20px;">No comments yet. Start the conversation!</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const commentData = docSnap.data();
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(commentData.username || 'User')}&background=ff1e42&color=fff&size=128`;
            const cPic = commentData.profilePic || fallbackAvatar;

            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';
            commentItem.style.cssText = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start;";
            commentItem.innerHTML = `
                <img src="${cPic}" class="comment-user-pic" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='${fallbackAvatar}'">
                <div class="comment-details">
                    <strong style="font-size: 0.85rem; color: #fff;">@${commentData.username || 'anonymous'}</strong>
                    <p style="font-size: 0.85rem; color: #ddd; margin-top: 2px;">${commentData.text}</p>
                </div>
            `;
            container.appendChild(commentItem);
        });
        
        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error("Error loading comments:", error);
        container.innerHTML = "<p style='color:red; text-align:center;'>Failed to load comments!</p>";
    }
};

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

    if (submitCommentBtn && commentInput) {
        submitCommentBtn.addEventListener('click', async () => {
            const text = commentInput.value.trim();
            const postId = window.currentActivePostId;

            if (!text) return;
            if (!postId) { alert("Error: Post ID missing!"); return; }

            submitCommentBtn.disabled = true;

            try {
                const localUserData = localStorage.getItem("infinity_user");
                let username = "Anonymous";
                let profilePic = "";

                if (localUserData) {
                    const user = JSON.parse(localUserData);
                    username = user.username || "Anonymous";
                    profilePic = user.profilePic || user.avatar || "";
                }

                const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=ff1e42&color=fff&size=128`;

                await addDoc(collection(db, "posts", postId, "comments"), {
                    text: text,
                    username: username,
                    profilePic: profilePic || fallbackAvatar,
                    createdAt: new Date()
                });

                commentInput.value = "";
                loadCommentsForPost(postId);

            } catch (error) {
                console.error("Error posting comment:", error);
                alert("You are not allowed to comment!");
            } finally {
                submitCommentBtn.disabled = false;
            }
        });
    }
});

// ഫീഡ് പേജ് ലോഡ് ആകുമ്പോൾ പോസ്റ്റുകൾ ലോഡ് ചെയ്യും
fetchAndDisplayPosts();
