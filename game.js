import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
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

// Open License Sound Effects
const winSound = new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3");
const loseSound = new Audio("https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3");
const clickSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");

// 🔹 1. ലോഗിൻ ചെയ്ത യഥാർത്ഥ യൂസറുടെ UID എടുക്കുന്നു (Fix for USER_xxxx)
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

// 🔹 2. TOP PLAYER REALTIME UPDATE (Name Fix)
function loadTopPlayer() {
    const q = query(collection(db, "users"), orderBy("wins", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        const banner = document.getElementById("top-player-banner");
        if (banner) {
            if (!snapshot.empty) {
                const topUser = snapshot.docs[0].data();
                // username അല്ലെങ്കിൽ name അല്ലെങ്കിൽ displayName ഫയർബേസിൽ നിന്ന് എടുക്കുന്നു
                const displayName = topUser.username || topUser.name || topUser.displayName || "Anonymous Player";
                const winsCount = topUser.wins || 0;
                
                banner.innerHTML = `👑 Top Player: <b>${displayName}</b> (${winsCount} Wins)`;
            } else {
                banner.innerHTML = "👑 Top Player: No Leaders Yet";
            }
        }
    });
}
loadTopPlayer();

// 🔹 3. AUTOMATIC MATCHMAKING
async function startMatchmaking() {
    if (!currentUserId) {
        alert("Please login first!");
        return;
    }

    document.getElementById("board").style.display = "none";
    document.getElementById("emoji-bar").style.display = "none";
    document.getElementById("status").innerText = "Searching for opponent...";
    document.getElementById("find-btn").style.display = "none";

    boardState = ["", "", "", "", "", "", "", "", ""];
    mySymbol = "";
    isMyTurn = false;
    updateUI();

    const waitingQueueRef = doc(db, "matchmaking", "queue");

    try {
        await runTransaction(db, async (transaction) => {
            const queueSnap = await transaction.get(waitingQueueRef);

            if (queueSnap.exists() && queueSnap.data().waitingPlayer) {
                const waitingData = queueSnap.data();

                if (waitingData.waitingPlayer !== currentUserId) {
                    roomId = waitingData.roomId;
                    mySymbol = "O";
                    isMyTurn = false;

                    const roomRef = doc(db, "game_rooms", roomId);

                    transaction.delete(waitingQueueRef);
                    transaction.update(roomRef, {
                        player2: currentUserId,
                        status: "playing"
                    });

                    return;
                }
            }

            roomId = "room_" + Math.floor(Math.random() * 100000);
            mySymbol = "X";
            isMyTurn = true;

            const roomRef = doc(db, "game_rooms", roomId);

            transaction.set(roomRef, {
                player1: currentUserId,
                player2: null,
                board: ["", "", "", "", "", "", "", "", ""],
                turn: "X",
                status: "waiting"
            });

            transaction.set(waitingQueueRef, {
                waitingPlayer: currentUserId,
                roomId: roomId
            });
        });

        if (mySymbol === "X") {
            document.getElementById("status").innerText = "Waiting for an opponent...";
        }
        
        setupRoom(roomId);

    } catch (error) {
        console.error("Matchmaking Error: ", error);
        document.getElementById("status").innerText = "Connection Error! Retrying...";
        setTimeout(startMatchmaking, 3000);
    }
}

const findBtn = document.getElementById("find-btn");
if (findBtn) {
    findBtn.addEventListener("click", startMatchmaking);
}

// 🔹 4. GAME ROOM & OPPONENT USERNAME FETCH (Fix for Opponent Name)
function setupRoom(rId) {
    if (roomUnsubscribe) roomUnsubscribe();

    const roomRef = doc(db, "game_rooms", rId);

    roomUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();

            if (data.status === "playing") {
                document.getElementById("board").style.display = "grid";
                document.getElementById("emoji-bar").style.display = "flex";

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
            }

            if (data.lastEmoji && data.emojiTime > lastEmojiTimestamp) {
                lastEmojiTimestamp = data.emojiTime;
                showFloatingEmoji(data.lastEmoji);
            }
        }
    });
}

// 🔹 5. UI UPDATE
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

// 🔹 6. EMOJI SENDING
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

    setTimeout(() => {
        el.remove();
    }, 2000);
}

// 🔹 7. WINNER CHECK & SCORE UPDATE
async function checkWinner() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    let hasWinner = false;

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            hasWinner = true;
            if (boardState[a] === mySymbol) {
                winSound.play();
                showResultBanner("🎉 YOU WON! Finding next opponent in 4s...", "green");
                await updateUserWins();
            } else {
                loseSound.play();
                showResultBanner("❌ YOU LOST! Finding next opponent in 4s...", "red");
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

function showResultBanner(msg, color) {
    const statusEl = document.getElementById("status");
    statusEl.innerText = msg;
    statusEl.style.color = color;
}

async function updateUserWins() {
    if (!currentUserId) return;
    try {
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, {
            wins: increment(1)
        });
    } catch (e) {
        console.error("Error updating score: ", e);
    }
}
