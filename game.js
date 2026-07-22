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

const currentUserId = localStorage.getItem("userUid") || "USER_" + Math.floor(Math.random() * 1000);

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

// 2. 🔍 MATCHMAKING LOGIC (Clash ഹാൻഡിൽ ചെയ്തു അപ്ഡേറ്റ് ചെയ്തത്)
document.getElementById("find-btn").addEventListener("click", async () => {
    document.getElementById("status").innerText = "Searching for opponent...";
    document.getElementById("find-btn").style.display = "none";

    roomId = "room_demo_123"; 
    const roomRef = doc(db, "game_rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    // റൂമിൽ നേരത്തെ കളിക്കാരൻ ഉണ്ടോ എന്ന് പരിശോധിക്കുന്നു
    if (!roomSnap.exists() || !roomSnap.data().player1) {
        // Player 1 -> X ആയിരിക്കും
        mySymbol = "X";
        isMyTurn = true;

        await setDoc(roomRef, {
            player1: currentUserId,
            player2: null,
            board: ["", "", "", "", "", "", "", "", ""],
            turn: "X"
        });
        document.getElementById("status").innerText = "Waiting for Player 2...";
    } else if (!roomSnap.data().player2 && roomSnap.data().player1 !== currentUserId) {
        // Player 2 -> O ആയിരിക്കും
        mySymbol = "O";
        isMyTurn = false;

        await updateDoc(roomRef, {
            player2: currentUserId
        });
    } else {
        // പഴയ റൂം റീസെറ്റ് ചെയ്ത് പുതിയ കളി തുടങ്ങുന്നു
        mySymbol = "X";
        isMyTurn = true;
        await setDoc(roomRef, {
            player1: currentUserId,
            player2: null,
            board: ["", "", "", "", "", "", "", "", ""],
            turn: "X"
        });
    }

    setupRoom(roomId);
});

// 3. 🎲 GAME ROOM & EMOJI LISTENERS
function setupRoom(rId) {
    document.getElementById("board").style.display = "grid";
    document.getElementById("emoji-bar").style.display = "flex";

    const roomRef = doc(db, "game_rooms", rId);

    onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            boardState = data.board || boardState;
            updateUI();
            
            if (data.turn !== mySymbol) {
                isMyTurn = false;
                document.getElementById("status").innerText = `Opponent's Turn (${data.turn})...`;
            } else {
                isMyTurn = true;
                document.getElementById("status").innerText = `Your Turn (${mySymbol})!`;
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
