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

// Open License Sound Effects (Royalty Free)
const winSound = new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3");
const loseSound = new Audio("https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3");
const clickSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");

let currentUserId = localStorage.getItem("userUid");
if (!currentUserId) {
    currentUserId = "USER_" + Math.floor(Math.random() * 10000);
    localStorage.setItem("userUid", currentUserId);
}

let roomId = null;
let mySymbol = "";
let isMyTurn = false;
let boardState = ["", "", "", "", "", "", "", "", ""];
let lastEmojiTimestamp = 0;
let roomUnsubscribe = null;

// 1. 🏆 TOP PLAYER REALTIME UPDATE
function loadTopPlayer() {
    const q = query(collection(db, "users"), orderBy("wins", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        const banner = document.getElementById("top-player-banner");
        if (banner) {
            if (!snapshot.empty) {
                const topUser = snapshot.docs[0].data();
                banner.innerHTML = `👑 Top Player: <b>${topUser.username || "Unknown"}</b> (${topUser.wins || 0} Wins)`;
            } else {
                banner.innerHTML = "👑 Top Player: No Leaders Yet";
            }
        }
    });
}
loadTopPlayer();

// 2. 🔍 AUTOMATIC MATCHMAKING FUNCTION
async function startMatchmaking() {
    // UI റിസെറ്റ് ചെയ്യൽ
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

document.getElementById("find-btn").addEventListener("click", startMatchmaking);

// 3. 🎲 GAME ROOM & OPPONENT USERNAME FETCH
function setupRoom(rId) {
    if (roomUnsubscribe) roomUnsubscribe();

    const roomRef = doc(db, "game_rooms", rId);

    roomUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();

            if (data.status === "playing") {
                document.getElementById("board").style.display = "grid";
                document.getElementById("emoji-bar").style.display = "flex";

                // ഓപ്പോണന്റിന്റെ ID എടുത്ത് പേര് കണ്ടെത്തുന്നു
                const opponentId = (data.player1 === currentUserId) ? data.player2 : data.player1;
                let opponentName = "Opponent";

                if (opponentId) {
                    const oppSnap = await getDoc(doc(db, "users", opponentId));
                    if (oppSnap.exists()) {
                        opponentName = oppSnap.data().username || "Opponent";
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

// 4. UI UPDATE
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

// 5. 😀 EMOJI SENDING
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

// 6. 🏆 WINNER CHECK, SOUND & AUTOMATIC AUTO-REDIRECT (4 Sec)
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

            // 4 സെക്കന്റുകൾക്ക് ശേഷം തനിയെ അടുത്ത പ്ലെയറെ തിരയാൻ പോകുന്നു
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
    try {
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, {
            wins: increment(1)
        });
    } catch (e) {
        console.error("Error updating score: ", e);
    }
}
