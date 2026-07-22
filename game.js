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

// രണ്ട് ഫോണിലും വ്യത്യസ്ത UID ഉണ്ടാകാൻ LocalStorage ഉറപ്പാക്കുന്നു
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

// 2. 🔍 MULTI-PLAYER ATOMIC MATCHMAKING SYSTEM
document.getElementById("find-btn").addEventListener("click", async () => {
    document.getElementById("status").innerText = "Searching for opponent...";
    document.getElementById("find-btn").style.display = "none";

    const waitingQueueRef = doc(db, "matchmaking", "queue");

    try {
        await runTransaction(db, async (transaction) => {
            const queueSnap = await transaction.get(waitingQueueRef);

            // ക്യൂവിൽ ആരെങ്കിലും വെയ്റ്റ് ചെയ്യുന്നുണ്ടോ എന്ന് പരിശോധിക്കുന്നു
            if (queueSnap.exists() && queueSnap.data().waitingPlayer) {
                const waitingData = queueSnap.data();

                // താൻ തന്നെയാണോ വെയ്റ്റ് ചെയ്യുന്നത് എന്ന് നോക്കുന്നു
                if (waitingData.waitingPlayer !== currentUserId) {
                    roomId = waitingData.roomId;
                    mySymbol = "O"; // രണ്ടാമത് കയറിയ ആൾക്ക് 'O'
                    isMyTurn = false;

                    const roomRef = doc(db, "game_rooms", roomId);

                    // ക്യൂവിൽ നിന്ന് വെയ്റ്റിംഗ് പ്ലെയറെ ഒഴിവാക്കുന്നു (റൂം ഇവിടെ ലോക്ക് ആയി)
                    transaction.delete(waitingQueueRef);

                    // ഗെയിം റൂം ഫുൾ ആക്കുന്നു
                    transaction.update(roomRef, {
                        player2: currentUserId,
                        status: "playing"
                    });

                    return;
                }
            }

            // ആരും വെയ്റ്റിംഗ് ഇല്ലെങ്കിൽ പുതിയ റൂം ക്രിയേറ്റ് ചെയ്തു വെയിറ്റ് ചെയ്യുന്നു
            roomId = "room_" + Math.floor(Math.random() * 100000);
            mySymbol = "X"; // ആദ്യത്തെ ആൾക്ക് 'X'
            isMyTurn = true;

            const roomRef = doc(db, "game_rooms", roomId);

            // പുതിയ റൂം ഉണ്ടാക്കുന്നു
            transaction.set(roomRef, {
                player1: currentUserId,
                player2: null,
                board: ["", "", "", "", "", "", "", "", ""],
                turn: "X",
                status: "waiting"
            });

            // ക്യൂവിലേക്ക് സ്വന്തം ID ആഡ് ചെയ്യുന്നു
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
        console.error("Matchmaking Transaction Failed: ", error);
        document.getElementById("status").innerText = "Connection Error! Try Again.";
        document.getElementById("find-btn").style.display = "block";
    }
});

// 3. 🎲 GAME ROOM & EMOJI LISTENERS
function setupRoom(rId) {
    const roomRef = doc(db, "game_rooms", rId);

    onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();

            // രണ്ടാമത്തെ ആൾ ജോയിൻ ചെയ്യുമ്പോൾ മാത്രം ബോർഡ് ഓപ്പൺ ആകുന്നു
            if (data.status === "playing") {
                document.getElementById("board").style.display = "grid";
                document.getElementById("emoji-bar").style.display = "flex";

                boardState = data.board || boardState;
                updateUI();

                if (data.turn !== mySymbol) {
                    isMyTurn = false;
                    document.getElementById("status").innerText = `Opponent's Turn (${data.turn})...`;
                } else {
                    isMyTurn = true;
                    document.getElementById("status").innerText = `Your Turn (${mySymbol})!`;
                }
            }

            // 🚀 ഓപ്പോണന്റ് അയക്കുന്ന എമോജി കാണാൻ
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

// 5. 😀 EMOJI SENDING FUNCTION
window.sendEmoji = async function(emoji) {
    if (!roomId) return;
    
    const roomRef = doc(db, "game_rooms", roomId);
    await setDoc(roomRef, {
        lastEmoji: emoji,
        emojiTime: Date.now()
    }, { merge: true });
};

// 🎈 EMOJI ANIMATION RENDERER
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

// 6. 🏆 WINNER CHECK & DRAW CHECK LOGIC
async function checkWinner() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontal
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Vertical
        [0, 4, 8], [2, 4, 6]             // Diagonal
    ];

    let hasWinner = false;

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            hasWinner = true;
            if (boardState[a] === mySymbol) {
                alert("🎉 You Won!");
                await updateUserWins();
            } else {
                alert("❌ You Lost!");
            }
            return;
        }
    }

    // സമനില (Draw) പരിശോധിക്കുന്നു
    const isBoardFull = boardState.every(cell => cell !== "");
    if (!hasWinner && isBoardFull) {
        alert("🤝 Game Draw!");
    }
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
