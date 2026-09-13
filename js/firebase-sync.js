/* ==========================================================================
   مصنع الإيمان للمكرونة - محرك المزامنة السحابية وقاعدة البيانات والمصادقة
   Google Firebase Realtime Cloud Sync & Authentication Engine
   Developed by Speed Up Tech 🚀 (https://speed-up.tech/)
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDipjkxYKaZj8VoKNmiWPGKGyQyAmWLEEU",
  authDomain: "makro-el-eman.firebaseapp.com",
  projectId: "makro-el-eman",
  storageBucket: "makro-el-eman.firebasestorage.app",
  messagingSenderId: "967794530562",
  appId: "1:967794530562:web:dd768b87b2628cea7fca1b",
  measurementId: "G-KZRQT92JPF"
};

const FirebaseSync = {
  db: null,
  auth: null,
  isInitialized: false,
  isSyncing: false,
  isCloudOnline: false,
  docRef: null,
  syncTimeout: null,

  // Initialize Firebase Firestore and Authentication
  init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK is not loaded. Working in local storage mode.');
        this.updateSyncBadge('offline');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.firestore();
      if (firebase.auth) {
        this.auth = firebase.auth();
      }
      this.docRef = this.db.collection('makro_db').doc('system_data');
      this.isInitialized = true;

      // Start listening to live cloud updates
      this.listenToCloud();

      // Listen to Auth State Changes
      if (this.auth) {
        this.auth.onAuthStateChanged((user) => {
          this.handleAuthStateChange(user);
        });
      }

      console.log('✅ Firebase Cloud Engine & Auth initialized successfully for makro-el-eman');
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.updateSyncBadge('offline');
    }
  },

  // Monitor Authentication State
  handleAuthStateChange(firebaseUser) {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (!firebaseUser) {
      // User is not signed in
      if (!isLoginPage) {
        // Redirect to login page if session is missing
        const currentSession = localStorage.getItem('eleman_current_user');
        if (!currentSession) {
          window.location.href = 'login.html';
        }
      }
    } else {
      // User is signed in to Firebase Auth
      // Verify profile is synced in App.db.users
      this.ensureUserInDB(firebaseUser);
    }
  },

  // Ensure Firebase Auth user has corresponding profile record in App.db.users
  ensureUserInDB(firebaseUser) {
    if (!firebaseUser || !firebaseUser.email) return;
    const email = firebaseUser.email.toLowerCase();

    if (!App.db) App.db = StorageManager.getDB();
    if (!Array.isArray(App.db.users)) App.db.users = [];

    let existing = App.db.users.find(u => (u.email && u.email.toLowerCase() === email) || (u.username && u.username.toLowerCase() === email.split('@')[0]));

    if (!existing) {
      // If it's the admin user (admin@eleman.com or contains admin)
      const isAdmin = email === 'admin@eleman.com' || email.startsWith('admin');
      const newRecord = {
        id: isAdmin ? 'USR-1' : `USR-${Date.now().toString().slice(-4)}`,
        name: isAdmin ? 'المدير العام' : email.split('@')[0],
        username: email.split('@')[0],
        email: email,
        role: isAdmin ? 'مدير عام' : 'موظف مبيعات',
        status: 'نشط',
        createdAt: new Date().toISOString().slice(0, 10),
        permissions: isAdmin 
          ? ['dashboard', 'sales', 'inventory', 'suppliers', 'customers', 'hr', 'expenses', 'reports', 'users', 'notifications']
          : ['dashboard', 'sales', 'customers']
      };
      App.db.users.push(newRecord);
      this.pushToCloud(true);
      App.setCurrentUser(newRecord);
    } else {
      // Update email on user record if missing
      if (!existing.email) {
        existing.email = email;
        this.pushToCloud(true);
      }
      App.setCurrentUser(existing);
    }
  },

  // Firebase Auth Login
  async loginWithFirebase(email, password) {
    if (!this.auth) {
      throw new Error('محرك المصادقة غير مفعل أو غير متصل بالإنترنت');
    }
    const userCredential = await this.auth.signInWithEmailAndPassword(email.trim(), password);
    const fbUser = userCredential.user;

    // Check status in DB
    const cleanEmail = fbUser.email.toLowerCase();
    const userInDb = (App.db.users || []).find(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.username && u.username.toLowerCase() === cleanEmail.split('@')[0]));

    if (userInDb && userInDb.status === 'معطل') {
      await this.auth.signOut();
      localStorage.removeItem('eleman_current_user');
      throw new Error('عفواً، هذا الحساب معطل من قبل إدارة المصنع. يرجى مراجعة المدير العام.');
    }

    this.ensureUserInDB(fbUser);
    return fbUser;
  },

  // Firebase Auth Logout
  async logoutFromFirebase() {
    try {
      if (this.auth) {
        await this.auth.signOut();
      }
    } catch (e) {
      console.warn('Auth signOut notice:', e);
    }
    localStorage.removeItem('eleman_current_user');
    window.location.href = 'login.html';
  },

  // Change Password for Currently Logged-in Admin / User
  async updateCurrentUserPassword(newPassword) {
    if (!this.auth || !this.auth.currentUser) {
      throw new Error('يجب تسجيل الدخول بحسابك أولاً لتغيير كلمة المرور');
    }
    await this.auth.currentUser.updatePassword(newPassword);

    // Also update in App.db.users
    const userEmail = this.auth.currentUser.email;
    const userInDb = (App.db.users || []).find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
    if (userInDb) {
      userInDb.password = newPassword;
      this.pushToCloud(true);
    }
  },

  // Admin: Create Employee Account in Firebase Auth without logging out current Admin
  async createEmployeeInFirebaseAuth(email, password, userProfile) {
    if (!this.auth) throw new Error('محرك المصادقة غير متاح');
    
    // Create using secondary isolated Firebase app instance
    let secondaryApp;
    try {
      secondaryApp = firebase.app('SecondaryAuthApp');
    } catch (e) {
      secondaryApp = firebase.initializeApp(firebaseConfig, 'SecondaryAuthApp');
    }

    const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email.trim(), password);
    const newUid = userCred.user.uid;
    await secondaryApp.auth().signOut();

    // Attach to App.db.users and push immediately to Firestore
    userProfile.uid = newUid;
    userProfile.email = email.trim();
    if (!App.db.users) App.db.users = [];
    App.db.users.push(userProfile);
    this.pushToCloud(true);

    return userProfile;
  },

  // Admin: Send Official Password Reset Email to Employee
  async sendPasswordResetEmail(email) {
    if (!this.auth) throw new Error('محرك المصادقة غير متصل');
    await this.auth.sendPasswordResetEmail(email.trim());
  },

  // Listen in real-time to any cloud modifications across all devices
  listenToCloud() {
    if (!this.docRef) return;

    this.updateSyncBadge('connecting');

    this.docRef.onSnapshot((doc) => {
      if (doc.exists) {
        const cloudData = doc.data();
        this.isCloudOnline = true;
        this.updateSyncBadge('online');

        // Merge and update local state if cloud data exists
        if (cloudData && typeof cloudData === 'object') {
          const isDifferent = JSON.stringify(cloudData) !== JSON.stringify(App.db);
          if (isDifferent) {
            App.db = cloudData;
            localStorage.setItem('eleman_erp_db', JSON.stringify(App.db));
            this.refreshActivePageUI();
          }
        }
      } else {
        // Document does not exist in cloud yet -> Initial Cloud Seeding
        console.log('⚡ Initializing cloud database with clean schema...');
        this.pushToCloud(true);
      }
    }, (error) => {
      console.warn('Firebase listener disconnected or offline:', error.message);
      this.isCloudOnline = false;
      this.updateSyncBadge('offline');
    });
  },

  // Push local changes to Firestore with debouncing
  pushToCloud(immediate = false) {
    if (!this.isInitialized || !this.docRef) return;

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    const doSync = async () => {
      try {
        this.isSyncing = true;
        this.updateSyncBadge('syncing');

        // Clean deep clone of data
        const payload = JSON.parse(JSON.stringify(App.db));
        // Overwrite full state so additions and deletions sync accurately
        await this.docRef.set(payload);

        this.isSyncing = false;
        this.isCloudOnline = true;
        this.updateSyncBadge('online');
      } catch (err) {
        console.error('Error syncing to Firebase Cloud:', err);
        this.isSyncing = false;
        this.updateSyncBadge('error');
      }
    };

    if (immediate) {
      doSync();
    } else {
      this.syncTimeout = setTimeout(doSync, 500);
    }
  },

  // Auto Refresh tables and components on current active page when cloud updates
  refreshActivePageUI() {
    try {
      if (typeof loadInvoicesTable === 'function') loadInvoicesTable();
      if (typeof loadProductsTable === 'function') loadProductsTable();
      if (typeof loadInventoryTable === 'function') loadInventoryTable();
      if (typeof loadCustomersTable === 'function') loadCustomersTable();
      if (typeof loadSuppliersTable === 'function') loadSuppliersTable();
      if (typeof loadEmployeesTable === 'function') loadEmployeesTable();
      if (typeof loadDailyAttendanceTable === 'function') loadDailyAttendanceTable();
      if (typeof loadExpensesTable === 'function') loadExpensesTable();
      if (typeof loadDeliveryTrucksTable === 'function') loadDeliveryTrucksTable();
      if (typeof loadStocktakingTable === 'function') loadStocktakingTable();
      if (typeof loadUsersTable === 'function') loadUsersTable();
      if (typeof loadNotificationsPage === 'function') loadNotificationsPage();
      if (typeof loadDashboardData === 'function') loadDashboardData();
      if (typeof renderPageSummaryCards === 'function') {
        const path = window.location.pathname;
        if (path.includes('sales')) renderPageSummaryCards('sales', 'sales-summary-cards');
        if (path.includes('inventory')) renderPageSummaryCards('inventory', 'inventory-summary-cards');
        if (path.includes('customers')) renderPageSummaryCards('customers', 'customers-summary-cards');
        if (path.includes('suppliers')) renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
        if (path.includes('hr')) renderPageSummaryCards('hr', 'hr-summary-cards-container');
        if (path.includes('expenses')) renderPageSummaryCards('expenses', 'expenses-summary-cards');
        if (path.includes('reports')) renderPageSummaryCards('reports', 'reports-summary-cards');
        if (path.includes('users')) renderPageSummaryCards('users', 'users-summary-cards');
      }
      if (typeof App !== 'undefined' && typeof App.updateNotificationBadge === 'function') {
        App.updateNotificationBadge();
      }
    } catch (e) {
      console.warn('UI refresh partial notice:', e);
    }
  },

  // Update cloud status badge in top header
  updateSyncBadge(status) {
    const badge = document.getElementById('firebase-sync-badge');
    if (!badge) return;

    if (status === 'online') {
      badge.className = 'badge badge-success';
      badge.style.cursor = 'pointer';
      badge.title = 'السحابة متصلة وتعمل بالمزامنة الحية الفورية (Real-time Cloud Sync) ☁️';
      badge.innerHTML = `<i class="fa-solid fa-cloud-bolt fa-fade"></i> <span>سحابي متصل ⚡</span>`;
    } else if (status === 'syncing') {
      badge.className = 'badge badge-warning';
      badge.title = 'جاري المزامنة مع السحابة...';
      badge.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span>مزامنة...</span>`;
    } else if (status === 'connecting') {
      badge.className = 'badge badge-info';
      badge.title = 'جاري الاتصال بالسحابة...';
      badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i> <span>اتصال...</span>`;
    } else {
      badge.className = 'badge badge-danger';
      badge.style.cursor = 'pointer';
      badge.title = 'يعمل في وضع التخزين المحلي بدون إنترنت';
      badge.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> <span>محلي (أوفلاين)</span>`;
    }
  },

  // Manual Force Sync Trigger
  forceManualSync() {
    this.updateSyncBadge('syncing');
    if (navigator.onLine && this.isInitialized) {
      this.pushToCloud(true);
      if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast('تمت المزامنة السحابية الفورية بنجاح ☁️⚡', 'success');
      }
    } else {
      if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast('أنت غير متصل بالإنترنت حالياً، البيانات محفوظة محلياً', 'warning');
      }
    }
  }
};

// Auto-initialize when window loads
window.addEventListener('DOMContentLoaded', () => {
  FirebaseSync.init();
});
