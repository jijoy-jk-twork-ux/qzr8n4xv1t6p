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
    increment 
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
        if (!snapshot.empty) {
            const topUser = snapshot.docs[0].data();
            banner.innerHTML = `👑 Top Player: <b>${topUser.username || "Unknown"}</b> (${topUser.wins || 0} Wins)`;
        } else {
            banner.innerHTML = "👑 Top Player: No Leaders Yet";
        }
    });
}
loadTopPlayer();

// 2. 🔍 REALTIME DYNAMIC MATCHMAKING SYSTEM
document.getElementById("find-btn").addEventListener("click", async () => {
    document.getElementById("status").innerText = "Searching for opponent...";
    document.getElementById("find-btn").style.display = "none";

    const waitingQueueRef = doc(db, "matchmaking", "queue");
    const queueSnap = await getDoc(waitingQueueRef);

    if (queueSnap.exists() && queueSnap.data().waitingPlayer && queueSnap.data().waitingPlayer !== currentUserId) {
        // ആരെങ്കിലും വെയിറ്റ് ചെയ്യുന്നുണ്ടെങ്കിൽ, അവരുടെ റൂമിലേക്ക് ജോയിൻ ചെയ്യുന്നു (Player 2 - 'O')
        const waitingData = queueSnap.data();
        roomId = waitingData.roomId;
        mySymbol = "O";
        isMyTurn = false;

        // Queue ക്ലിയർ ചെയ്ത് ഗെയിം സ്റ്റാർട്ട് ചെയ്യുന്നു
        await deleteDoc(waitingQueueRef);

        const roomRef = doc(db, "game_rooms", roomId);
        await updateDoc(roomRef, {
            player2: currentUserId,
            status: "playing"
        });

        setupRoom(roomId);
    } else {
        // ആരും വെയിറ്റ് ചെയ്യുന്നില്ലെങ്കിൽ, പുതിയ ഒരു റൂം ഉണ്ടാക്കി വെയിറ്റ് ചെയ്യുന്നു (Player 1 - 'X')
        roomId = "room_" + Math.floor(Math.random() * 100000);
        mySymbol = "X";
        isMyTurn = true;

        const roomRef = doc(db, "game_rooms", roomId);
        await setDoc(roomRef, {
            player1: currentUserId,
            player2: null,
            board: ["", "", "", "", "", "", "", "", ""],
            turn: "X",
            status: "waiting"
        });

        // Queue-ൽ താൻ വെയിറ്റിംഗ് ആണെന്ന് ഇടുന്നു
        await setDoc(waitingQueueRef, {
            waitingPlayer: currentUserId,
            roomId: roomId
        });

        document.getElementById("status").innerText = "Waiting for an opponent to join...";
        setupRoom(roomId);
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

// 6. 🏆 WINNER CHECK & SCORE INCREMENT
async function checkWinner() {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            if (boardState[a] === mySymbol) {
                alert("🎉 You Won!");
                await updateUserWins();
            } else {
                alert("❌ You Lost!");
            }
            return;
        }
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
