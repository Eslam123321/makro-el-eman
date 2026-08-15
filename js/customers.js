document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('customers');
  checkUpcomingDuePayments();
  loadCustomersTable();

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterCustomers(searchQuery);
    }
  }
});

function filterCustomers(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = App.db.customers.filter(c => 
    c.name.toLowerCase().includes(q) ||
    c.phone.includes(q) ||
    c.address.toLowerCase().includes(q) ||
    c.id.toLowerCase().includes(q)
  );
  loadCustomersTable(filtered);
}

function checkUpcomingDuePayments() {
  const alertContainer = document.getElementById('due-alerts-container');
  if (!alertContainer) return;

  const today = new Date();
  const customers = App.db.customers;
  const upcomingDebtors = [];

  customers.forEach(c => {
    if (c.totalDebt > 0 && c.dueDate) {
      const dueDate = new Date(c.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

      if (diffDays <= 2) {
        upcomingDebtors.push({ ...c, daysLeft: diffDays });
      }
    }
  });

  if (upcomingDebtors.length > 0) {
    alertContainer.innerHTML = upcomingDebtors.map(u => `
      <div class="card mb-4 p-4" style="background: var(--accent-amber-light); border-color: var(--accent-amber-border);">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-bell-concierge text-warning" style="font-size: 1.5rem;"></i>
            <div>
              <strong>تنبيه ميعاد سداد قريب للعميل: ${u.name}</strong>
              <div class="text-xs text-muted">مستحق سداد: <strong class="text-danger">${App.formatCurrency(u.totalDebt)}</strong> | تاريخ الاستحقاق: ${u.dueDate} (${u.daysLeft <= 0 ? 'مستحق اليوم أو متأخر' : 'متبقي ' + u.daysLeft + ' يوم'})</div>
            </div>
          </div>
          <button class="btn btn-warning btn-sm" onclick="openReceivePaymentModal('${u.id}')">تسجيل دفعة سداد 💰</button>
        </div>
      </div>
    `).join('');
  } else {
    alertContainer.innerHTML = '';
  }
}

function loadCustomersTable(customersData = null) {
  const tbody = document.getElementById('customers-list-tbody');
  if (!tbody) return;

  const customers = customersData || App.db.customers;
  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد عملاء مطبق عليهم شرط البحث</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const limit = c.creditLimit || 50000;
    const usedPercent = Math.min(100, Math.round((c.totalDebt / limit) * 100));

    return `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>
          <strong>${c.name}</strong>
          <div class="text-xs text-muted">${c.address}</div>
        </td>
        <td>${c.phone}</td>
        <td>
          <span class="badge ${c.rating && c.rating.includes('VIP') ? 'badge-warning' : 'badge-blue'}">
            <i class="fa-solid fa-crown ml-1"></i> ${c.rating || 'عميل عادي'}
          </span>
        </td>
        <td>
          <div class="flex flex-col gap-1">
            <strong class="${c.totalDebt > 0 ? 'text-danger' : 'text-success'}">
              ${App.formatCurrency(c.totalDebt)}
            </strong>
            <div class="text-xs text-muted">الحد: ${App.formatCurrency(limit)} (${usedPercent}%)</div>
            <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${usedPercent}%; height: 100%; background: ${usedPercent > 80 ? '#e11d48' : '#059669'};"></div>
            </div>
          </div>
        </td>
        <td>${c.dueDate ? `<span class="badge badge-warning">${c.dueDate}</span>` : '<span class="text-muted text-xs">لا يوجد مستحقات</span>'}</td>
        <td>
          <div class="flex gap-1 flex-wrap">
            <button class="btn btn-primary btn-sm" onclick="openReceivePaymentModal('${c.id}')"><i class="fa-solid fa-hand-holding-dollar"></i> تحصيل دفعة</button>
            <button class="btn btn-secondary btn-sm" onclick="openStatementModal('${c.id}')"><i class="fa-solid fa-file-lines"></i> كشف حساب</button>
            ${(typeof App !== 'undefined' && App.getCurrentUser() && (App.getCurrentUser().id === 'USR-1' || App.getCurrentUser().role === 'مدير عام')) ? `
              <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')" title="حذف العميل نهائياً"><i class="fa-solid fa-trash"></i> حذف</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Customer (Super Admin Only)
function deleteCustomer(customerId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف العملاء مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const cust = (App.db.customers || []).find(c => c.id === customerId);
  if (!cust) return;

  if (confirm(`تحذير: هل أنت متأكد من رغبتك في حذف العميل (${cust.name})؟ سيتم مسح بياناته نهائياً من قاعدة البيانات والسحابة.`)) {
    const custName = cust.name;
    App.db.customers = (App.db.customers || []).filter(c => c.id !== customerId);

    if (typeof App.logActivity === 'function') {
      App.logActivity('حذف عميل من النظام 🗑️', `تم حذف العميل (${custName}) نهائياً من السيستم`, 'danger');
    }

    App.save();
    loadCustomersTable();
    checkUpcomingDuePayments();
    if (typeof renderPageSummaryCards === 'function') renderPageSummaryCards('customers', 'customers-summary-cards');
    App.showToast(`تم حذف العميل (${custName}) نهائياً من النظام والسحابة 🗑️`, 'danger');
  }
}

function saveNewCustomer() {
  const nameEl = document.getElementById('cust-name');
  const phoneEl = document.getElementById('cust-phone');
  const addressEl = document.getElementById('cust-address');
  const limitEl = document.getElementById('cust-limit');
  const dueDateEl = document.getElementById('cust-duedate');

  const name = nameEl ? nameEl.value.trim() : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const address = addressEl ? addressEl.value.trim() : '';
  const limit = parseFloat(limitEl ? limitEl.value : 0) || 50000;
  const rating = document.getElementById('cust-rating') ? document.getElementById('cust-rating').value : 'عميل عادي';
  const dueDate = dueDateEl ? dueDateEl.value : '';

  if (!name || !phone) {
    App.showToast('رجاء ادخل اسم العميل ورقم الهاتف', 'warning');
    return;
  }

  const newCust = {
    id: `CUST-${App.db.customers.length + 1}`,
    name: name,
    phone: phone,
    address: address || 'غير محدد',
    totalDebt: 0,
    creditLimit: limit,
    rating: rating,
    dueDate: dueDate || '',
    notes: 'عميل جديد'
  };

  App.db.customers.push(newCust);
  App.save();
  loadCustomersTable();
  if (document.getElementById('new-customer-modal')) closeModal('new-customer-modal');

  // Reset form inputs safely
  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (addressEl) addressEl.value = '';
  if (dueDateEl) dueDateEl.value = '';

  App.showToast(`تم تسجيل العميل الجديد (${newCust.name})`, 'success');
}

function openReceivePaymentModal(custId) {
  const cust = App.db.customers.find(c => c.id === custId);
  if (!cust) return;

  document.getElementById('pay-cust-id').value = cust.id;
  document.getElementById('pay-cust-title').textContent = `${cust.name} - المستحق عليه: ${App.formatCurrency(cust.totalDebt)}`;
  document.getElementById('pay-amount').value = '';

  openModal('receive-payment-modal');
}

function processPaymentReceipt() {
  const custId = document.getElementById('pay-cust-id').value;
  const amountInput = document.getElementById('pay-amount');
  const amount = parseFloat(amountInput.value) || 0;

  if (amount <= 0) {
    App.showToast('رجاء ادخل قيمة المبلغ المحصل من العميل', 'warning');
    return;
  }

  const cust = App.db.customers.find(c => c.id === custId);
  if (!cust) return;

  cust.totalDebt = Math.max(0, cust.totalDebt - amount);
  if (cust.totalDebt === 0) {
    cust.dueDate = '';
  }

  App.db.treasury += amount;

  App.save();
  loadCustomersTable();
  checkUpcomingDuePayments();
  closeModal('receive-payment-modal');

  App.showToast(`تم تحصيل ${App.formatCurrency(amount)} وإيداعها في الخزنة 💰`, 'success');
}

function openStatementModal(custId) {
  const cust = App.db.customers.find(c => c.id === custId);
  if (!cust) return;

  const invoices = App.db.invoices.filter(i => i.customerId === custId);
  const container = document.getElementById('statement-modal-body');

  container.innerHTML = `
    <div id="printable-statement" class="p-6 bg-white rounded-xl border">
      <div class="flex justify-between items-center border-b pb-4 mb-4">
        <div class="flex items-center gap-3">
          <img src="image/logo.png" alt="شعار مصنع الإيمان" style="height: 52px; width: 52px; object-fit: contain;">
          <div>
            <h2 class="text-primary-color font-bold" style="font-size: 1.5rem; margin: 0;">مصنع الإيمان للمكرونة</h2>
            <p class="text-xs text-muted" style="margin: 2px 0;">كشف حساب مالي تفصيلي للعميل</p>
          </div>
        </div>
        <div class="text-left">
          <strong>العميل: ${cust.name} (${cust.rating || 'عميل'})</strong>
          <p class="text-xs text-muted">الهاتف: ${cust.phone}</p>
          <p class="text-xs text-muted">العنوان: ${cust.address}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="card bg-light p-3">
          <span class="text-xs text-muted">إجمالي المبيعات والمسحوبات</span>
          <h3 class="text-primary-color mt-1">${App.formatCurrency(invoices.reduce((a, b) => a + b.grandTotal, 0))}</h3>
        </div>
        <div class="card bg-light p-3">
          <span class="text-xs text-muted">رصيد المديونية المتبقي</span>
          <h3 class="text-danger mt-1">${App.formatCurrency(cust.totalDebt)}</h3>
        </div>
      </div>

      <h4 class="font-bold mb-2">سجل الفواتير والمسحوبات بالشكارة</h4>
      <table class="table mb-4">
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th>التاريخ والوقت</th>
            <th>القيمة الإجمالية</th>
            <th>المسدد</th>
            <th>المتبقي</th>
            <th class="no-print">طباعة المعاينة</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.length > 0 ? invoices.map(i => `
            <tr>
              <td><strong>${i.id}</strong></td>
              <td>${App.formatTimestamp(i.date)}</td>
              <td>${App.formatCurrency(i.grandTotal)}</td>
              <td>${App.formatCurrency(i.paidAmount)}</td>
              <td><strong class="text-danger">${App.formatCurrency(i.remainingAmount)}</strong></td>
              <td class="no-print">
                <button class="btn btn-secondary btn-sm" onclick="openInvoiceGlobalPreview('${i.id}')" title="معاينة وطباعة الفاتورة الرسمية">
                  <i class="fa-solid fa-print text-primary-color"></i> طباعة الفاتورة 𝓅
                </button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center text-muted">لا يوجد فواتير مسجلة لهذا العميل</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  openModal('statement-modal');
}
