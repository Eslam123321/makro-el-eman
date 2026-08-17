/* ==========================================================================
   مصنع الإيمان للمكرونة - ERP Masterpiece Core Engine
   Pure JavaScript (ES6+) - Speed Up Enterprise Architecture
   Developed by Speed Up (https://speed-up.tech/)
   ========================================================================== */

const DEFAULT_DATABASE = {
  products: [],
  customers: [],
  invoices: [],
  employees: [],
  expenses: [],
  notifications: [],
  suppliers: [],
  attendanceRecords: [],
  attendanceLog: [],
  deliveryTrucks: [],
  treasury: 0,
  users: []
};

// Storage Manager
class StorageManager {
  static getDB() {
    const data = localStorage.getItem('eleman_erp_db');
    if (!data) {
      this.saveDB(DEFAULT_DATABASE);
      return DEFAULT_DATABASE;
    }
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed.products)) parsed.products = [];
      if (!Array.isArray(parsed.customers)) parsed.customers = [];
      if (!Array.isArray(parsed.invoices)) parsed.invoices = [];
      // Auto-reconcile returned invoices to reflect active net sales, sacks, and collected cash
      parsed.invoices.forEach(inv => {
        const hasReturns = (inv.items || []).some(item => (item.returnedQty || 0) > 0);
        if (hasReturns) {
          const totalReturnedSacks = (inv.items || []).reduce((s, i) => s + (i.returnedQty || 0), 0);
          const totalOriginalSacks = (inv.items || []).reduce((s, i) => s + (i.qty || 0), 0);
          const totalReturnedVal = (inv.items || []).reduce((s, i) => s + ((i.returnedQty || 0) * (i.price || 0)), 0);
          const activeSubtotal = (inv.items || []).reduce((sum, item) => sum + Math.max(0, (item.qty || 0) - (item.returnedQty || 0)) * (item.price || 0), 0);
          const discount = inv.discount || 0;
          const activeGrandTotal = Math.max(0, activeSubtotal - discount);

          inv.subtotal = activeSubtotal;
          inv.grandTotal = activeGrandTotal;
          inv.totalSacks = Math.max(0, totalOriginalSacks - totalReturnedSacks);
          inv.totalReturnedSacks = totalReturnedSacks;
          inv.totalReturnedValue = totalReturnedVal;

          if (totalReturnedSacks >= totalOriginalSacks) {
            inv.status = 'مرتجعة بالكامل';
            inv.paidAmount = 0;
            inv.remainingAmount = 0;
          } else {
            inv.status = `مرتجع جزئي (${totalReturnedSacks} شكارة)`;
            if (inv.paymentType === 'كاش' || (inv.paidAmount >= activeGrandTotal)) {
              inv.paidAmount = activeGrandTotal;
              inv.remainingAmount = 0;
            } else {
              inv.remainingAmount = Math.max(0, activeGrandTotal - (inv.paidAmount || 0));
            }
          }
        }
      });
      if (!Array.isArray(parsed.employees)) parsed.employees = [];
      if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
      parsed.expenses = parsed.expenses.filter(e => !e.id.startsWith('EXP-FLOUR-'));
      if (!Array.isArray(parsed.suppliers)) parsed.suppliers = [];
      if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
      if (!Array.isArray(parsed.attendanceLog)) parsed.attendanceLog = [];
      if (!Array.isArray(parsed.deliveryTrucks)) parsed.deliveryTrucks = [];
      if (!Array.isArray(parsed.users)) parsed.users = [];
      if (typeof parsed.treasury !== 'number') parsed.treasury = 0;
      return parsed;
    } catch(e) {
      this.saveDB(DEFAULT_DATABASE);
      return DEFAULT_DATABASE;
    }
  }

  static saveDB(db) {
    localStorage.setItem('eleman_erp_db', JSON.stringify(db));
    if (typeof FirebaseSync !== 'undefined' && typeof FirebaseSync.pushToCloud === 'function') {
      FirebaseSync.pushToCloud(true);
    }
  }
}

