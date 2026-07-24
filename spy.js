// ==========================================
// 👁️ SPY SYSTEM CORE (Global Background Engine)
// ==========================================

class SpyEngine {
    constructor() {
        // എല്ലാ പേജുകളും തമ്മിൽ സന്ദേശങ്ങൾ അയക്കാനുള്ള ചാനൽ
        this.channel = new BroadcastChannel('spy_global_channel');
        this.currentUser = null;
        this.init();
    }

    init() {
        // 1. പേജുകൾ തമ്മിലുള്ള സന്ദേശങ്ങൾ കേൾക്കാൻ ലിസണർ
        this.channel.onmessage = (event) => this.handleGlobalMessages(event.data);

        // 2. ആപ്പിലേക്ക് കടക്കുമ്പോൾ തന്നെ സെഷൻ പരിശോധിക്കുന്നു (Offline / Fast Local Check)
        this.checkLocalSession();

        // 3. Firebase ഓതന്റിക്കേഷൻ പശ്ചാത്തലത്തിൽ പരിശോധിക്കുന്നു
        this.startFirebaseSpying();
    }

    // 🚀 A. ലോക്കൽ സ്റ്റോറേജ് വഴി അതിവേഗ പരിശോധന (Millisecond Execution)
    checkLocalSession() {
        const cachedUser = localStorage.getItem('spy_active_user');
        if (cachedUser) {
            this.currentUser = JSON.parse(cachedUser);
            // ബാക്കി പേജുകളെ യൂസർ വിവരങ്ങൾ അറിയിക്കുന്നു
            this.notifyAllPages('USER_ACTIVE', this.currentUser);
        }
    }

    // 🚀 B. ഫയർബേസ് വഴി പശ്ചാത്തലത്തിൽ സെഷൻ ഉറപ്പ് വരുത്തുന്നു
    startFirebaseSpying() {
        if (typeof auth === 'undefined') return;

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const uid = user.uid;
                const email = user.email;

                // Firestore 'users' കളക്ഷൻ പരിശോധിക്കുന്നു
                try {
                    const userRef = doc(db, "users", uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        
                        // യൂസർ വിവരങ്ങൾ ക്രമീകരിക്കുന്നു
                        const spyUserData = {
                            uid: uid,
                            email: email,
                            username: userData.username || user.displayName || 'unknown',
                            isVerified: userData.isVerified || false,
                            isSpyMode: userData.isSpyMode || false,
                            lastSeen: Date.now()
                        };

                        // LocalStorage അപ്‌ഡേറ്റ് ചെയ്യുന്നു
                        localStorage.setItem('spy_active_user', JSON.stringify(spyUserData));
                        this.currentUser = spyUserData;

                        // എല്ലാ പേജുകളിലേക്കും യൂസർ വിവരങ്ങൾ തത്സമയം സന്ദേശമായി അയക്കുന്നു
                        this.notifyAllPages('USER_VERIFIED', spyUserData);

                    } else {
                        // 'users' കളക്ഷനിൽ ഇല്ലെങ്കിൽ പുറത്താക്കുന്നു (Redirect to Index)
                        this.forceLogoutAndRedirect();
                    }
                } catch (error) {
                    console.error("Spy system validation error:", error);
                }
            } else {
                // ലോഗിൻ ചെയ്തിട്ടില്ലെങ്കിൽ (സെഷൻ ഇല്ലാത്ത അവസ്ഥയിൽ)
                const isPublicPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('login.html');
                if (!isPublicPage && !localStorage.getItem('spy_active_user')) {
                    this.forceLogoutAndRedirect();
                }
            }
        });
    }

    // 🚀 C. മറ്റു പേജുകളിലേക്ക് സന്ദേശം അയക്കാൻ (Broadcast)
    notifyAllPages(type, payload) {
        this.channel.postMessage({
            type: type,
            payload: payload,
            senderPage: window.location.pathname
        });
    }

    // 🚀 D. മറ്റു പേജുകളിൽ നിന്നുള്ള സന്ദേശങ്ങൾ സ്വീകരിക്കാൻ
    handleGlobalMessages(data) {
        switch (data.type) {
            case 'USER_LOGOUT':
            case 'CLEAR_DATA':
                this.clearSystemData();
                break;
            case 'USER_VERIFIED':
                // മറ്റു പേജുകൾ യൂസറുടെ അസൽ വിവരങ്ങൾ സ്വീകരിക്കുന്നു
                if (window.onSpyUserUpdate) {
                    window.onSpyUserUpdate(data.payload);
                }
                break;
        }
    }

    // 🚀 E. ഡാറ്റ ക്ലിയർ ചെയ്യലും ലോഗൗട്ടും (Clear Data & Reset)
    clearSystemData() {
        localStorage.removeItem('spy_active_user');
        localStorage.removeItem('infinity_username');
        sessionStorage.clear();
        this.notifyAllPages('DATA_CLEARED', null);
        window.location.href = 'index.html';
    }

    forceLogoutAndRedirect() {
        localStorage.removeItem('spy_active_user');
        if (!window.location.pathname.endsWith('index.html')) {
            window.location.href = 'index.html';
        }
    }

    // 💡 ഭാവിയിൽ കൂടുതൽ ഓപ്ഷനുകൾ കൂട്ടിച്ചേർക്കാനുള്ള എക്സ്റ്റൻഷൻ പോയിന്റ് (Modular Options)
    addOption(optionName, callback) {
        this[optionName] = callback;
    }
}

// Global Spy Instance നിർമ്മിക്കുന്നു
const Spy = new SpyEngine();
