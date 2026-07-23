import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where,
    orderBy, 
    limit, 
    onSnapshot, 
    doc, 
    getDoc,
    setDoc, 
    updateDoc, 
    deleteDoc,
    increment,
    runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const winSound = new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3");
const loseSound = new Audio("https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3");
const clickSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");

// 🔹 Auth Check
let currentUserId = null;
const localUserData = localStorage.getItem("infinity_user") || localStorage.getItem("user");
if (localUserData) {
    try {
        const parsed = JSON.parse(localUserData);
        currentUserId = parsed.uid || parsed.id;
    } catch (e) {
        currentUserId = localStorage.getItem("userUid");
    }
}
if (!currentUserId) {
    currentUserId = localStorage.getItem("userUid");
}

let roomId = null;
let mySymbol = "";
let isMyTurn = false;
let boardState = ["", "", "", "", "", "", "", "", ""];
let lastEmojiTimestamp = 0;
let roomUnsubscribe = null;
let matchTimer = null;
let myUsername = "Player";

// Get current player username
async function fetchMyUsername() {
    if (!currentUserId) return;
    try {
        const snap = await getDoc(doc(db, "users", currentUserId));
        if (snap.exists()) {
            const data = snap.data();
            myUsername = data.username || data.name || data.displayName || "Player";
        }
    } catch (e) { console.error(e); }
}
fetchMyUsername();

// 🔹 1. LEADERBOARD (At least 6 wins required)
function loadTopPlayer() {
    const q = query(
        collection(db, "users"), 
        where("wins", ">=", 6),
        orderBy("wins", "desc"), 
        limit(1)
    );
    
    onSnapshot(q, (snapshot) => {
        const banner = document.getElementById("top-player-banner");
        if (banner) {
            if (!snapshot.empty) {
                const topUser = snapshot.docs[0].data();
                const displayName = topUser.username || topUser.name || topUser.displayName || "Top Player";
                banner.innerHTML = `👑 Top Leader: <b>${displayName}</b> (${topUser.wins || 0} Wins)`;
            } else {
                banner.innerHTML = "👑 Top Leader: Minimum 6 Wins Needed!";
            }
        }
    }, (error) => {
        console.error("Leaderboard query error: ", error);
    });
}
loadTopPlayer();

// 🔹 2. MATCHMAKING + 10s TIMER
async function startMatchmaking() {
    if (!currentUserId) {
        alert("Please login first!");
        return;
    }

    // Clean old room from DB when finding new match
    if (roomId) {
        try { await deleteDoc(doc(db, "game_rooms", roomId)); } catch(e){}
    }

    resetUI();
    document.getElementById("status").innerText = "Searching for opponent... (10s)";
    
    // 10s Countdown logic
    let timeLeft = 10;
    if (matchTimer) clearInterval(matchTimer);
    
    matchTimer = setInterval(() => {
        timeLeft--;
        const statusEl = document.getElementById("status");
        if (statusEl && statusEl.innerText.includes("Searching")) {
            statusEl.innerText = `Searching for opponent... (${timeLeft}s)`;
        }
        if (timeLeft <= 0) {
            clearInterval(matchTimer);
            alert("No opponent found! Redirecting to Game Page.");
            window.location.href = "game.html"; // Default redirect
        }
    }, 1000);

    boardState = ["", "", "", "", "", "", "", "", ""];
    mySymbol = "";
    isMyTurn = false;

    const waitingQueueRef = doc(db, "matchmaking", "queue");

    try {
        await runTransaction(db, async (transaction) => {
            const queueSnap = await transaction.get(waitingQueueRef);

            if (queueSnap.exists() && queueSnap.data().waitingPlayer) {
                const waitingData = queueSnap.data();

                if (waitingData.waitingPlayer !== currentUserId) {
                    roomId = waitingData.roomId;
                    
                    // Random First Turn Selection
                    const firstTurn = Math.random() < 0.5 ? "X" : "O";
                    mySymbol = "O";
                    isMyTurn = (firstTurn === "O");

                    const roomRef = doc(db, "game_rooms", roomId);

                    transaction.delete(waitingQueueRef);
                    transaction.update(roomRef, {
                        player2: currentUserId,
                        status: "playing",
                        turn: firstTurn
                    });

                    return;
                }
            }

            roomId = "room_" + Math.floor(Math.random() * 100000);
            mySymbol = "X";
            isMyTurn = false; 

            const roomRef = doc(db, "game_rooms", roomId);

            transaction.set(roomRef, {
                player1: currentUserId,
                player2: null,
                board: ["", "", "", "", "", "", "", "", ""],
                turn: "X",
                status: "waiting",
                chats: []
            });

            transaction.set(waitingQueueRef, {
                waitingPlayer: currentUserId,
                roomId: roomId
            });
        });

        setupRoom(roomId);

    } catch (error) {
        console.error("Matchmaking Error: ", error);
        document.getElementById("status").innerText = "Connection Error! Retrying...";
    }
}

