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

// 🖼️ Profile Avatar Helper
function getUserAvatar(avatarUrl, username) {
    if (avatarUrl && avatarUrl.trim() !== '') {
        return avatarUrl;
    }
    const name = username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff1e42&color=fff&size=128`;
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
    const videoUrl = formatCloudinaryUrl(reel.mediaUrl || reel.url);
    const likesList = Array.isArray(reel.likes) ? reel.likes : [];
    const isLiked = currentUser.username && likesList.includes(currentUser.username);

    // 🎯 സ്വന്തം പോസ്റ്റ് ആണോ എന്ന് നോക്കുന്നു
    const isMyReel = currentUser.username && (currentUser.username === reel.username);

    // 👤 Profile Avatar
    const userAvatar = getUserAvatar(reel.profilePic || reel.userAvatar, reel.username);

    const card = document.createElement('div');
    card.className = 'reel-card';
    card.innerHTML = `
        <video class="reel-video" src="${videoUrl}" loop playsinline preload="metadata" muted></video>
        
        <!-- 🔊 Sound Indicator Icon -->
        <div class="sound-indicator" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 50%; color: #fff; cursor: pointer; z-index: 10;">
            <i class="fa-solid fa-volume-xmark sound-icon"></i>
        </div>

        <div class="reel-overlay">
            <div class="user-info-wrapper" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div class="user-info" style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="window.location.href='profile.html?username=${encodeURIComponent(reel.username || '')}'">
                    <img src="${userAvatar}" class="user-avatar" alt="profile" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(reel.username || 'User')}&background=ff1e42&color=fff'">
                    <span class="username" style="font-weight: bold; color: #fff;">@${reel.username || 'user'}</span>
                </div>

                <!-- ➕ FOLLOW BUTTON (സ്വന്തം റീൽ അല്ലങ്കിൽ മാത്രം കാണിക്കും) -->
                ${!isMyReel ? `
                    <button class="follow-btn" data-username="${reel.username}">Follow</button>
                ` : ''}
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
            <button class="action-btn share-btn" title="Share Reel">
                <i class="fa-regular fa-paper-plane"></i>
            </button>

            <!-- 🗑️ Delete Button for own posts -->
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
    const shareBtn = card.querySelector('.share-btn');
    const commentCountSpan = card.querySelector('.comment-count');

    // ➕ FOLLOW BUTTON SETUP
    if (!isMyReel) {
        const followBtn = card.querySelector('.follow-btn');
        setupFollowButton(followBtn, reel.username, reel.userId);
    }

    // 💬 Comment Button Click
    commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCommentModal(reelId, commentCountSpan);
    });

    // 📲 Share Modal Open (Sends Reel to Followed users or Copies link)
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openShareModal(reel, reelId, videoUrl);
    });

    // 🔊 Mute / Unmute Toggle
    const toggleSound = () => {
        if (video.muted) {
            video.muted = false;
            soundIcon.className = "fa-solid fa-volume-high sound-icon";
        } else {
            video.muted = true;
            soundIcon.className = "fa-solid fa-volume-xmark sound-icon";
        }
    };

    soundIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSound();
    });

    // 🎥 Tap Screen Logic
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons') && !e.target.closest('.sound-indicator') && !e.target.closest('.user-info-wrapper')) {
            if (video.muted) {
                toggleSound();
            } else if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    });

    // 🗑️ Delete Reel
    if (isMyReel) {
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            e.preventDefault();

            if (confirm("Are you sure you want to delete this reel?")) {
                try {
                    await deleteDoc(doc(db, "posts", reelId));
                    card.remove(); 
                    alert("Reel deleted! 🗑️");
                } catch (error) {
                    console.error("Delete Error:", error);
                    alert("Failed to delete reel!");
                }
            }
        });
    }

    // ❤️ Like Logic
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

// 🤝 FOLLOW / UNFOLLOW SYSTEM
async function setupFollowButton(followBtn, targetUsername, targetUserId) {
    if (!followBtn || !currentUser.username) return;

    let myFollowing = currentUser.following || [];
    let isFollowing = myFollowing.includes(targetUsername);

    function updateFollowUI() {
        if (isFollowing) {
            followBtn.innerText = "Following";
            followBtn.style.background = "rgba(255, 255, 255, 0.2)";
            followBtn.style.border = "1px solid transparent";
        } else {
            followBtn.innerText = "Follow";
            followBtn.style.background = "transparent";
            followBtn.style.border = "1px solid rgba(255, 255, 255, 0.6)";
        }
    }

    updateFollowUI();

    followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (!currentUser.uid) {
            alert("Please log in to follow creators!");
            return;
        }

        followBtn.style.pointerEvents = "none";

        try {
            const myDocRef = doc(db, "users", currentUser.uid);

            if (!isFollowing) {
                isFollowing = true;
                myFollowing.push(targetUsername);
                updateFollowUI();

                await updateDoc(myDocRef, {
                    following: arrayUnion(targetUsername)
                });

                if (targetUserId) {
                    await updateDoc(doc(db, "users", targetUserId), {
                        followers: arrayUnion(currentUser.username)
                    });
                }
            } else {
                isFollowing = false;
                myFollowing = myFollowing.filter(u => u !== targetUsername);
                updateFollowUI();

                await updateDoc(myDocRef, {
                    following: arrayRemove(targetUsername)
                });

                if (targetUserId) {
                    await updateDoc(doc(db, "users", targetUserId), {
                        followers: arrayRemove(currentUser.username)
                    });
                }
            }

            currentUser.following = myFollowing;
            localStorage.setItem("infinity_user", JSON.stringify(currentUser));

        } catch (error) {
            console.error("Follow error:", error);
            isFollowing = !isFollowing;
            updateFollowUI();
        } finally {
            followBtn.style.pointerEvents = "auto";
        }
    });
}