// Global App Utilities
const App = {
  db: StorageManager.getDB(),

  // Current Logged-in User Session
  getCurrentUser() {
    const userStr = localStorage.getItem('eleman_current_user');
    if (!userStr) {
      return null;
    }
    try {
      const u = JSON.parse(userStr);
      // Sync fresh data from db
      const fresh = (this.db.users || []).find(x => x.id === u.id || x.username === u.username);
      return fresh || u;
    } catch(e) {
      return null;
    }
  },

  setCurrentUser(user) {
    localStorage.setItem('eleman_current_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('eleman_current_user');
    window.location.href = 'login.html';
  },

  hasPermission(permissionKey) {
    const user = this.getCurrentUser();
    if (!user || user.status === 'معطل') return false;
    // Only the Super Admin (USR-1 or admin with General Manager role) has automatic full access
    if (user.id === 'USR-1' || (user.username === 'admin' && user.role === 'مدير عام')) {
      return true;
    }
    // Any other user ONLY has permissions that are explicitly in their permissions array
    if (!user.permissions || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permissionKey);
  },

  checkPageAccess(pageKey) {
    if (window.location.pathname.endsWith('login.html')) return;
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    if (user.status === 'معطل') {
      alert('عفواً، تم تعطيل هذا الحساب من قبل إدارة المصنع. يرجى التواصل مع المدير العام.');
      this.logout();
      return;
    }
    if (pageKey && !this.hasPermission(pageKey)) {
      alert('عفواً، ليس لديك صلاحية للوصول إلى هذا القسم.');
      const pageMap = {
        'dashboard': 'index.html',
        'sales': 'sales.html',
        'inventory': 'inventory.html',
        'suppliers': 'suppliers.html',
        'customers': 'customers.html',
        'hr': 'hr.html',
        'expenses': 'expenses.html',
        'reports': 'reports.html',
        'users': 'users.html',
        'notifications': 'notifications.html'
      };
      const firstAllowed = (user.permissions || []).find(p => p !== pageKey && pageMap[p]);
      const dest = firstAllowed ? pageMap[firstAllowed] : 'login.html';
      window.location.href = dest;
    }
  },

  save() {
    StorageManager.saveDB(this.db);
    this.refreshUI();
  },

  refreshUI() {
    this.db = StorageManager.getDB();
    if (typeof loadDashboardData === 'function') loadDashboardData();
    if (typeof loadInvoicesTable === 'function') loadInvoicesTable();
    if (typeof initSalesForm === 'function') initSalesForm();
    if (typeof loadInventoryTable === 'function') loadInventoryTable();
    if (typeof loadCustomersTable === 'function') loadCustomersTable();
    if (typeof checkUpcomingDuePayments === 'function') checkUpcomingDuePayments();
    if (typeof loadEmployeesTable === 'function') loadEmployeesTable();
    if (typeof generateAttendanceReport === 'function') generateAttendanceReport();
    if (typeof loadExpensesTable === 'function') loadExpensesTable();
    if (typeof loadSuppliersTable === 'function') loadSuppliersTable();
    if (typeof generateFinancialAuditReport === 'function') generateFinancialAuditReport();
    if (typeof loadDeliveryTrucksTable === 'function') loadDeliveryTrucksTable();
    if (typeof loadNotificationsPage === 'function') loadNotificationsPage();

    const activeNavItem = document.querySelector('.sidebar-nav .nav-item.active span');
    if (activeNavItem) {
      const text = activeNavItem.textContent || '';
      if (text.includes('المبيعات') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('sales', 'sales-summary-cards');
      if (text.includes('المخازن') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('inventory', 'inventory-summary-cards');
      if (text.includes('العملاء') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('customers', 'customers-summary-cards');
      if (text.includes('الموارد') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('hr', 'hr-summary-cards-container');
      if (text.includes('المصروفات') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('expenses', 'expenses-summary-cards');
      if (text.includes('الموردين') && typeof renderPageSummaryCards === 'function') renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
    }
    this.updateNotificationBadge();
  },

  playBeepTone(freq = 880, type = 'sine', duration = 0.1) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  },

  formatCurrency(amount) {
    const num = Math.round(parseFloat(amount) || 0);
    if (num < 0) {
      return `-${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Math.abs(num))} ج.م`;
    }
    return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(num) + ' ج.م';
  },

  formatTimestamp(dateStr = null) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  },

  getNowISO() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  },

  getFormattedCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  showToast(message, type = 'success') {
    this.playBeepTone(type === 'success' ? 900 : (type === 'danger' ? 300 : 600));

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'danger' ? 'fa-circle-xmark' : 'fa-circle-exclamation');
    toast.innerHTML = `
      <i class="fa-solid ${icon} ${type === 'success' ? 'text-success' : (type === 'danger' ? 'text-danger' : 'text-warning')}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('eleman_theme', newTheme);
    this.showToast(`تم تغيير النمط إلى (${newTheme === 'dark' ? 'النمط الليلي 🌙' : 'النمط النهاري ☀️'})`, 'success');
  },

  initTheme() {
    const savedTheme = localStorage.getItem('eleman_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },

  // Activity & Audit Logging Engine
  logActivity(title, message, type = 'info', actor = null) {
    const user = actor || this.getCurrentUser() || { name: 'المدير العام', username: 'admin', role: 'مدير عام' };
    const fullMsg = `[بواسطة: ${user.name} (${user.username}) - ${user.role}] ${message}`;
    this.addNotification(title, fullMsg, type);
  },

  // Notification Actions
  addNotification(title, message, type = 'info') {
    const newNotif = {
      id: `NOTIF-${Date.now()}`,
      title: title,
      message: message,
      date: this.getNowISO(),
      type: type
    };
    if (!this.db.notifications) this.db.notifications = [];
    this.db.notifications.unshift(newNotif);
    this.save();
    this.updateNotificationBadge();
  },

  deleteNotification(notifId) {
    this.db.notifications = (this.db.notifications || []).filter(n => n.id !== notifId);
    this.save();
    this.updateNotificationBadge();
    if (typeof loadNotificationsPage === 'function') loadNotificationsPage();
    if (typeof renderNotificationsDropdown === 'function') renderNotificationsDropdown();
    this.showToast('تم حذف الإشعار بنجاح 🗑️', 'danger');
  },

  // Professional Glassmorphic Confirmation Modal Engine (Replaces native browser alert/confirm)
  showConfirmModal({
    title = 'تأكيد الإجراء',
    message = 'هل أنت متأكد من تنفيذ هذا الإجراء؟',
    icon = 'fa-solid fa-triangle-exclamation',
    iconBg = '#fee2e2',
    iconColor = '#dc2626',
    confirmText = 'تأكيد الإجراء',
    confirmBtnClass = 'btn-danger',
    cancelText = 'إلغاء الأمر ✕',
    onConfirm = null,
    onCancel = null
  }) {
    let modal = document.getElementById('global-confirm-dialog-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-confirm-dialog-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '999999';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 440px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); text-align: center; padding: 26px 22px; margin: 0 auto; background: var(--bg-card); border: 2px solid var(--border-color); animation: pwaSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 14px auto; box-shadow: 0 8px 16px -4px rgba(220, 38, 38, 0.2);">
          <i class="${icon}"></i>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); font-family: 'Cairo', sans-serif;">${title}</h3>
        <p style="margin: 0 0 22px 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6; font-family: 'Cairo', sans-serif;">${message}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button type="button" id="global-confirm-cancel-btn" class="btn btn-secondary" style="flex: 1; padding: 10px 14px; font-weight: 700; border-radius: 10px; font-family: 'Cairo', sans-serif;">${cancelText}</button>
          <button type="button" id="global-confirm-accept-btn" class="btn ${confirmBtnClass}" style="flex: 1; padding: 10px 14px; font-weight: 800; border-radius: 10px; font-family: 'Cairo', sans-serif;">${confirmText}</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const cancelBtn = document.getElementById('global-confirm-cancel-btn');
    const acceptBtn = document.getElementById('global-confirm-accept-btn');

    const cleanup = () => {
      modal.classList.remove('active');
    };

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cleanup();
        if (typeof onCancel === 'function') onCancel();
      };
    }

    if (acceptBtn) {
      acceptBtn.onclick = () => {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        if (typeof onCancel === 'function') onCancel();
      }
    };
  },

  clearAllNotifications() {
    this.showConfirmModal({
      title: 'مسح سجل الإشعارات',
      message: 'هل أنت متأكد من رغبتك في مسح وتصفير كافة الإشعارات والأنشطة المسجلة نهائياً؟',
      icon: 'fa-solid fa-bell-slash',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      confirmText: 'نعم، تصفير السجل 🧹',
      confirmBtnClass: 'btn-warning',
      onConfirm: () => {
        this.db.notifications = [];
        this.save();
        this.updateNotificationBadge();
        if (typeof loadNotificationsPage === 'function') loadNotificationsPage();
        if (typeof renderNotificationsDropdown === 'function') renderNotificationsDropdown();
        this.showToast('تم مسح وتصفير كافة الإشعارات بنجاح! ✨', 'info');
      }
    });
  },

  printNotification(id) {
    const notif = (this.db.notifications || []).find(n => n.id === id);
    if (!notif) return;
    const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>إشعار رقابة رسمي - مصنع الإيمان للمكرونة</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
          <style>
            body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; color: #1e293b; padding: 2.5rem; }
            .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 1rem; margin-bottom: 1.5rem; }
            .notif-card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; background: #f8fafc; margin-bottom: 2rem; }
            .footer-sign { display: flex; justify-content: space-between; margin-top: 3rem; border-top: 1px dashed #cbd5e1; padding-top: 1.5rem; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <img src="${logoSrc}" style="height: 60px; width: 60px; object-fit: contain;">
              <div>
                <h2 style="color: #059669; margin: 0;">مصنع الإيمان للمكرونة</h2>
                <p style="color: #64748b; font-size: 0.85rem; margin: 2px 0 0 0;">سجل الرقابة وتدقيق الأنشطة الإدارية</p>
              </div>
            </div>
            <div style="text-align: left;">
              <strong style="font-size: 1.1rem; color: #1e293b;">إشعار نظام رسمي 🔔</strong>
              <p style="color: #64748b; font-size: 0.8rem; margin: 2px 0 0 0;">كود الإشعار: ${notif.id}</p>
            </div>
          </div>

          <div class="notif-card">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 1.3rem;">${notif.title}</h3>
            <p style="font-size: 1.05rem; line-height: 1.8; color: #334155; margin: 1rem 0;">${notif.message}</p>
            <div style="color: #64748b; font-size: 0.85rem; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; margin-top: 1rem;">
              <strong>توقيت تسجيل الإجراء:</strong> ${notif.date}
            </div>
          </div>

          <div class="footer-sign">
            <div>
              <p>ختم مصنع الإيمان للمكرونة: 🌾 ________________</p>
            </div>
            <div>
              <p>اعتماد الإدارة العامة والرقابة: ________________</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => {
      printWin.print();
    }, 400);
  },

  printAllNotifications() {
    const notifs = this.db.notifications || [];
    const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>سجل الرقابة والأنشطة الشامل - مصنع الإيمان</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
          <style>
            body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; color: #1e293b; padding: 2rem; }
            .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 1rem; margin-bottom: 1.5rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
            th { background: #f1f5f9; font-weight: bold; }
            .footer-sign { display: flex; justify-content: space-between; margin-top: 2.5rem; border-top: 1px dashed #cbd5e1; padding-top: 1rem; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <img src="${logoSrc}" style="height: 60px; width: 60px; object-fit: contain;">
              <div>
                <h2 style="color: #059669; margin: 0;">مصنع الإيمان للمكرونة</h2>
                <p style="color: #64748b; font-size: 0.85rem; margin: 2px 0 0 0;">تقرير سجل الرقابة وتدقيق الأنشطة والإشعارات الشامل</p>
              </div>
            </div>
            <div style="text-align: left;">
              <strong style="font-size: 1.1rem; color: #1e293b;">كشف الرقابة العامة</strong>
              <p style="color: #64748b; font-size: 0.8rem; margin: 2px 0 0 0;">إجمالي الأنشطة: ${notifs.length} إشعار</p>
              <p style="color: #64748b; font-size: 0.8rem; margin: 2px 0 0 0;">تاريخ الاستخراج: ${this.getFormattedCurrentDate()}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th style="width: 150px;">التاريخ والوقت</th>
                <th style="width: 170px;">نوع الإجراء / العنوان</th>
                <th>تفاصيل الإجراء والموظف المنفذ</th>
              </tr>
            </thead>
            <tbody>
              ${notifs.map((n, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td style="font-size: 0.8rem;">${n.date}</td>
                  <td><strong>${n.title}</strong></td>
                  <td>${n.message}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div>
              <p>ختم واعتماد مصنع الإيمان للمكرونة: 🌾 ________________</p>
            </div>
            <div>
              <p>مدير عام الرقابة الإدارية: ________________</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => {
      printWin.print();
    }, 400);
  },

  updateNotificationBadge() {
    const currentUser = this.getCurrentUser();
    const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
    
    const countEl = document.getElementById('header-notif-count');
    const badgeWrapper = document.getElementById('header-notif-wrapper');
    const sidebarBadge = document.getElementById('sidebar-notif-badge');

    if (!isSuperAdmin) {
      if (badgeWrapper) badgeWrapper.style.display = 'none';
      if (sidebarBadge) sidebarBadge.style.display = 'none';
      return;
    }

    if (badgeWrapper) badgeWrapper.style.display = 'block';
    const count = (this.db.notifications || []).length;
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    if (sidebarBadge) {
      sidebarBadge.textContent = count;
      sidebarBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  },

  exportBackup() {
    const jsonStr = JSON.stringify(this.db, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Eleman_Pasta_Factory_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('تم تصدير النسخة الاحتياطية بنجاح 💾', 'success');
  },

  exportTableToCSV(tableId, filename = 'report.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;
    let csv = [];
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cols = row.querySelectorAll('td, th');
      let rowData = [];
      cols.forEach(col => rowData.push('"' + col.innerText.replace(/"/g, '""') + '"'));
      csv.push(rowData.join(','));
    });

    const csvContent = '\uFEFF' + csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`تم تصدير الجدول إلى ملف Excel (${filename})`, 'success');
  },

  handleQuickModalSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-modal-results');
    if (!resultsContainer) return;

    if (!q) {
      resultsContainer.innerHTML = `<div class="p-6 text-center text-muted text-sm">ابدأ الكتابة للبحث السريع في الفواتير والعملاء والمطاحن والأصناف والموظفين وسيارات التوصيل...</div>`;
      return;
    }

    const results = [];

    // Search Invoices
    (this.db.invoices || []).forEach(inv => {
      if (inv.id.toLowerCase().includes(q) || (inv.customerName && inv.customerName.toLowerCase().includes(q))) {
        results.push({
          type: 'فاتورة مبيعات',
          icon: 'fa-file-invoice-dollar',
          title: `فاتورة رقم ${inv.id} - ${inv.customerName}`,
          subtitle: `${this.formatCurrency(inv.grandTotal)} | ${this.formatTimestamp(inv.date)}`,
          action: () => { closeModal('global-search-modal'); previewInvoice(inv.id); }
        });
      }
    });

    // Search Customers
    (this.db.customers || []).forEach(c => {
      if (c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || c.id.toLowerCase().includes(q)) {
        results.push({
          type: 'حساب عميل',
          icon: 'fa-user',
          title: `العميل: ${c.name}`,
          subtitle: `هاتف: ${c.phone} | ديون مستحقة: ${this.formatCurrency(c.totalDebt)}`,
          action: () => { closeModal('global-search-modal'); window.location.href = `customers.html?search=${encodeURIComponent(c.name)}`; }
        });
      }
    });

    // Search Suppliers
    (this.db.suppliers || []).forEach(s => {
      if (s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || (s.flourType && s.flourType.toLowerCase().includes(q))) {
        results.push({
          type: 'مورد / مطحن',
          icon: 'fa-truck-field',
          title: `المطحن/المورد: ${s.name}`,
          subtitle: `نوع الدقيق: ${s.flourType} | مستحقات المطحن: ${this.formatCurrency(s.totalBalance)}`,
          action: () => { closeModal('global-search-modal'); window.location.href = `suppliers.html?search=${encodeURIComponent(s.name)}`; }
        });
      }
    });

    // Search Products
    (this.db.products || []).forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) {
        results.push({
          type: 'صنف مكرونة',
          icon: 'fa-boxes-stacked',
          title: `صنف: ${p.name}`,
          subtitle: `سعر الشكارة: ${this.formatCurrency(p.sellPrice)} | المتاح بالمخزن: ${p.stock} شكارة`,
          action: () => { closeModal('global-search-modal'); window.location.href = `inventory.html?search=${encodeURIComponent(p.name)}`; }
        });
      }
    });

    // Search Employees
    (this.db.employees || []).forEach(e => {
      if (e.name.toLowerCase().includes(q) || (e.jobTitle && e.jobTitle.toLowerCase().includes(q))) {
        results.push({
          type: 'موظف',
          icon: 'fa-user-tie',
          title: `الموظف: ${e.name}`,
          subtitle: `الوظيفة: ${e.jobTitle} | الراتب: ${this.formatCurrency(e.baseSalary)}`,
          action: () => { closeModal('global-search-modal'); window.location.href = `hr.html?search=${encodeURIComponent(e.name)}`; }
        });
      }
    });

    // Search Delivery Trucks
    (this.db.deliveryTrucks || []).forEach(t => {
      if ((t.driverName && t.driverName.toLowerCase().includes(q)) || (t.plateNumber && t.plateNumber.toLowerCase().includes(q)) || (t.repName && t.repName.toLowerCase().includes(q))) {
        results.push({
          type: 'سيارة توصيل',
          icon: 'fa-truck-fast',
          title: `سيارة ${t.plateNumber} (سائق: ${t.driverName})`,
          subtitle: `المندوب الحالي: ${t.repName} | حالة السيارة: ${t.status}`,
          action: () => { closeModal('global-search-modal'); window.location.href = `reports.html?search=${encodeURIComponent(t.plateNumber)}`; }
        });
      }
    });

    if (results.length === 0) {
      resultsContainer.innerHTML = `<div class="p-6 text-center text-muted">لا يوجد نتائج مطابقة للبحث "${q}"</div>`;
      return;
    }

    resultsContainer.innerHTML = results.map((r, index) => `
      <div class="quick-search-item" onclick="App._execSearchResult(${index})">
        <div class="quick-search-icon"><i class="fa-solid ${r.icon}"></i></div>
        <div style="flex: 1;">
          <div class="flex justify-between items-center">
            <strong class="text-sm text-primary">${r.title}</strong>
            <span class="badge badge-blue text-xs">${r.type}</span>
          </div>
          <p class="text-xs text-muted mt-1">${r.subtitle}</p>
        </div>
      </div>
    `).join('');

    window._currentModalSearchResults = results;
  },

  _execSearchResult(index) {
    if (window._currentModalSearchResults && window._currentModalSearchResults[index]) {
      window._currentModalSearchResults[index].action();
    }
  },

  handleQuickSearch(query) {
    const dropdown = document.getElementById('quick-search-dropdown');
    if (!dropdown) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const results = [];

    // Search Invoices
    (this.db.invoices || []).forEach(inv => {
      if (inv.id.toLowerCase().includes(q) || (inv.customerName && inv.customerName.toLowerCase().includes(q))) {
        results.push({
          type: 'فاتورة مبيعات',
          icon: 'fa-file-invoice-dollar',
          title: `${inv.id} - ${inv.customerName}`,
          subtitle: `${this.formatCurrency(inv.grandTotal)} | ${inv.date}`,
          action: () => openInvoiceGlobalPreview(inv.id)
        });
      }
    });

    // Search Customers
    (this.db.customers || []).forEach(c => {
      if (c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || c.id.toLowerCase().includes(q)) {
        results.push({
          type: 'عميل',
          icon: 'fa-user',
          title: `${c.name} (${c.phone})`,
          subtitle: `الديون: ${this.formatCurrency(c.totalDebt)} | ${c.address}`,
          action: () => window.location.href = `customers.html?search=${encodeURIComponent(c.name)}`
        });
      }
    });

    // Search Suppliers
    (this.db.suppliers || []).forEach(s => {
      if (s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || (s.flourType && s.flourType.toLowerCase().includes(q))) {
        results.push({
          type: 'مطحن / مورد',
          icon: 'fa-truck-field',
          title: `${s.name} (${s.flourType})`,
          subtitle: `السعر: ${s.unitPrice} ج.م | المستحق: ${this.formatCurrency(s.totalBalance)}`,
          action: () => window.location.href = `suppliers.html?search=${encodeURIComponent(s.name)}`
        });
      }
    });

    // Search Products
    (this.db.products || []).forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) {
        results.push({
          type: 'صنف مكرونة',
          icon: 'fa-boxes-stacked',
          title: `${p.name}`,
          subtitle: `المتاح: ${p.stock} شكارة | سعر الشكارة: ${p.sellPrice} ج.م`,
          action: () => window.location.href = `inventory.html?search=${encodeURIComponent(p.name)}`
        });
      }
    });

    // Search Employees
    (this.db.employees || []).forEach(e => {
      if (e.name.toLowerCase().includes(q) || (e.jobTitle && e.jobTitle.toLowerCase().includes(q))) {
        results.push({
          type: 'موظف',
          icon: 'fa-user-tie',
          title: `${e.name} (${e.jobTitle})`,
          subtitle: `الراتب الأساسي: ${this.formatCurrency(e.baseSalary)}`,
          action: () => window.location.href = `hr.html?search=${encodeURIComponent(e.name)}`
        });
      }
    });

    // Search Delivery Trucks
    (this.db.deliveryTrucks || []).forEach(t => {
      if ((t.driverName && t.driverName.toLowerCase().includes(q)) || (t.plateNumber && t.plateNumber.toLowerCase().includes(q)) || (t.repName && t.repName.toLowerCase().includes(q))) {
        results.push({
          type: 'سيارة توصيل',
          icon: 'fa-truck-fast',
          title: `سائق: ${t.driverName} (${t.plateNumber})`,
          subtitle: `المندوب: ${t.repName} | حالة: ${t.status}`,
          action: () => window.location.href = `reports.html?search=${encodeURIComponent(t.driverName)}`
        });
      }
    });

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="p-3 text-center text-muted text-xs">لا توجد نتائج مطابقة لـ "${q}"</div>`;
    } else {
      window._qsActions = results.map(r => r.action);
      dropdown.innerHTML = results.slice(0, 7).map((r, idx) => `
        <div class="quick-search-item" onclick="window._qsActions[${idx}](); document.getElementById('quick-search-dropdown').style.display='none';">
          <div class="quick-search-icon"><i class="fa-solid ${r.icon}"></i></div>
          <div class="quick-search-content">
            <div class="flex justify-between items-center">
              <strong class="text-sm">${r.title}</strong>
              <span class="badge badge-blue text-xs">${r.type}</span>
            </div>
            <span class="text-xs text-muted block mt-1">${r.subtitle}</span>
          </div>
        </div>
      `).join('');
    }
    dropdown.style.display = 'block';
  }
};

App.initTheme();

document.addEventListener('click', (e) => {
  if (!e.target.closest('#global-quick-search-box')) {
    const dropdown = document.getElementById('quick-search-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }
});

// Global Clickable Invoice Preview Trigger
function openInvoiceGlobalPreview(invId) {
  previewInvoice(invId);
}

function renderInvoicePreviewContent(inv, isDraft = false) {
  const container = document.getElementById('invoice-preview-container');
  if (!container) return;

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
  const cust = App.db.customers ? App.db.customers.find(c => c.name === inv.customerName || c.id === inv.customerId) : null;

  container.innerHTML = `
    <div id="printable-invoice-content" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl !important; text-align: right !important; letter-spacing: 0px !important; word-spacing: 0px !important; color: #1e293b; background: #ffffff; padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; width: 100%; position: relative; overflow: hidden;">
      
      <!-- Luxury Realistic Watermark Seal in Background -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg); pointer-events: none; opacity: 0.065; z-index: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 340px; height: 340px; border: 8px double #059669; border-radius: 50%; user-select: none;">
        <div style="border: 2px dashed #059669; border-radius: 50%; width: 300px; height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
          <span style="font-size: 1.2rem; font-weight: 900; color: #059669; letter-spacing: 1.5px;">مصنع الإيمان للمكرونة</span>
          <span style="font-size: 2.5rem; margin: 4px 0;">🌾</span>
          <span style="font-size: 1rem; font-weight: 800; color: #059669;">★ معتمد رسمياً وموثق ★</span>
          <span style="font-size: 0.8rem; font-weight: 700; color: #059669; margin-top: 4px;">ELEMAN PASTA FACTORY</span>
          <span style="font-size: 0.72rem; color: #059669; margin-top: 2px;">إدارة المبيعات والرقابة والجودة</span>
        </div>
      </div>

      <!-- Invoice Header with Real Logo -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; position: relative; z-index: 1;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 54px; width: 54px; object-fit: contain; flex-shrink: 0;">
          <div>
            <h2 style="color: #059669; font-weight: 800; font-size: 1.3rem; margin: 0 0 2px 0; letter-spacing: 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0 0 2px 0;">إنتاج وتعبئة أرقى أنواع المكرونة بالشكارة</p>
            <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">جمهورية مصر العربية - خطوط إنتاج المنطقة الصناعية</p>
          </div>
        </div>
        <div style="text-align: left; flex: 1; min-width: 160px;">
          <h3 style="font-weight: 800; color: #1e293b; margin: 0 0 2px 0; font-size: 1.15rem; letter-spacing: 0;">فاتورة بيع شكاير رسمية</h3>
          <p style="font-size: 0.9rem; font-weight: 800; color: #059669; margin: 0 0 2px 0;">رقم الفاتورة: ${inv.id}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">التاريخ: ${App.formatTimestamp(inv.date)}</p>
        </div>
      </div>

      <!-- Customer Info Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; position: relative; z-index: 1;">
        <div style="flex: 1; min-width: 180px;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">بيانات العميل المستلم:</span>
          <strong style="font-size: 1.05rem; color: #0f172a; font-family: 'Cairo', sans-serif;">${inv.customerName}</strong>
          ${cust && cust.phone ? `<span style="font-size: 0.8rem; color: #64748b; margin-right: 8px;">| هاتف: <strong style="color: #059669;">${cust.phone}</strong></span>` : ''}
        </div>
        <div style="text-align: left;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">طريقة السداد:</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem;">${inv.paymentType}</span>
        </div>
      </div>

      <!-- Items Table -->
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; z-index: 1;">
        <table style="width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background: #f1f5f9;">
            <tr>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 800;">منتج المكرونة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 800;">وحدة التعبئة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 800;">الكمية المباعة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 800;">سعر الشكارة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: left; font-weight: 800;">الإجمالي الصافي</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map(item => {
              const returned = item.returnedQty || 0;
              const activeQty = Math.max(0, (item.qty || 0) - returned);
              const rowTotal = activeQty * (item.price || 0);
              return `
                <tr>
                  <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${item.name}</td>
                  <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;"><span style="background: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">${item.unit}</span></td>
                  <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700;">
                    ${activeQty} شكارة
                    ${returned > 0 ? `<div style="font-size: 0.72rem; color: #dc2626; font-weight: 700; margin-top: 2px;">(مرتجع: ${returned} من أصل ${item.qty})</div>` : ''}
                  </td>
                  <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${App.formatCurrency(item.price)}</td>
                  <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 800; color: #059669;">${App.formatCurrency(rowTotal)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals Breakdown & Official Seal -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; flex-wrap: wrap; gap: 10px; border-top: 2px solid #e2e8f0; padding-top: 10px; position: relative; z-index: 1;">
        <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px;">
          <!-- Authentic Luxury Stamped Official Circular Seal -->
          <div style="position: relative; width: 105px; height: 105px; border: 3px double #059669; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #059669; background: radial-gradient(circle, rgba(5, 150, 105, 0.08) 0%, rgba(5, 150, 105, 0.01) 70%); transform: rotate(-10deg); box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25), inset 0 0 8px rgba(5, 150, 105, 0.06); flex-shrink: 0; user-select: none;">
            <div style="width: 90px; height: 90px; border: 1.5px dashed #059669; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px; box-sizing: border-box;">
              <span style="font-size: 0.62rem; font-weight: 900; line-height: 1; letter-spacing: 0.5px;">مصنع الإيمان</span>
              <div style="display: flex; align-items: center; gap: 2px; margin: 1px 0;">
                <span style="font-size: 0.55rem;">★</span>
                <span style="font-size: 1.1rem; line-height: 1;">🌾</span>
                <span style="font-size: 0.55rem;">★</span>
              </div>
              <span style="font-size: 0.55rem; font-weight: 800; background: #059669; color: #ffffff; padding: 1px 6px; border-radius: 8px; margin: 1px 0;">${isDraft ? 'مسودة' : 'معتمد وموثق'}</span>
              <span style="font-size: 0.5rem; font-weight: 700; color: #047857;">إدارة المبيعات</span>
              <span style="font-size: 0.42rem; color: #059669; margin-top: 1px; letter-spacing: 0.5px;">ELEMAN CERTIFIED</span>
            </div>
          </div>

          <div style="font-size: 0.75rem; color: #64748b; line-height: 1.3;">
            <p style="font-weight: 700; color: #334155; margin: 0 0 2px 0;">شكراً لتعاملكم مع مصنع الإيمان للمكرونة 🌾</p>
            <p style="margin: 0;">* يسعدنا خدمتكم دائماً وتوفير أجود أنواع المكرونة بالشكارة.</p>
          </div>
        </div>

        <div style="flex: 1; min-width: 220px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
          ${(inv.totalReturnedValue && inv.totalReturnedValue > 0) ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 3px; color: #64748b;">
            <span>المجموع الأصلي قبل المرتجع:</span>
            <strong style="color: #64748b; text-decoration: line-through;">${App.formatCurrency(inv.subtotal + inv.totalReturnedValue)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 3px; color: #dc2626;">
            <span>قيمة المرتجع المسترد للمخزن (${inv.totalReturnedSacks || 0} شكارة):</span>
            <strong>-${App.formatCurrency(inv.totalReturnedValue)}</strong>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #475569;">
            <span>صافي المجموع الفرعي للشكاير المباعة:</span>
            <strong style="color: #1e293b;">${App.formatCurrency(inv.subtotal)}</strong>
          </div>
          ${inv.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #dc2626;">
            <span>الخصم المباشر:</span>
            <strong>-${App.formatCurrency(inv.discount)}</strong>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.05rem; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 3px; color: #059669; font-family: 'Cairo', sans-serif;">
            <span>صافي الإجمالي الواجب سداده:</span>
            <span>${App.formatCurrency(inv.grandTotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748b; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 3px;">
            <span>المسدد كاش: <strong class="text-success">${App.formatCurrency(inv.paidAmount)}</strong></span>
            <span>المتبقي آجل: <strong class="${inv.remainingAmount > 0 ? 'text-danger' : 'text-success'}">${App.formatCurrency(inv.remainingAmount)}</strong></span>
          </div>
        </div>
      </div>

    </div>
  `;
}

function previewInvoice(invId) {
  let inv = App.db.invoices ? App.db.invoices.find(i => i.id === invId) : null;
  if (!inv && typeof currentDraftInvoice !== 'undefined' && currentDraftInvoice && currentDraftInvoice.id === invId) {
    inv = currentDraftInvoice;
  }
  if (!inv) return;

  renderInvoicePreviewContent(inv, !!inv.isDraft);

  const btnPrint = document.getElementById('btn-print-inv');
  if (btnPrint) btnPrint.onclick = () => window.print();

  const btnPdf = document.getElementById('btn-pdf-inv');
  if (btnPdf) btnPdf.onclick = () => window.print();

  const btnImg = document.getElementById('btn-img-inv');
  if (btnImg) btnImg.onclick = () => downloadInvoiceAsImage();

  const btnWa = document.getElementById('btn-wa-inv');
  if (btnWa) btnWa.onclick = () => sendInvoiceWhatsApp(inv.id);

  openModal('preview-invoice-modal');
}

async function generateInvoicePdfBlob(invId) {
  let inv = App.db.invoices ? App.db.invoices.find(i => i.id === invId) : null;
  if (!inv && typeof currentDraftInvoice !== 'undefined' && currentDraftInvoice && currentDraftInvoice.id === invId) {
    inv = currentDraftInvoice;
  }
  if (!inv && App.db.invoices && App.db.invoices.length > 0) {
    inv = App.db.invoices[0];
  }
  if (!inv) return null;

  if (!document.getElementById('printable-invoice-content')) {
    previewInvoice(inv.id || invId);
  }

  const originalContent = document.getElementById('printable-invoice-content');
  if (!originalContent) return null;

  const modal = document.getElementById('preview-invoice-modal');
  const wasActive = modal && modal.classList.contains('active');
  if (modal && !wasActive) {
    modal.classList.add('active');
  }

  const opt = {
    margin: [6, 6, 6, 6],
    filename: `Invoice-${inv.id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      letterRendering: false,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(originalContent).output('blob');
    if (modal && !wasActive) {
      modal.classList.remove('active');
    }
    return pdfBlob;
  } catch (e) {
    console.error('generateInvoicePdfBlob error:', e);
    if (modal && !wasActive) {
      modal.classList.remove('active');
    }
    return null;
  }
}

async function sendInvoiceWhatsApp(invId) {
  let inv = App.db.invoices ? App.db.invoices.find(i => i.id === invId) : null;
  if (!inv && typeof currentDraftInvoice !== 'undefined' && currentDraftInvoice && currentDraftInvoice.id === invId) {
    inv = currentDraftInvoice;
  }
  if (!inv && App.db.invoices && App.db.invoices.length > 0) {
    inv = App.db.invoices[0];
  }
  if (!inv) {
    App.showToast('عفواً، لا يوجد فاتورة محددة للمشاركة', 'warning');
    return;
  }

  App.showToast('جاري تحضير ملف الفاتورة PDF للمشاركة... 📄', 'info');

  const pdfBlob = await generateInvoicePdfBlob(inv.id);
  if (!pdfBlob) {
    App.showToast('عفواً، تعذر توليد ملف الـ PDF', 'danger');
    return;
  }

  const pdfFile = new File([pdfBlob], `Invoice-${inv.id}.pdf`, { type: 'application/pdf' });

  // 1. Web Share API Execution (Attaches the real PDF file directly)
  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `فاتورة ${inv.id}`,
        text: `مرفق فاتورة بصيغة PDF لـ ${inv.customerName}`
      });
      App.showToast('تم فتح نافذة إرسال ملف الـ PDF بنجاح! 💬', 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // 2. Direct PDF Download
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `Invoice-${inv.id}.pdf`;
  a.click();
  URL.revokeObjectURL(blobUrl);

  App.showToast('تم تنزيل ملف الفاتورة PDF على جهازك بنجاح! 📄', 'success');
}

// Multi-Tab Realtime Reactivity Listener
window.addEventListener('storage', (e) => {
  if (e.key === 'eleman_erp_db') {
    App.refreshUI();
  }
});

// Download Invoice Container as High-Quality PNG Image
async function downloadInvoiceAsImage() {
  const content = document.getElementById('printable-invoice-content');
  if (!content) return;

  App.showToast('جاري استخراج وتنزيل الفاتورة كصورة عالية الدقة (PNG)... 🖼️', 'info');

  // Ensure html2canvas is available
  if (typeof html2canvas === 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch (e) {
      console.warn('Could not load html2canvas from CDN, trying fallback...');
    }
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }

  try {
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      letterRendering: false,
      logging: false,
      scrollY: 0,
      scrollX: 0
    });

    if (!canvas || canvas.width === 0) {
      App.showToast('عفواً، تعذر التقاط صورة الفاتورة', 'danger');
      return;
    }

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          downloadViaDataUrl(canvas);
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `فاتورة-${Date.now()}.png`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        App.showToast('تم تنزيل الفاتورة كصورة PNG بنجاح! 🖼️✨', 'success');
      }, 'image/png', 1.0);
    } else {
      downloadViaDataUrl(canvas);
    }
  } catch (err) {
    console.error('downloadInvoiceAsImage error:', err);
    App.showToast('تعذر تحويل الفاتورة لصورة - يرجى المحاولة مجدداً', 'danger');
  }
}

function downloadViaDataUrl(canvas) {
  try {
    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Invoice-${Date.now()}.png`;
    link.href = imgData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast('تم تنزيل الفاتورة كصورة PNG بنجاح! 🖼️✨', 'success');
  } catch (e) {
    console.error('downloadViaDataUrl error:', e);
    App.showToast('تعذر تنزيل الصورة', 'danger');
  }
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    if (!document.querySelector('.modal-backdrop.active')) {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }
}

// Toggle Notifications Dropdown Menu
function toggleNotificationsDropdown() {
  const dropdown = document.getElementById('notif-dropdown-menu');
  if (dropdown) {
    dropdown.classList.toggle('active');
    renderNotificationsDropdown();
  }
}

function renderNotificationsDropdown() {
  const body = document.getElementById('notif-dropdown-body');
  if (!body) return;

  const notifs = App.db.notifications;
  if (notifs.length === 0) {
    body.innerHTML = `<div class="p-4 text-center text-muted">لا يوجد إشعارات جديدة</div>`;
    return;
  }

  body.innerHTML = notifs.map(n => `
    <div class="notif-item">
      <div class="notif-item-icon ${n.type === 'danger' ? 'icon-rose' : (n.type === 'warning' ? 'icon-amber' : 'icon-blue')}">
        <i class="fa-solid ${n.type === 'danger' ? 'fa-triangle-exclamation' : (n.type === 'warning' ? 'fa-bell' : 'fa-info-circle')}"></i>
      </div>
      <div style="flex: 1;">
        <div class="flex justify-between items-center">
          <strong class="text-sm">${n.title}</strong>
          <button class="btn btn-sm text-danger" onclick="event.stopPropagation(); App.deleteNotification('${n.id}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div>
        <p class="text-xs text-secondary mt-1">${n.message}</p>
        <span class="text-xs text-muted mt-1 block">${n.date}</span>
      </div>
    </div>
  `).join('');
}

// Close Dropdowns on Body Click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-bell-btn') && !e.target.closest('#notif-dropdown-menu')) {
    const dropdown = document.getElementById('notif-dropdown-menu');
    if (dropdown) dropdown.classList.remove('active');
  }
});

// Render Top Header Summary Banner Cards on Every Page
function renderPageSummaryCards(page, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let cardsHTML = '';

  if (page === 'sales') {
    const invoices = App.db.invoices || [];
    const validInvoices = invoices.filter(i => i.status !== 'مرتجعة بالكامل');
    const totalSales = validInvoices.reduce((a, b) => a + (b.grandTotal || 0), 0);
    const totalDisc = validInvoices.reduce((a, b) => a + (b.discount || 0), 0);
    const totalPaid = invoices.reduce((a, b) => a + (b.paidAmount || 0), 0);

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-receipt"></i></div>
        <div><span class="text-xs text-muted">عدد الفواتير الصادرة</span><h4>${invoices.length} فاتورة</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-cart-shopping"></i></div>
        <div><span class="text-xs text-muted">صافي إيراد المبيعات</span><h4 class="text-success">${App.formatCurrency(totalSales)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-amber"><i class="fa-solid fa-percent"></i></div>
        <div><span class="text-xs text-muted">إجمالي الخصومات الممنوحة</span><h4 class="text-warning">${App.formatCurrency(totalDisc)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-purple"><i class="fa-solid fa-vault"></i></div>
        <div><span class="text-xs text-muted">النقدية المحصلة (كاش)</span><h4 class="text-primary-color">${App.formatCurrency(totalPaid)}</h4></div>
      </div>
    `;
  } else if (page === 'inventory') {
    const products = App.db.products;
    const totalSacks = products.reduce((a, b) => a + b.stock, 0);
    const totalVal = products.reduce((a, b) => a + (b.stock * b.costPrice), 0);
    const lowCount = products.filter(p => p.stock < 150).length;

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-cubes-stacked"></i></div>
        <div><span class="text-xs text-muted">إجمالي الشكاير بالمخزن</span><h4 class="text-primary-color">${totalSacks} شكارة</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-boxes-packing"></i></div>
        <div><span class="text-xs text-muted">عدد الأصناف المسجلة</span><h4>${products.length} أصناف</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-amber"><i class="fa-solid fa-calculator"></i></div>
        <div><span class="text-xs text-muted">تقييم المخزون بالتكلفة</span><h4 class="text-success">${App.formatCurrency(totalVal)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-rose"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div><span class="text-xs text-muted">أصناف اقتربت من النفاد</span><h4 class="text-danger">${lowCount} صنف</h4></div>
      </div>
    `;
  } else if (page === 'customers') {
    const customers = App.db.customers;
    const totalDebts = customers.reduce((a, b) => a + b.totalDebt, 0);
    const debtorsCount = customers.filter(c => c.totalDebt > 0).length;

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-users"></i></div>
        <div><span class="text-xs text-muted">إجمالي العملاء المسجلين</span><h4>${customers.length} عميل</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-rose"><i class="fa-solid fa-hand-holding-dollar"></i></div>
        <div><span class="text-xs text-muted">إجمالي مديونيات العملاء</span><h4 class="text-danger">${App.formatCurrency(totalDebts)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-amber"><i class="fa-solid fa-clock"></i></div>
        <div><span class="text-xs text-muted">عملاء عليهم مستحقات</span><h4>${debtorsCount} عميل</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-purple"><i class="fa-solid fa-crown"></i></div>
        <div><span class="text-xs text-muted">عملاء VIP المميزين</span><h4>${customers.filter(c => c.rating && c.rating.includes('VIP')).length} عميل</h4></div>
      </div>
    `;
  } else if (page === 'hr') {
    const employees = App.db.employees;
    const totalSalaries = employees.reduce((a, b) => a + b.baseSalary, 0);
    const totalAdv = employees.reduce((a, b) => a + b.advances, 0);
    const totalAbs = employees.reduce((a, b) => a + b.absences, 0);

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-user-tie"></i></div>
        <div><span class="text-xs text-muted">إجمالي الموظفين والعمال</span><h4>${employees.length} موظف</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-money-bill-wave"></i></div>
        <div><span class="text-xs text-muted">مسير الرواتب الأساسية</span><h4 class="text-primary-color">${App.formatCurrency(totalSalaries)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-amber"><i class="fa-solid fa-hand-holding-hand"></i></div>
        <div><span class="text-xs text-muted">إجمالي السلف المستقطعة</span><h4 class="text-warning">${App.formatCurrency(totalAdv)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-rose"><i class="fa-solid fa-user-minus"></i></div>
        <div><span class="text-xs text-muted">إجمالي أيام الغياب</span><h4 class="text-danger">${totalAbs} أيام</h4></div>
      </div>
    `;
  } else if (page === 'expenses') {
    const expenses = App.db.expenses;
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-vault"></i></div>
        <div><span class="text-xs text-muted">رصيد الخزينة الحالي</span><h4 class="text-success">${App.formatCurrency(App.db.treasury)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-rose"><i class="fa-solid fa-wallet"></i></div>
        <div><span class="text-xs text-muted">إجمالي المصروفات</span><h4 class="text-danger">${App.formatCurrency(totalExp)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-file-invoice"></i></div>
        <div><span class="text-xs text-muted">عدد عمليات الصرف</span><h4>${expenses.length} عملية</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-purple"><i class="fa-solid fa-clock"></i></div>
        <div><span class="text-xs text-muted">الختم الزمني الآلي</span><h4 class="text-primary-color">نشط 🟢</h4></div>
      </div>
    `;
  } else if (page === 'suppliers') {
    const suppliers = App.db.suppliers || [];
    const totalBalance = suppliers.reduce((a, b) => a + (b.totalBalance || 0), 0);
    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-truck-field"></i></div>
        <div><span class="text-xs text-muted">إجمالي المطاحن والموردين</span><h4>${suppliers.length} مطحن</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-wheat-awn"></i></div>
        <div><span class="text-xs text-muted">أنواع الدقيق الموردة</span><h4>3 درجات دقيق</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-amber"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div><span class="text-xs text-muted">إجمالي مستحقات المطاحن</span><h4 class="text-danger">${App.formatCurrency(totalBalance)}</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-purple"><i class="fa-solid fa-circle-check"></i></div>
        <div><span class="text-xs text-muted">حالة توريدات الخامات</span><h4 class="text-success">مستقرة 🟢</h4></div>
      </div>
    `;
  } else if (page === 'users') {
    const users = App.db.users || [];
    const activeCount = users.filter(u => u.status === 'نشط').length;
    const disabledCount = users.filter(u => u.status === 'معطل').length;
    const adminCount = users.filter(u => u.role === 'مدير عام' || u.username === 'admin').length;

    cardsHTML = `
      <div class="summary-card-item">
        <div class="summary-card-icon icon-emerald"><i class="fa-solid fa-users"></i></div>
        <div><span class="text-xs text-muted">إجمالي الحسابات المسجلة</span><h4>${users.length} حسابات</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-blue"><i class="fa-solid fa-user-check"></i></div>
        <div><span class="text-xs text-muted">الحسابات النشطة</span><h4 class="text-success">${activeCount} حساب</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-rose"><i class="fa-solid fa-user-xmark"></i></div>
        <div><span class="text-xs text-muted">الحسابات المعطلة</span><h4 class="${disabledCount > 0 ? 'text-danger' : 'text-muted'}">${disabledCount} حساب</h4></div>
      </div>
      <div class="summary-card-item">
        <div class="summary-card-icon icon-purple"><i class="fa-solid fa-user-shield"></i></div>
        <div><span class="text-xs text-muted">مدراء النظام (Super Admins)</span><h4 class="text-primary-color">${adminCount}</h4></div>
      </div>
    `;
  }

  container.innerHTML = cardsHTML;
}

// Mobile Sidebar Drawer Toggle & Overlay Management
function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  let overlay = document.querySelector('.mobile-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
    overlay.onclick = closeMobileMenu;
  }

  if (sidebar) {
    const willOpen = !sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', willOpen);
    overlay.classList.toggle('active', willOpen);
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
}

// Render Navigation Bar & Notifications Trigger Component
function renderAppLayout(activePage = 'dashboard') {
  // Page Access Guard
  if (typeof App !== 'undefined' && typeof App.checkPageAccess === 'function') {
    App.checkPageAccess(activePage);
  }

  const currentUser = (typeof App !== 'undefined' && typeof App.getCurrentUser === 'function') ? App.getCurrentUser() : { name: 'المدير العام', role: 'مدير عام', username: 'admin' };
  const userInitial = (currentUser.name || 'إ').trim().charAt(0);

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
    const showDashboard = !App || App.hasPermission('dashboard');
    const showSales = !App || App.hasPermission('sales');
    const showInventory = !App || App.hasPermission('inventory');
    const showSuppliers = !App || App.hasPermission('suppliers');
    const showCustomers = !App || App.hasPermission('customers');
    const showHR = !App || App.hasPermission('hr');
    const showExpenses = !App || App.hasPermission('expenses');
    const showReports = !App || App.hasPermission('reports');
    const showUsers = isSuperAdmin || (App && App.hasPermission('users'));
    const showNotifs = isSuperAdmin;

    sidebarContainer.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand-icon" style="background: transparent; overflow: hidden; padding: 2px; box-shadow: none;">
            <img src="image/logo.png" alt="شعار مصنع الإيمان" style="width: 100%; height: 100%; object-fit: contain;">
          </div>
          <div class="brand-info">
            <h2>مصنع الإيمان</h2>
            <span>نظام ERP للمكرونة</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${showDashboard ? `
            <a href="index.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-chart-pie"></i>
                <span>لوحة التحكم</span>
              </div>
            </a>
          ` : ''}

          ${showSales ? `
            <a href="sales.html" class="nav-item ${activePage === 'sales' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-file-invoice-dollar"></i>
                <span>المبيعات والفواتير</span>
              </div>
            </a>
          ` : ''}

          ${showInventory ? `
            <a href="inventory.html" class="nav-item ${activePage === 'inventory' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-boxes-stacked"></i>
                <span>المخازن والمنتجات</span>
              </div>
            </a>
          ` : ''}

          ${showSuppliers ? `
            <a href="suppliers.html" class="nav-item ${activePage === 'suppliers' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-truck-field"></i>
                <span>الموردين (المطاحن)</span>
              </div>
            </a>
          ` : ''}

          ${showCustomers ? `
            <a href="customers.html" class="nav-item ${activePage === 'customers' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-users"></i>
                <span>حسابات العملاء</span>
              </div>
            </a>
          ` : ''}

          ${showHR ? `
            <a href="hr.html" class="nav-item ${activePage === 'hr' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-user-tie"></i>
                <span>الموارد البشرية</span>
              </div>
            </a>
          ` : ''}

          ${showExpenses ? `
            <a href="expenses.html" class="nav-item ${activePage === 'expenses' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-wallet"></i>
                <span>المصروفات والخزنة</span>
              </div>
            </a>
          ` : ''}

          ${showReports ? `
            <a href="reports.html" class="nav-item ${activePage === 'reports' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-chart-line"></i>
                <span>الجرد والتقارير</span>
              </div>
            </a>
          ` : ''}

          ${showUsers ? `
            <a href="users.html" class="nav-item ${activePage === 'users' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-users-gear"></i>
                <span>المستخدمين والصلاحيات</span>
              </div>
            </a>
          ` : ''}

          ${showNotifs ? `
            <a href="notifications.html" class="nav-item ${activePage === 'notifications' ? 'active' : ''}">
              <div class="nav-item-content">
                <i class="fa-solid fa-bell"></i>
                <span>مركز الإشعارات</span>
              </div>
              <span class="nav-badge" id="sidebar-notif-badge">${(App.db.notifications || []).length}</span>
            </a>
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <div class="flex items-center justify-between">
            <div class="user-profile" title="${currentUser.email || currentUser.username}">
              <div class="user-avatar" style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; font-weight: bold;">${userInitial}</div>
              <div class="user-details">
                <h5 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${currentUser.name}</h5>
                <span class="text-xs" style="color: #059669; font-weight: bold;">${currentUser.role}</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button class="btn btn-secondary btn-sm" onclick="App.toggleTheme()" title="تبديل النمط"><i class="fa-solid fa-moon"></i></button>
              <button class="btn btn-secondary btn-sm" onclick="App.logout()" title="تسجيل الخروج" style="color: #dc2626;"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  // Inject Global Search Modal for Ctrl+K
  if (!document.getElementById('global-search-modal')) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.id = 'global-search-modal';
    modalBackdrop.innerHTML = `
      <div class="modal-card" style="max-width: 620px; margin-top: 6vh; align-self: flex-start;">
        <div class="modal-header p-4">
          <div class="search-box-global" style="width: 100%; position: relative;">
            <i class="fa-solid fa-magnifying-glass search-icon" style="position: absolute; right: 16px; top: 14px; color: var(--text-muted);"></i>
            <input type="text" id="global-search-modal-input" class="form-control" placeholder="بحث سريع في النظام (فواتير، عملاء، مطاحن، أصناف، موظفين...)" oninput="App.handleQuickModalSearch(this.value)" autocomplete="off" style="padding-right: 44px; height: 46px; border-radius: var(--radius-full);">
          </div>
          <button class="modal-close mr-2" onclick="closeModal('global-search-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body p-3" id="global-search-modal-results" style="max-height: 420px; overflow-y: auto;">
          <div class="p-4 text-center text-muted text-xs">ابدأ الكتابة للبحث السريع في كافة البيانات (أو اضغط Esc للرجوع)</div>
        </div>
        <div class="modal-footer p-3 flex justify-between text-xs text-muted" style="background: var(--bg-main);">
          <span>ابحث في الفواتير والعملاء والمطاحن والأسطول</span>
          <span>اضغط <kbd style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #334155; font-family: monospace;">ESC</kbd> للإغلاق</span>
        </div>
      </div>
    `;
    document.body.appendChild(modalBackdrop);
  }

  // Ensure header-title (right side) has NO bell/search buttons attached
  const headerTitle = document.querySelector('.top-header .header-title');
  if (headerTitle) {
    const titleDupes = headerTitle.querySelectorAll('button, .notif-bell-btn, .quick-search-trigger-btn, .search-box-global');
    titleDupes.forEach(el => el.remove());
  }

  // Inject Search Button and Notification Bell Curtain in .header-actions (left side)
  const topHeaderActions = document.querySelector('.top-header .header-actions');
  if (topHeaderActions) {
    // Remove static duplicate search buttons if any exist
    const duplicateBtns = topHeaderActions.querySelectorAll('.quick-search-trigger-btn, .search-btn-dup');
    duplicateBtns.forEach(btn => btn.remove());

    const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
    const existingNotifWrapper = document.getElementById('header-notif-wrapper');

    if (!isSuperAdmin && existingNotifWrapper) {
      existingNotifWrapper.remove();
    } else if (isSuperAdmin && !existingNotifWrapper) {
      const notifWrapper = document.createElement('div');
      notifWrapper.id = 'header-notif-wrapper';
      notifWrapper.className = 'notif-wrapper';
      notifWrapper.style.position = 'relative';
      notifWrapper.innerHTML = `
        <button class="notif-bell-btn" onclick="toggleNotificationsDropdown()" title="الإشعارات التنبيهية 🔔">
          <i class="fa-solid fa-bell"></i>
          <span class="notif-badge-count" id="header-notif-count">${(App.db.notifications || []).length}</span>
        </button>
        <div id="notif-dropdown-menu" class="notifications-dropdown">
          <div class="notif-dropdown-header">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-bell text-primary-color"></i>
              <strong class="text-sm">مركز الإشعارات والتنبيهات 🔔</strong>
            </div>
            <a href="notifications.html" class="text-xs font-bold text-primary">عرض الكل</a>
          </div>
          <div class="notif-dropdown-body" id="notif-dropdown-body">
            <!-- Injected via JS -->
          </div>
        </div>
      `;
      topHeaderActions.append(notifWrapper);
    }

    if (!document.getElementById('header-quick-search-btn')) {
      const searchBtn = document.createElement('button');
      searchBtn.id = 'header-quick-search-btn';
      searchBtn.className = 'btn btn-secondary';
      searchBtn.onclick = openGlobalSearchModal;
      searchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass text-primary-color"></i> <span>بحث سريع</span> <span class="badge badge-blue text-xs ml-1" style="font-family: monospace;">Ctrl+K</span>`;
      topHeaderActions.prepend(searchBtn);
    }
  }

  const footerContainer = document.getElementById('footer-container');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <footer class="app-footer">
        <p>حقوق التطوير والبرمجة محفوظة © 2026 | تطوير وبرمجة بواسطة شركة <a href="https://speed-up.tech/" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); font-weight: 800; text-decoration: underline; transition: var(--transition-fast);">Speed Up 🚀</a></p>
      </footer>
    `;
  }

  // Inject Mobile Bottom Navigation Dock (Native App Bar)
  let bottomNav = document.getElementById('app-mobile-bottom-nav');
  if (!bottomNav) {
    bottomNav = document.createElement('nav');
    bottomNav.id = 'app-mobile-bottom-nav';
    bottomNav.className = 'mobile-bottom-nav';
    document.body.appendChild(bottomNav);
  }

  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  const showDashboard = !App || App.hasPermission('dashboard');
  const showSales = !App || App.hasPermission('sales');
  const showInventory = !App || App.hasPermission('inventory');
  const showCustomers = !App || App.hasPermission('customers');

  const navItems = [];
  if (showDashboard) navItems.push({ key: 'dashboard', href: 'index.html', icon: 'fa-chart-pie', label: 'الرئيسية' });
  if (showSales) navItems.push({ key: 'sales', href: 'sales.html', icon: 'fa-file-invoice-dollar', label: 'المبيعات' });
  if (showInventory) navItems.push({ key: 'inventory', href: 'inventory.html', icon: 'fa-boxes-stacked', label: 'المخازن' });
  if (showCustomers) navItems.push({ key: 'customers', href: 'customers.html', icon: 'fa-users', label: 'العملاء' });

  // Menu button that opens the full drawer
  navItems.push({ key: 'menu', href: 'javascript:void(0)', onclick: 'toggleMobileMenu()', icon: 'fa-bars', label: 'القائمة ☰' });

  bottomNav.innerHTML = navItems.map(item => `
    <a href="${item.href}" ${item.onclick ? `onclick="${item.onclick}"` : ''} class="bottom-nav-item ${activePage === item.key ? 'active' : ''}">
      <i class="fa-solid ${item.icon}"></i>
      <span>${item.label}</span>
    </a>
  `).join('');

  App.updateNotificationBadge();
}

// Global Keyboard Shortcut: Ctrl+K or Cmd+K
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openGlobalSearchModal();
  }
});

function openGlobalSearchModal() {
  const modal = document.getElementById('global-search-modal');
  if (modal) {
    openModal('global-search-modal');
    const input = document.getElementById('global-search-modal-input');
    if (input) {
      input.value = '';
      input.focus();
      App.handleQuickModalSearch('');
    }
  }
}

// Executive Dashboard Comprehensive Report Print Trigger (Filtered by Today, Month, Year, or All)
function printDashboardComprehensiveReport(customFilter = null) {
  const filter = customFilter || window.currentDashboardFilter || 'today';
  
  let filterLabel = 'تقرير اليوم ☀️';
  if (filter === 'month') filterLabel = 'تقرير الشهر الحالي 🗓️';
  if (filter === 'year') filterLabel = 'تقرير السنة الحالية 📅';
  if (filter === 'all') filterLabel = 'تقرير كافة الأوقات (التراكمي) 📊';

  const container = document.getElementById('dashboard-report-body');
  if (!container) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);
  const currentYearStr = todayStr.substring(0, 4);

  const invoices = App.db.invoices || [];
  const expenses = App.db.expenses || [];
  const products = App.db.products || [];

  // Filter invoices by selected timeframe
  const filteredInvoices = invoices.filter(inv => {
    if (!inv.date) return true;
    const invDateStr = inv.date.split('T')[0];
    if (filter === 'today') return invDateStr === todayStr;
    if (filter === 'month') return invDateStr.startsWith(currentMonthStr);
    if (filter === 'year') return invDateStr.startsWith(currentYearStr);
    return true; // 'all'
  });

  // Filter expenses by selected timeframe
  const filteredExpenses = expenses.filter(exp => {
    if (!exp.date) return true;
    const expDateStr = exp.date.split('T')[0];
    if (filter === 'today') return expDateStr === todayStr;
    if (filter === 'month') return expDateStr.startsWith(currentMonthStr);
    if (filter === 'year') return expDateStr.startsWith(currentYearStr);
    return true; // 'all'
  });

  let totalSales = 0;
  let totalSacks = 0;
  let totalCOGS = 0;

  filteredInvoices.forEach(inv => {
    totalSales += inv.grandTotal;
    (inv.items || []).forEach(item => {
      totalSacks += item.qty;
      const prd = products.find(p => p.id === item.id);
      const cost = prd ? prd.costPrice : (item.price * 0.8);
      totalCOGS += (cost * item.qty);
    });
  });

  const totalExp = filteredExpenses.reduce((a, b) => a + (b.amount || 0), 0);
  const netProfit = totalSales - totalCOGS - totalExp;

  container.innerHTML = `
    <div id="printable-dashboard-report" class="p-6 bg-white rounded-xl border">
      <!-- Modal Filter Selector (No-Print Controls) -->
      <div class="flex justify-between items-center border-b pb-4 mb-4 flex-wrap gap-3 no-print">
        <span class="text-sm font-bold text-slate-700">تغيير نطاق الفترة الزمنية للتقرير:</span>
        <div class="flex gap-2 flex-wrap">
          <button class="btn ${filter === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="printDashboardComprehensiveReport('today')">اليوم ☀️</button>
          <button class="btn ${filter === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="printDashboardComprehensiveReport('month')">الشهر الحالي 🗓️</button>
          <button class="btn ${filter === 'year' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="printDashboardComprehensiveReport('year')">السنة الحالية 📅</button>
          <button class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="printDashboardComprehensiveReport('all')">كافة الأوقات 📊</button>
        </div>
      </div>

      <div class="flex justify-between items-center border-b pb-4 mb-4">
        <div class="flex items-center gap-3">
          <img src="image/logo.png" alt="شعار مصنع الإيمان" style="height: 52px; width: 52px; object-fit: contain;">
          <div>
            <h2 class="text-primary-color font-bold" style="font-size: 1.5rem; margin: 0;">مصنع الإيمان للمكرونة</h2>
            <p class="text-xs text-muted" style="margin: 2px 0;">التقرير التنفيذي الشامل للتحليل المالي والمخزون</p>
          </div>
        </div>
        <div class="text-left">
          <strong class="text-primary-color font-bold" style="font-size: 1.1rem; block">${filterLabel}</strong>
          <p class="text-xs text-muted mt-1">تاريخ التقرير: ${App.getFormattedCurrentDate()}</p>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="card bg-light p-3 border">
          <span class="text-xs text-muted font-bold block">إيرادات المبيعات المباشرة</span>
          <h3 class="text-success font-bold mt-1">${App.formatCurrency(totalSales)}</h3>
        </div>
        <div class="card bg-light p-3 border">
          <span class="text-xs text-muted font-bold block">إجمالي الشكاير المباعة</span>
          <h3 class="text-primary-color font-bold mt-1">${totalSacks} شكارة</h3>
        </div>
        <div class="card bg-light p-3 border">
          <span class="text-xs text-muted font-bold block">المصروفات التشغيلية</span>
          <h3 class="text-danger font-bold mt-1">${App.formatCurrency(totalExp)}</h3>
        </div>
        <div class="card bg-light p-3 border" style="background: var(--primary-light);">
          <span class="text-xs text-muted font-bold block">صافي الربح التنفيذي</span>
          <h3 class="text-primary-color font-bold mt-1">${App.formatCurrency(netProfit)}</h3>
        </div>
      </div>

      <h4 class="font-bold mb-3">سجل وجرد أصناف المكرونة بالشكارة بسعر التكلفة والبيع</h4>
      <table class="table mb-4" style="width: 100%; border: 1px solid #e2e8f0;">
        <thead style="background: #f8fafc;">
          <tr>
            <th style="padding: 8px;">كود الصنف</th>
            <th style="padding: 8px;">اسم المنتج</th>
            <th style="padding: 8px;">الكمية المتاحة بالشكارة</th>
            <th style="padding: 8px;">سعر التكلفة</th>
            <th style="padding: 8px;">سعر البيع</th>
            <th style="padding: 8px;">إجمالي التقييم المخزني</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td style="padding: 8px;"><strong>${p.id}</strong></td>
              <td style="padding: 8px;"><strong>${p.name}</strong></td>
              <td style="padding: 8px;">${p.stock} شكارة</td>
              <td style="padding: 8px;">${App.formatCurrency(p.costPrice)}</td>
              <td style="padding: 8px;">${App.formatCurrency(p.sellPrice)}</td>
              <td style="padding: 8px;"><strong class="text-success">${App.formatCurrency(p.stock * p.costPrice)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="flex justify-between items-center border-t pt-4 text-xs text-muted">
        <p>* تقرير تنفيذي شامل معتمد صادر رسمياً من نظام مصنع الإيمان للمكرونة (ERP System).</p>
        <p>توقيع المدير المسؤول: ______________________</p>
      </div>
    </div>
  `;

  openModal('dashboard-report-modal');
}

/* ==========================================================================
   PWA Installation Engine & Service Worker Registration
   ========================================================================== */
let deferredPWAInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ Service Worker registered successfully for PWA'))
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  
  // Show customized installation prompt if not previously dismissed in session
  if (!sessionStorage.getItem('pwa_install_prompt_shown')) {
    setTimeout(() => {
      showPWAInstallModal();
    }, 1200);
  }
});

function showPWAInstallModal() {
  if (document.getElementById('pwa-install-banner-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'pwa-install-banner-modal';
  modal.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 20px;
    right: 20px;
    max-width: 450px;
    margin: 0 auto;
    background: #ffffff;
    border: 2px solid #059669;
    border-radius: 16px;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25), 0 0 20px rgba(5,150,105,0.2);
    padding: 16px 18px;
    z-index: 999999;
    font-family: 'Cairo', sans-serif;
    direction: rtl;
    text-align: right;
    animation: pwaSlideUp 0.35s ease-out;
  `;

  modal.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <img src="image/logo.png" alt="شعار" style="width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; background: #ecfdf5; border-radius: 10px; padding: 3px; border: 1px solid #a7f3d0;">
      <div>
        <h3 style="margin: 0; color: #0f172a; font-size: 1.02rem; font-weight: 800;">تثبيت تطبيق مصنع الإيمان 📲</h3>
        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 0.78rem;">هل تريد تثبيت التطبيق على جهازك لسهولة وسرعة الوصول بدون متصفح؟</p>
      </div>
    </div>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button type="button" onclick="dismissPWAInstall()" style="background: #f1f5f9; color: #475569; border: none; border-radius: 8px; padding: 7px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; font-family: 'Cairo', sans-serif;">لاحقاً</button>
      <button type="button" onclick="triggerPWAInstall()" style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none; border-radius: 8px; padding: 7px 16px; font-weight: 800; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.3); font-family: 'Cairo', sans-serif; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-download"></i> تثبيت التطبيق الآن ⚡
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  sessionStorage.setItem('pwa_install_prompt_shown', 'true');
}

function triggerPWAInstall() {
  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        App.showToast('تم بدء تثبيت تطبيق مصنع الإيمان على جهازك بنجاح! 📲✨', 'success');
      }
      deferredPWAInstallPrompt = null;
      dismissPWAInstall();
    });
  } else {
    dismissPWAInstall();
    App.showToast('لتثبيت التطبيق على الآيفون: اضغط على زر المشاركة (Share) ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) 📲', 'info');
  }
}

function dismissPWAInstall() {
  const modal = document.getElementById('pwa-install-banner-modal');
  if (modal) modal.remove();
}

