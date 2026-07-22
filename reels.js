// 1. All Firebase Imports at the top
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    addDoc,
    onSnapshot,
    orderBy,
    serverTimestamp,
    arrayUnion, 
    arrayRemove, 
    increment 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
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

const CLOUD_NAME = "hrobsz6n";
const reelsContainer = document.getElementById('reels-container');
const currentUser = JSON.parse(localStorage.getItem("infinity_user") || "{}");

// Comment Modal Elements
const commentModal = document.getElementById('comment-modal');
const closeCommentsBtn = document.getElementById('close-comments');
const commentsList = document.getElementById('comments-list');
const commentInput = document.getElementById('comment-input');
const postCommentBtn = document.getElementById('post-comment-btn');

let activeReelId = null;
let activeCommentCountSpan = null;
let unsubscribeComments = null;

// 2. Cloudinary URL Formatter
function formatCloudinaryUrl(mediaUrl) {
    if (!mediaUrl) return '';
    if (!mediaUrl.startsWith('http')) {
        return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${mediaUrl}`;
    }
    return mediaUrl;
}

// 3. Load Reels
async function loadReels() {
    try {
        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("type", "==", "video"));
        const querySnapshot = await getDocs(q);

        reelsContainer.innerHTML = '';

        if (querySnapshot.empty) {
            reelsContainer.innerHTML = `
                <div style="text-align:center; display:flex; justify-content:center; align-items:center; height:100vh; color:#888;">
                    <p>No videos found</p>
                </div>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const reel = docSnap.data();
            const reelId = docSnap.id;
            renderReelCard(reel, reelId);
        });

        setupAutoPlayObserver();

    } catch (error) {
        console.error("Failed to load reels. Please try again:", error);
    }
}

// 4. Render Reel Card
function renderReelCard(reel, reelId) {
    const videoUrl = formatCloudinaryUrl(reel.mediaUrl);
    const likesList = Array.isArray(reel.likes) ? reel.likes : [];
    const isLiked = currentUser.username && likesList.includes(currentUser.username);

    // 🎯 സ്വന്തം പോസ്റ്റ് ആണോ എന്ന് നോക്കുന്നു
    const isMyReel = currentUser.username && (currentUser.username === reel.username);

    const card = document.createElement('div');
    card.className = 'reel-card';
    card.innerHTML = `
        <video class="reel-video" src="${videoUrl}" loop playsinline preload="metadata" muted></video>
        
        <!-- 🔊 Sound Indicator Icon -->
        <div class="sound-indicator" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 50%; color: #fff; cursor: pointer; z-index: 10;">
            <i class="fa-solid fa-volume-xmark sound-icon"></i>
        </div>

        <div class="reel-overlay">
            <div class="user-info">
                <img src="${reel.userAvatar || 'https://via.placeholder.com/40'}" class="user-avatar" alt="profile">
                <span class="username">@${reel.username || 'user'}</span>
            </div>
            <p class="caption">${reel.caption || ''}</p>
        </div>

        <div class="action-buttons">
            <button class="action-btn like-btn" data-id="${reelId}">
                <i class="${isLiked ? 'fa-solid fa-heart active' : 'fa-regular fa-heart'}"></i>
                <span class="like-count">${reel.likeCount || likesList.length || 0}</span>
            </button>
            <button class="action-btn comment-btn">
                <i class="fa-regular fa-comment"></i>
                <span class="comment-count">${reel.commentCount || 0}</span>
            </button>
            <button class="action-btn">
                <i class="fa-regular fa-paper-plane"></i>
            </button>

            <!-- 🗑️ സ്വന്തം റീൽ ആണെങ്കിൽ മാത്രം Delete ബട്ടൺ കാണിക്കും -->
            ${isMyReel ? `
                <button class="action-btn delete-btn" title="Delete Reel">
                    <i class="fa-solid fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `;

    const video = card.querySelector('.reel-video');
    const soundIndicator = card.querySelector('.sound-indicator');
    const soundIcon = card.querySelector('.sound-icon');
    const commentBtn = card.querySelector('.comment-btn');
    const commentCountSpan = card.querySelector('.comment-count');

    // 💬 Comment Button Click Event
    commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCommentModal(reelId, commentCountSpan);
    });

    // 🔊 Mute / Unmute Toggle Function
    const toggleSound = () => {
        if (video.muted) {
            video.muted = false;
            soundIcon.className = "fa-solid fa-volume-high sound-icon";
        } else {
            video.muted = true;
            soundIcon.className = "fa-solid fa-volume-xmark sound-icon";
        }
    };

    // Sound Icon-ൽ ക്ലിക്ക് ചെയ്യുമ്പോൾ Sound On/Off ആകാൻ
    soundIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSound();
    });

    // 🎥 Screen Tap to Play/Pause & Sound Control
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons') && !e.target.closest('.sound-indicator')) {
            if (video.muted) {
                toggleSound();
            } else if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    });

    // 🗑️ Delete Logic
    if (isMyReel) {
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            e.preventDefault();

            const confirmDelete = confirm("ഈ റീൽ ഡിലീറ്റ് ചെയ്യണമെന്ന് ഉറപ്പാണോ?");
            if (confirmDelete) {
                try {
                    await deleteDoc(doc(db, "posts", reelId));
                    card.remove(); 
                    alert("Reel successfully deleted! 🗑️");
                } catch (error) {
                    console.error("Delete Error:", error);
                    alert("ഡിലീറ്റ് ചെയ്യാൻ പറ്റിയില്ല! വീണ്ടും ശ്രമിക്കൂ.");
                }
            }
        });
    }

    // ❤️ Like Button Logic
    const likeBtn = card.querySelector('.like-btn');
    const likeIcon = likeBtn.querySelector('i');
    const likeCountSpan = likeBtn.querySelector('.like-count');

    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentUser.username) {
            alert("Please log in to like!");
            return;
        }

        let currentCount = parseInt(likeCountSpan.innerText) || 0;
        let hasLiked = likeIcon.classList.contains('active');

        if (!hasLiked) {
            likeIcon.className = 'fa-solid fa-heart active';
            likeCountSpan.innerText = currentCount + 1;

            await updateDoc(doc(db, "posts", reelId), {
                likeCount: increment(1),
                likes: arrayUnion(currentUser.username)
            });
        } else {
            likeIcon.className = 'fa-regular fa-heart';
            likeCountSpan.innerText = Math.max(0, currentCount - 1);

            await updateDoc(doc(db, "posts", reelId), {
                likeCount: increment(-1),
                likes: arrayRemove(currentUser.username)
            });
        }
    });

    reelsContainer.appendChild(card);
}