// 🚀 SHARE TO FOLLOWED USERS MODAL SYSTEM
async function openShareModal(reel, reelId, videoUrl) {
    let shareModal = document.getElementById('share-modal');
    
    // ഷെയർ മോഡൽ HTML ഇല്ലെങ്കിൽ തനിയെ ഉണ്ടാക്കുന്നു
    if (!shareModal) {
        shareModal = document.createElement('div');
        shareModal.id = 'share-modal';
        shareModal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:none; justify-content:center; align-items:center; z-index:2000; backdrop-filter:blur(5px);";
        
        shareModal.innerHTML = `
            <div style="background:#181818; width:90%; max-width:380px; border-radius:16px; padding:20px; border:1px solid #333; color:#fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="fa-solid fa-paper-plane" style="color:#ff1e42;"></i> Share Reel</h3>
                    <button id="close-share-btn" style="background:none; border:none; color:#888; font-size:1.2rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <p style="font-size:0.85rem; color:#aaa; margin-bottom:12px;">Send directly to your followed friends:</p>
                <div id="following-share-list" style="max-height:220px; overflow-y:auto; margin-bottom:15px; display:flex; flex-direction:column; gap:10px;">
                    <p style="text-align:center; color:#666;">Loading friends list...</p>
                </div>
                <button id="copy-link-btn" style="width:100%; background:#262626; border:1px solid #444; color:#fff; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;">
                    <i class="fa-regular fa-copy"></i> Copy Reel Link
                </button>
            </div>
        `;
        document.body.appendChild(shareModal);

        document.getElementById('close-share-btn').onclick = () => shareModal.style.display = 'none';
    }

    const followingListContainer = document.getElementById('following-share-list');
    const copyLinkBtn = document.getElementById('copy-link-btn');

    shareModal.style.display = 'flex';

    // ലിങ്ക് കോപ്പി ലോജിക്
    copyLinkBtn.onclick = async () => {
        const reelShareUrl = `${window.location.origin}/reels.html?id=${reelId}`;
        try {
            await navigator.clipboard.writeText(reelShareUrl);
            alert("Reel link copied! 📋");
            shareModal.style.display = 'none';
        } catch (e) {
            alert("Could not copy link.");
        }
    };

    // ഫോളോ ചെയ്യുന്ന ആൾക്കാരുടെ ലിസ്റ്റ് ഫയർബേസിൽ നിന്ന് എടുക്കുന്നു
    const myFollowing = currentUser.following || [];
    followingListContainer.innerHTML = '';

    if (myFollowing.length === 0) {
        followingListContainer.innerHTML = `<p style="text-align:center; color:#888; font-size:0.85rem;">You are not following anyone yet.</p>`;
        return;
    }

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "in", myFollowing.slice(0, 10))); // max 10 batch query
        const querySnap = await getDocs(q);

        querySnap.forEach((userDoc) => {
            const friendData = userDoc.data();
            const friendUid = userDoc.id;
            const friendAvatar = getUserAvatar(friendData.profilePic || friendData.avatar, friendData.username);

            const friendItem = document.createElement('div');
            friendItem.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:#222; border-radius:10px; cursor:pointer;";
            friendItem.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${friendAvatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                    <span style="font-size:0.9rem; font-weight:600;">@${friendData.username}</span>
                </div>
                <button class="send-to-chat-btn" style="background:#ff1e42; border:none; color:#fff; padding:6px 12px; border-radius:6px; font-size:0.8rem; font-weight:bold; cursor:pointer;">Send</button>
            `;

            // ഡയറക്ട് ചാറ്റിലേക്ക് റീൽ ഷെയർ ചെയ്യൽ
            friendItem.querySelector('.send-to-chat-btn').onclick = async (e) => {
                e.stopPropagation();
                const sendBtn = e.target;
                sendBtn.innerText = "Sending...";
                sendBtn.disabled = true;

                try {
                    const targetUid = friendUid;
                    const roomId = currentUser.uid < targetUid ? `${currentUser.uid}_${targetUid}` : `${targetUid}_${currentUser.uid}`;
                    const messagesRef = collection(db, "chatRooms", roomId, "messages");

                    await addDoc(messagesRef, {
                        type: "reel",
                        text: videoUrl,
                        reelUrl: videoUrl,
                        reelId: reelId,
                        caption: reel.caption || "Shared a reel",
                        sender: currentUser.uid,
                        createdAt: serverTimestamp()
                    });

                    sendBtn.innerText = "Sent!";
                    sendBtn.style.background = "#28a745";
                    setTimeout(() => { shareModal.style.display = 'none'; }, 800);

                } catch (err) {
                    console.error("Send reel error:", err);
                    alert("Failed to send reel to chat.");
                    sendBtn.innerText = "Send";
                    sendBtn.disabled = false;
                }
            };

            followingListContainer.appendChild(friendItem);
        });

    } catch (err) {
        console.error("Error fetching friends list:", err);
        followingListContainer.innerHTML = `<p style="text-align:center; color:#ff4d4d; font-size:0.85rem;">Failed to load friends.</p>`;
    }
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
            const avatar = getUserAvatar(comment.profilePic || comment.userAvatar, comment.username);

            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <img src="${avatar}" class="comment-avatar" alt="avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || 'User')}&background=ff1e42&color=fff'">
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

// 6. Close Comment Modal
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
            const myAvatar = getUserAvatar(currentUser.profilePic || currentUser.avatar, currentUser.username);
            
            await addDoc(commentsRef, {
                text: text,
                username: currentUser.username,
                userAvatar: myAvatar,
                profilePic: myAvatar,
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