document.getElementById("find-btn").addEventListener("click", startMatchmaking);

// 🔹 3. SETUP GAME ROOM & LISTENERS
function setupRoom(rId) {
    if (roomUnsubscribe) roomUnsubscribe();

    const roomRef = doc(db, "game_rooms", rId);

    roomUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();

            if (data.status === "playing") {
                if (matchTimer) clearInterval(matchTimer); // Stop countdown

                document.getElementById("board").style.display = "grid";
                document.getElementById("emoji-bar").style.display = "flex";
                document.getElementById("chat-container").style.display = "block";

                const opponentId = (data.player1 === currentUserId) ? data.player2 : data.player1;
                let opponentName = "Opponent";

                if (opponentId) {
                    const oppSnap = await getDoc(doc(db, "users", opponentId));
                    if (oppSnap.exists()) {
                        const oppData = oppSnap.data();
                        opponentName = oppData.username || oppData.name || oppData.displayName || "Opponent";
                    }
                }

                boardState = data.board || boardState;
                updateUI();

                if (data.turn !== mySymbol) {
                    isMyTurn = false;
                    document.getElementById("status").innerText = `${opponentName}'s Turn (${data.turn})...`;
                } else {
                    isMyTurn = true;
                    document.getElementById("status").innerText = `Your Turn (${mySymbol}) vs ${opponentName}!`;
                }

                // Render Chats
                renderChats(data.chats || []);
            }

            if (data.lastEmoji && data.emojiTime > lastEmojiTimestamp) {
                lastEmojiTimestamp = data.emojiTime;
                showFloatingEmoji(data.lastEmoji);
            }
        }
    });
}

// 🔹 4. BOARD CLICK & MOVES
document.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("click", async (e) => {
        const index = e.target.getAttribute("data-index");

        if (isMyTurn && boardState[index] === "") {
            clickSound.play();
            boardState[index] = mySymbol;
            isMyTurn = false;

            const roomRef = doc(db, "game_rooms", roomId);
            await setDoc(roomRef, {
                board: boardState,
                turn: mySymbol === "X" ? "O" : "X"
            }, { merge: true });

            checkWinner();
        }
    });
});

function updateUI() {
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell, index) => {
        cell.innerText = boardState[index];
        if (boardState[index] !== "") {
            cell.classList.add("disabled");
        } else {
            cell.classList.remove("disabled");
        }
    });
}