// 5. Open Comment Modal Function
function openCommentModal(reelId, commentCountSpan) {
    activeReelId = reelId;
    activeCommentCountSpan = commentCountSpan;
    commentModal.style.display = 'flex';
    commentsList.innerHTML = '<p style="color:#aaa; text-align:center;">Loading comments...</p>';

    if (unsubscribeComments) unsubscribeComments();

    const commentsRef = collection(db, "posts", reelId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));

    unsubscribeComments = onSnapshot(q, (snapshot) => {
        commentsList.innerHTML = '';
        if (snapshot.empty) {
            commentsList.innerHTML = '<p style="color:#666; text-align:center;">No comments yet. Be the first to comment!</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const comment = docSnap.data();
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <img src="${comment.userAvatar || 'https://via.placeholder.com/40'}" class="comment-avatar">
                <div class="comment-text-box">
                    <span class="comment-user">@${comment.username || 'user'}</span>
                    <p class="comment-text">${comment.text}</p>
                </div>
            `;
            commentsList.appendChild(div);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });
}

// 6. Close Comment Modal Logic
if (closeCommentsBtn) {
    closeCommentsBtn.addEventListener('click', () => {
        commentModal.style.display = 'none';
        if (unsubscribeComments) unsubscribeComments();
    });
}

// 7. Post Comment Logic
if (postCommentBtn) {
    postCommentBtn.addEventListener('click', async () => {
        const text = commentInput.value.trim();
        if (!text) return;

        if (!currentUser.username) {
            alert("Please log in to comment!");
            return;
        }

        try {
            commentInput.value = '';
            const commentsRef = collection(db, "posts", activeReelId, "comments");
            
            await addDoc(commentsRef, {
                text: text,
                username: currentUser.username,
                userAvatar: currentUser.avatar || 'https://via.placeholder.com/40',
                createdAt: serverTimestamp()
            });

            const postRef = doc(db, "posts", activeReelId);
            await updateDoc(postRef, {
                commentCount: increment(1)
            });

            if (activeCommentCountSpan) {
                let currentCount = parseInt(activeCommentCountSpan.innerText) || 0;
                activeCommentCountSpan.innerText = currentCount + 1;
            }

        } catch (error) {
            console.error("Comment Error:", error);
            alert("Could not post comment. Try again!");
        }
    });
}

// 8. IntersectionObserver (Auto-Play System)
function setupAutoPlayObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('.reel-video');
            const soundIcon = entry.target.querySelector('.sound-icon');
            
            if (video) {
                if (entry.isIntersecting) {
                    video.play().catch(() => {
                        video.muted = true;
                        if (soundIcon) soundIcon.className = "fa-solid fa-volume-xmark sound-icon";
                        video.play();
                    });
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll('.reel-card').forEach(card => observer.observe(card));
}

// Start Loading
loadReels();
