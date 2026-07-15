import { onSnapshot, collection, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function listenToPosts() {
    const feedContainer = document.querySelector('.feed-container');
    if (!feedContainer) return;

    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    // onSnapshot ഉപയോഗിക്കുന്നു (ഇത് ഡാറ്റ മാറുമ്പോൾ തനിയെ അപ്ഡേറ്റ് ആകും)
    onSnapshot(postsQuery, (querySnapshot) => {
        feedContainer.innerHTML = ""; // പഴയ ലിസ്റ്റ് കളയുന്നു

        if (querySnapshot.empty) {
            feedContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>പോസ്റ്റുകൾ ഒന്നും ലഭ്യമല്ല!</p>";
            return;
        }

        querySnapshot.forEach((documentSnapshot) => {
            const postData = documentSnapshot.data();
            const postId = documentSnapshot.id;
            
            // ... ബാക്കി HTML കോഡ് നീ മുമ്പ് എഴുതിയതുപോലെ തന്നെ കൊടുക്കുക
            // (deleteIconHtml-ഉം മറ്റും ഇവിടെ വരണം)
            
            // postElement ക്രിയേറ്റ് ചെയ്ത് append ചെയ്യുന്നത് ഇവിടെ തുടരുക...
        });
    });
}

// ആപ്പ് ലോഡ് ആകുമ്പോൾ ഇത് വിളിക്കുക
listenToPosts();

