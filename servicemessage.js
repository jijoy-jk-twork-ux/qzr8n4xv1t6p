importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCNQaHi-L3fninLxkePZBaNR7vu6JiYEwQ",
    authDomain: "infinityspotx.firebaseapp.com",
    projectId: "infinityspotx",
    storageBucket: "infinityspotx.firebasestorage.app",
    messagingSenderId: "400346792298",
    appId: "1:400346792298:web:5fd101c225a547902b6513"
};

const messaging = firebase.messaging();

// ബാക്ക്ഗ്രൗണ്ടിൽ നോട്ടിഫിക്കേഷൻ കാണിക്കാൻ
messaging.onBackgroundMessage((payload) => {
  console.log('Notification received in background: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Infinity.png' // ആപ്പിന്റെ ലോഗോ
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