// 🔹 5. WINNING LINE & WIN CHECK LOGIC
async function checkWinner() {
    const winPatterns = [
        { pattern: [0, 1, 2], type: "h", index: 0 },
        { pattern: [3, 4, 5], type: "h", index: 1 },
        { pattern: [6, 7, 8], type: "h", index: 2 },
        { pattern: [0, 3, 6], type: "v", index: 0 },
        { pattern: [1, 4, 7], type: "v", index: 1 },
        { pattern: [2, 5, 8], type: "v", index: 2 },
        { pattern: [0, 4, 8], type: "d", index: 0 },
        { pattern: [2, 4, 6], type: "d", index: 1 }
    ];

    let hasWinner = false;

    for (let item of winPatterns) {
        const [a, b, c] = item.pattern;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            hasWinner = true;
            drawWinningLine(item.type, item.index);

            if (boardState[a] === mySymbol) {
                winSound.play();
                showResultBanner("🎉 YOU WON! Finding next opponent in 4s...", "#00ff66");
                await updateUserStats(true);
            } else {
                loseSound.play();
                showResultBanner("❌ YOU LOST! Finding next opponent in 4s...", "#ff5252");
                await updateUserStats(false);
            }

            setTimeout(() => {
                startMatchmaking();
            }, 4000);

            return;
        }
    }

    const isBoardFull = boardState.every(cell => cell !== "");
    if (!hasWinner && isBoardFull) {
        showResultBanner("🤝 DRAW! Finding next opponent in 4s...", "orange");
        setTimeout(() => {
            startMatchmaking();
        }, 4000);
    }
}

function drawWinningLine(type, index) {
    const line = document.getElementById("winning-line");
    line.style.display = "block";

    if (type === "h") {
        line.style.width = "260px";
        line.style.height = "6px";
        line.style.left = "5px";
        line.style.top = `${40 + index * 93}px`;
        line.style.transform = "none";
    } else if (type === "v") {
        line.style.width = "6px";
        line.style.height = "260px";
        line.style.top = "5px";
        line.style.left = `${40 + index * 93}px`;
        line.style.transform = "none";
    } else if (type === "d") {
        line.style.width = "350px";
        line.style.height = "6px";
        line.style.top = "130px";
        line.style.left = "-40px";
        line.style.transform = index === 0 ? "rotate(45deg)" : "rotate(-45deg)";
    }
}

function showResultBanner(msg, color) {
    const statusEl = document.getElementById("status");
    statusEl.innerText = msg;
    statusEl.style.color = color;
}

// 🔹 6. ACCURATE WIN & LOSS STATS UPDATE
async function updateUserStats(isWin) {
    if (!currentUserId) return;
    try {
        const userRef = doc(db, "users", currentUserId);
        if (isWin) {
            await updateDoc(userRef, { wins: increment(1) });
        } else {
            await updateDoc(userRef, { losses: increment(1) });
        }
    } catch (e) {
        console.error("Error updating stats: ", e);
    }
}

// 🔹 7. CHAT LOGIC (Auto Delete Old Messages > 5)
document.getElementById("send-chat-btn").addEventListener("click", sendChatMessage);

async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text || !roomId) return;

    input.value = "";
    const roomRef = doc(db, "game_rooms", roomId);

    try {
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            let chats = roomSnap.data().chats || [];
            chats.push({ sender: myUsername, text: text });

            // 5 കവിഞ്ഞാൽ ആദ്യത്തെ സന്ദേശം താനേ ഡിലീറ്റ് ആകും (Maximum 5 items maintained)
            if (chats.length > 5) {
                chats.shift();
            }

            await updateDoc(roomRef, { chats: chats });
        }
    } catch (e) {
        console.error("Chat error:", e);
    }
}

function renderChats(chats) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    chats.forEach(c => {
        const div = document.createElement("div");
        div.className = "chat-msg";
        div.innerHTML = `<b>${c.sender}:</b> ${c.text}`;
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 🔹 8. LIVE EMOJI SUPPORT
window.sendEmoji = async function(emoji) {
    if (!roomId) return;
    const roomRef = doc(db, "game_rooms", roomId);
    await setDoc(roomRef, {
        lastEmoji: emoji,
        emojiTime: Date.now()
    }, { merge: true });
};

function showFloatingEmoji(emoji) {
    const el = document.createElement("div");
    el.className = "floating-emoji";
    el.innerText = emoji;
    const randomX = Math.floor(Math.random() * (window.innerWidth - 60));
    el.style.left = `${randomX}px`;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 2000);
}

function resetUI() {
    document.getElementById("board").style.display = "none";
    document.getElementById("emoji-bar").style.display = "none";
    document.getElementById("chat-container").style.display = "none";
    document.getElementById("winning-line").style.display = "none";
    document.getElementById("find-btn").style.display = "inline-block";
}
