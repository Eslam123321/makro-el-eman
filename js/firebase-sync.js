/* ==========================================================================
   مصنع الإيمان للمكرونة - محرك المزامنة السحابية وقاعدة البيانات الحية (Firebase Realtime Cloud Sync Engine)
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
  isInitialized: false,
  isSyncing: false,
  isCloudOnline: false,
  docRef: null,
  syncTimeout: null,

  // Initialize Firebase and start real-time listener
  init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK is not loaded. Working in local offline storage mode.');
        this.updateSyncBadge('offline');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.firestore();
      this.docRef = this.db.collection('makro_db').doc('system_data');
      this.isInitialized = true;

      // Start listening to live cloud updates
      this.listenToCloud();
      console.log('✅ Firebase Cloud Engine initialized successfully for makro-el-eman');
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.updateSyncBadge('offline');
    }
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

        // Merge and update local state if cloud data has valid structure
        if (cloudData && typeof cloudData === 'object' && cloudData.invoices) {
          const isDifferent = JSON.stringify(cloudData) !== JSON.stringify(App.db);
          if (isDifferent) {
            App.db = cloudData;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(App.db));
            this.refreshActivePageUI();
          }
        }
      } else {
        // Document does not exist in cloud yet -> Initial Cloud Seeding
        console.log('⚡ Initializing cloud database with local schema...');
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
        await this.docRef.set(payload, { merge: true });

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
      this.syncTimeout = setTimeout(doSync, 800);
    }
  },

  // Auto Refresh tables and components on current active page when cloud updates
  refreshActivePageUI() {
    try {
      if (typeof loadInvoicesTable === 'function') loadInvoicesTable();
      if (typeof loadProductsTable === 'function') loadProductsTable();
      if (typeof loadCustomersTable === 'function') loadCustomersTable();
      if (typeof loadSuppliersTable === 'function') loadSuppliersTable();
      if (typeof loadEmployeesTable === 'function') loadEmployeesTable();
      if (typeof loadExpensesTable === 'function') loadExpensesTable();
      if (typeof loadDeliveryTrucksTable === 'function') loadDeliveryTrucksTable();
      if (typeof loadStocktakingTable === 'function') loadStocktakingTable();
      if (typeof loadUsersTable === 'function') loadUsersTable();
      if (typeof loadNotificationsTable === 'function') loadNotificationsTable();
      if (typeof updateStatsCards === 'function') updateStatsCards();
      if (typeof renderPageSummaryCards === 'function') {
        const path = window.location.pathname;
        if (path.includes('sales')) renderPageSummaryCards('sales', 'sales-summary-cards');
        if (path.includes('inventory')) renderPageSummaryCards('inventory', 'inventory-summary-cards');
        if (path.includes('customers')) renderPageSummaryCards('customers', 'customers-summary-cards');
        if (path.includes('suppliers')) renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
        if (path.includes('hr')) renderPageSummaryCards('hr', 'hr-summary-cards');
        if (path.includes('expenses')) renderPageSummaryCards('expenses', 'expenses-summary-cards');
        if (path.includes('reports')) renderPageSummaryCards('reports', 'reports-summary-cards');
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
