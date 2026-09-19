/* ==========================================================================
   مصنع الإيمان للمكرونة - Suppliers & Flour Mills Script
   Pure JavaScript (ES6+) - Per-Mill Custom Pricing & Account Ledger
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('suppliers');
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  loadSuppliersTable();
  initSupplierInvoiceForm();
  loadSupplierInvoicesTable();

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterSuppliers(searchQuery);
    }
  }
});

function loadSuppliersTable(suppliersData = null) {
  const tbody = document.getElementById('suppliers-list-tbody');
  if (!tbody) return;

  const suppliers = suppliersData || App.db.suppliers || [];

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد مطاحن أو موردين مسجلين حالياً</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td><strong>${s.id}</strong></td>
      <td>
        <strong>${s.name}</strong>
        <div class="text-xs text-muted">${s.notes || ''}</div>
      </td>
      <td>
        <div><strong>${s.phone}</strong></div>
        <div class="text-xs text-muted">${s.address}</div>
      </td>
      <td><span class="badge badge-purple">${s.flourType}</span></td>
      <td><strong class="text-primary-color">${App.formatCurrency(s.unitPrice)} / طن</strong></td>
      <td>
        <strong class="${s.totalBalance > 0 ? 'text-danger' : 'text-success'}">
          ${App.formatCurrency(s.totalBalance)}
        </strong>
      </td>
      <td>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" onclick="openSupplyBatchModal('${s.id}')"><i class="fa-solid fa-truck-ramp-box"></i> توريد دقيق</button>
          <button class="btn btn-secondary btn-sm" onclick="openPaySupplierModal('${s.id}')"><i class="fa-solid fa-hand-holding-dollar"></i> سداد دفعة</button>
          <button class="btn btn-secondary btn-sm" onclick="openSupplierStatementModal('${s.id}')"><i class="fa-solid fa-file-lines"></i> كشف حساب</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditSupplierModal('${s.id}')" title="تعديل بيانات المطحن والسعر"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.id}')" title="حذف المطحن"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterSuppliers(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = (App.db.suppliers || []).filter(s => 
    s.name.toLowerCase().includes(q) ||
    s.phone.includes(q) ||
    s.flourType.toLowerCase().includes(q) ||
    s.id.toLowerCase().includes(q)
  );
  loadSuppliersTable(filtered);
}

function updateBatchLiveTotal() {
  const qtyTons = parseFloat(document.getElementById('batch-tons-qty').value) || 0;
  const unitPrice = parseFloat(document.getElementById('batch-unit-price').value) || 0;
  const total = qtyTons * unitPrice;
  const liveEl = document.getElementById('batch-live-total');
  if (liveEl) liveEl.textContent = App.formatCurrency(total);
}

function saveNewSupplier() {
  const name = document.getElementById('sup-name').value.trim();
  const phone = document.getElementById('sup-phone').value.trim();
  const flourType = document.getElementById('sup-flour-type').value;
  const price = parseFloat(document.getElementById('sup-price').value) || 0;
  const address = document.getElementById('sup-address').value.trim();
  const notes = document.getElementById('sup-notes').value.trim();
  const initialTonsInput = document.getElementById('sup-initial-tons');
  const initialTons = initialTonsInput ? (parseFloat(initialTonsInput.value) || 0) : 0;
  const openingBalanceInput = document.getElementById('sup-opening-balance');
  const openingBalance = openingBalanceInput ? (parseFloat(openingBalanceInput.value) || 0) : 0;

  if (!name || !phone || price <= 0) {
    App.showToast('رجاء ادخل اسم المطحن، الهاتف، وسعر التوريد المحدد', 'warning');
    return;
  }

  const initialShipmentCost = initialTons * price;
  const totalBalance = openingBalance + initialShipmentCost;

  const newSup = {
    id: `SUP-${String((App.db.suppliers || []).length + 101)}`,
    name: name,
    phone: phone,
    address: address || 'المنطقة الصناعية',
    flourType: flourType,
    unitPrice: price,
    totalBalance: totalBalance,
    batches: [],
    payments: [],
    notes: notes || 'تعامل جديد'
  };

  if (initialTons > 0) {
    newSup.batches.push({
      id: `BATCH-${Date.now().toString().slice(-4)}`,
      qtyTons: initialTons,
      unitPrice: price,
      totalCost: initialShipmentCost,
      refNum: 'شحنة افتتاحية أولى',
      date: App.getNowISO(),
      flourType: flourType
    });
  }

  if (!App.db.suppliers) App.db.suppliers = [];
  App.db.suppliers.push(newSup);
  App.save();

  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  if (document.getElementById('new-supplier-modal')) closeModal('new-supplier-modal');

  // Reset form inputs
  document.getElementById('sup-name').value = '';
  document.getElementById('sup-phone').value = '';
  document.getElementById('sup-price').value = '';
  document.getElementById('sup-address').value = '';
  document.getElementById('sup-notes').value = '';
  if (initialTonsInput) initialTonsInput.value = '';
  if (openingBalanceInput) openingBalanceInput.value = '';

  App.showToast(`تم إضافة المطحن/المورد (${newSup.name}) واحتساب المستحقات بنجاح 🌾`, 'success');
}

function openSupplyBatchModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  document.getElementById('batch-sup-id').value = sup.id;
  document.getElementById('batch-sup-title').textContent = `المطحن: ${sup.name} | نوع الدقيق: ${sup.flourType} | الرصيد الحالي: ${App.formatCurrency(sup.totalBalance || 0)}`;
  document.getElementById('batch-unit-price').value = sup.unitPrice;
  document.getElementById('batch-tons-qty').value = '';
  document.getElementById('batch-ref-num').value = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const liveEl = document.getElementById('batch-live-total');
  if (liveEl) liveEl.textContent = '0 ج.م';

  openModal('supply-batch-modal');
}

function processFlourSupplyBatch() {
  const supId = document.getElementById('batch-sup-id').value;
  const qtyTons = parseFloat(document.getElementById('batch-tons-qty').value) || 0;
  const unitPrice = parseFloat(document.getElementById('batch-unit-price').value) || 0;
  const refNum = document.getElementById('batch-ref-num').value.trim();

  if (qtyTons <= 0 || unitPrice <= 0) {
    App.showToast('رجاء ادخل كمية الدقيق بالطن وسعر الطن الصحيح', 'warning');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  const totalCost = qtyTons * unitPrice;
  sup.totalBalance = (sup.totalBalance || 0) + totalCost;
  sup.unitPrice = unitPrice;

  if (!sup.batches) sup.batches = [];
  sup.batches.unshift({
    id: `BATCH-${Date.now().toString().slice(-4)}`,
    qtyTons: qtyTons,
    unitPrice: unitPrice,
    totalCost: totalCost,
    refNum: refNum || 'بدون إذن',
    date: App.getNowISO(),
    flourType: sup.flourType || 'دقيق فاخر استخراج 72%'
  });

  if (typeof App.logActivity === 'function') {
    App.logActivity('استلام شحنة دقيق 🌾', `تم تسجيل توريد (${qtyTons} طن) دقيق من المطحن (${sup.name}) بقيمة (${App.formatCurrency(totalCost)})`, 'info');
  }

  App.save();
  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  closeModal('supply-batch-modal');

  App.showToast(`تم إيداع شحنة (${qtyTons} طن) دقيق وإضافة ${App.formatCurrency(totalCost)} لحساب المطحن بنجاح 🌾`, 'success');
}

function openPaySupplierModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  document.getElementById('pay-sup-id').value = sup.id;
  document.getElementById('pay-sup-title').textContent = `${sup.name} - المستحق له حالياً: ${App.formatCurrency(sup.totalBalance)}`;
  document.getElementById('pay-sup-amount').value = '';

  openModal('pay-supplier-modal');
}

function processSupplierPayment() {
  const supId = document.getElementById('pay-sup-id').value;
  const amount = parseFloat(document.getElementById('pay-sup-amount').value) || 0;
  const methodSelect = document.getElementById('pay-sup-method');
  const method = methodSelect ? methodSelect.value : 'كاش (نقداً من الخزينة)';
  const notes = document.getElementById('pay-sup-notes').value.trim();

  if (amount <= 0) {
    App.showToast('رجاء ادخل المبلغ المراد سداده للمطحن', 'warning');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  sup.totalBalance = Math.max(0, (sup.totalBalance || 0) - amount);

  // If cash, deduct from Treasury
  if (method.includes('كاش')) {
    App.db.treasury = Math.max(0, App.db.treasury - amount);
  }

  if (!sup.payments) sup.payments = [];
  sup.payments.unshift({
    id: `PAY-${Date.now().toString().slice(-4)}`,
    amount: amount,
    method: method,
    date: App.getNowISO(),
    notes: notes || `سداد دفعة للمطحن (${method})`
  });

  if (typeof App.logActivity === 'function') {
    App.logActivity('سداد دفعة لمطحن 💰', `تم سداد (${App.formatCurrency(amount)}) للمطحن (${sup.name}) عبر (${method})`, 'warning');
  }

  App.save();
  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  closeModal('pay-supplier-modal');

  App.showToast(`تم سداد ${App.formatCurrency(amount)} للمطحن (${sup.name}) بنجاح 💰`, 'success');
}

function openSupplierStatementModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  const container = document.getElementById('supplier-statement-body');
  const batches = sup.batches || [];
  const payments = sup.payments || [];
  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  container.innerHTML = `
    <div id="printable-supplier-statement" class="p-6 bg-white rounded-xl border">
      <div class="flex justify-between items-center border-b pb-4 mb-4">
        <div class="flex items-center gap-3">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 52px; width: 52px; object-fit: contain;">
          <div>
            <h2 class="text-primary-color font-bold" style="font-size: 1.5rem; margin: 0;">مصنع الإيمان للمكرونة</h2>
            <p class="text-xs text-muted" style="margin: 2px 0;">كشف حساب ومعاملات مطحن الدقيق الخام</p>
          </div>
        </div>
        <div class="text-left">
          <strong>المطحن: ${sup.name}</strong>
          <p class="text-xs text-muted">نوع الدقيق: ${sup.flourType}</p>
          <p class="text-xs text-muted">الهاتف: ${sup.phone} | ${sup.address || ''}</p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="card bg-light p-4">
          <span class="text-xs text-muted">سعر الطن المعتمد</span>
          <h3 class="text-primary-color mt-1">${App.formatCurrency(sup.unitPrice)}</h3>
        </div>
        <div class="card bg-light p-4">
          <span class="text-xs text-muted">نوع الخامة الموردة</span>
          <h4 class="text-secondary mt-1">${sup.flourType}</h4>
        </div>
        <div class="card bg-light p-4" style="background: #fee2e2; border-color: #fca5a5;">
          <span class="text-xs text-muted font-bold text-danger">صافي المستحقات المتبقية للمطحن</span>
          <h2 class="text-danger font-bold mt-1">${App.formatCurrency(sup.totalBalance)}</h2>
        </div>
      </div>

      <h4 class="font-bold mb-3"><i class="fa-solid fa-truck-ramp-box text-primary-color ml-1"></i> سجل شحنات وتوريدات الدقيق الواردة</h4>
      <table class="table mb-6">
        <thead>
          <tr>
            <th>كود الشحنة</th>
            <th>الكمية (بالطن)</th>
            <th>سعر الطن</th>
            <th>القيمة الإجمالية</th>
            <th>رقم الإذن / الملاحظات</th>
            <th>التاريخ والوقت</th>
          </tr>
        </thead>
        <tbody>
          ${batches.length > 0 ? batches.map(b => `
            <tr>
              <td><strong>${b.id}</strong></td>
              <td><span class="badge badge-purple">${b.qtyTons} طن</span></td>
              <td>${App.formatCurrency(b.unitPrice)}</td>
              <td><strong class="text-danger">${App.formatCurrency(b.totalCost)}</strong></td>
              <td>${b.refNum || '-'}</td>
              <td>${App.formatTimestamp(b.date)}</td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center text-muted">لا يوجد شحنات مسجلة لهذا المطحن</td></tr>'}
        </tbody>
      </table>

      <h4 class="font-bold mb-3"><i class="fa-solid fa-money-bill-wave text-success ml-1"></i> سجل الدفعات وسندات الصرف المسددة</h4>
      <table class="table mb-4">
        <thead>
          <tr>
            <th>كود السداد</th>
            <th>المبلغ المسدد</th>
            <th>طريقة السداد</th>
            <th>الملاحظات والبيان</th>
            <th>التاريخ والوقت</th>
          </tr>
        </thead>
        <tbody>
          ${payments.length > 0 ? payments.map(p => `
            <tr>
              <td><strong>${p.id}</strong></td>
              <td><strong class="text-success">${App.formatCurrency(p.amount)}</strong></td>
              <td><span class="badge badge-secondary">${p.method || 'كاش'}</span></td>
              <td>${p.notes || 'سداد دفعة للمطحن'}</td>
              <td>${App.formatTimestamp(p.date)}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="text-center text-muted">لا يوجد دفعات مسددة مسجلة بعد</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  openModal('supplier-statement-modal');
}

function printSuppliersRegistry() {
  const suppliers = App.db.suppliers || [];
  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
  const totalDues = suppliers.reduce((sum, s) => sum + (s.totalBalance || 0), 0);
  const uniqueFlourTypes = new Set(suppliers.map(s => s.flourType)).size;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>كشف حساب وسجل المطاحن الشامل - مصنع الإيمان</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Cairo', sans-serif; padding: 15px; direction: rtl; color: #0f172a; margin: 0; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
        .logo-box { display: flex; align-items: center; gap: 12px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; text-align: center; background: #f8fafc; }
        .kpi-card span { font-size: 11px; color: #64748b; display: block; font-weight: 700; margin-bottom: 2px; }
        .kpi-card strong { font-size: 13px; color: #0f172a; display: block; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; }
        th { background: #f8fafc; font-weight: 800; color: #1e293b; border-bottom: 2px solid #94a3b8; }
        .total-box { margin-top: 15px; padding: 10px 14px; background: #fee2e2; border-radius: 6px; font-weight: bold; text-align: left; font-size: 12px; }
        .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: 25px; border-top: 2px solid #cbd5e1; padding-top: 15px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-box">
          <img src="${logoSrc}" style="height: 55px; width: 55px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; margin: 0; font-size: 1.3rem;">مصنع الإيمان للمكرونة 🌾</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">إدارة الموردين والمطاحن | كشف حساب ومسحوبات الدقيق الخام</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">سجل المطاحن المعتمد</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span>إجمالي المطاحن والموردين</span>
          <strong>${suppliers.length} مطحن</strong>
        </div>
        <div class="kpi-card">
          <span>أنواع الدقيق الموردة</span>
          <strong>${uniqueFlourTypes || 3} درجات دقيق</strong>
        </div>
        <div class="kpi-card" style="background: #fef2f2; border-color: #fecaca;">
          <span style="color: #b91c1c;">إجمالي المستحقات (علينا)</span>
          <strong style="color: #dc2626;">${App.formatCurrency(totalDues)}</strong>
        </div>
        <div class="kpi-card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <span style="color: #15803d;">حالة توريدات الخامات</span>
          <strong style="color: #15803d;">مستقرة 🟢</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>كود المطحن</th>
            <th>اسم المطحن / المورد</th>
            <th>الهاتف والعنوان</th>
            <th>نوع الدقيق المورد</th>
            <th>سعر الطن المعتمد</th>
            <th>المستحقات المتبقية للمطحن</th>
          </tr>
        </thead>
        <tbody>
          ${suppliers.map((s, idx) => `
            <tr>
              <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
              <td><strong>${s.id}</strong></td>
              <td><strong>${s.name}</strong></td>
              <td>${s.phone} ${s.address ? '- ' + s.address : ''}</td>
              <td>${s.flourType}</td>
              <td>${App.formatCurrency(s.unitPrice)}</td>
              <td><strong style="color: ${s.totalBalance > 0 ? '#dc2626' : '#059669'};">${App.formatCurrency(s.totalBalance)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total-box">
        إجمالي مستحقات مطاحن الدقيق المتبقية (علينا): <span style="color: #dc2626; font-size: 15px;">${App.formatCurrency(totalDues)}</span>
      </div>

      <div class="footer-signatures">
        <div>إعداد ومراجعة المشتريات: ____________________</div>
        <div>رئيس الحسابات: ____________________</div>
        <div>اعتماد المدير العام: ____________________</div>
      </div>

      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function openEditSupplierModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  document.getElementById('edit-sup-id').value = sup.id;
  document.getElementById('edit-sup-name').value = sup.name;
  document.getElementById('edit-sup-phone').value = sup.phone;
  document.getElementById('edit-sup-flour-type').value = sup.flourType;
  document.getElementById('edit-sup-price').value = sup.unitPrice;
  document.getElementById('edit-sup-address').value = sup.address || '';
  document.getElementById('edit-sup-notes').value = sup.notes || '';

  openModal('edit-supplier-modal');
}

function updateSupplier() {
  const supId = document.getElementById('edit-sup-id').value;
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  const name = document.getElementById('edit-sup-name').value.trim();
  const phone = document.getElementById('edit-sup-phone').value.trim();
  const flourType = document.getElementById('edit-sup-flour-type').value;
  const price = parseFloat(document.getElementById('edit-sup-price').value) || 0;
  const address = document.getElementById('edit-sup-address').value.trim();
  const notes = document.getElementById('edit-sup-notes').value.trim();

  if (!name || !phone || price <= 0) {
    App.showToast('رجاء ادخل اسم المطحن، الهاتف، وسعر التوريد المحدد', 'warning');
    return;
  }

  sup.name = name;
  sup.phone = phone;
  sup.flourType = flourType;
  sup.unitPrice = price;
  sup.address = address;
  sup.notes = notes;

  App.save();
  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  closeModal('edit-supplier-modal');
  App.showToast(`تم تحديث بيانات المطحن/المورد (${sup.name}) بنجاح 🌾`, 'success');
}

function deleteSupplier(supId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف الموردين والمطاحن مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  App.showConfirmModal({
    title: 'حذف مطحن / مورد',
    message: `هل أنت متأكد من حذف المطحن (${sup.name}) نهائياً من قاعدة البيانات والسحابة؟`,
    icon: 'fa-solid fa-truck-ramp-box',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف المطحن 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      const supName = sup.name;
      App.db.suppliers = (App.db.suppliers || []).filter(s => s.id !== supId);
      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف مطحن/مورد 🗑️', `تم حذف المطحن (${supName}) نهائياً من السيستم`, 'danger');
      }
      App.save();
      loadSuppliersTable();
      renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
      App.showToast(`تم حذف المطحن (${supName}) نهائياً من النظام والسحابة 🗑️`, 'danger');
    }
  });
}

/* ==========================================================================
   Supplier Flour Invoice Engine (Matches Sales POS System)
   ========================================================================== */

let currentSupplierDraftInvoice = null;

// Toggle Collapsible Add Supplier Form
function toggleAddSupplierForm() {
  const form = document.getElementById('add-supplier-section');
  if (!form) return;
  const isHidden = form.style.display === 'none' || getComputedStyle(form).display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    form.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('sup-name')?.focus();
  }
}

// Populate the Supplier Selector Dropdown
function initSupplierInvoiceForm() {
  const select = document.getElementById('inv-supplier-select');
  if (!select) return;

  const currentVal = select.value;
  const suppliers = App.db.suppliers || [];

  select.innerHTML = '<option value="">-- اختر المطحن / المورد --</option>' +
    suppliers.map(s => `
      <option value="${s.id}">
        ${s.name} (${s.phone}) - [سعر الطن: ${App.formatCurrency(s.unitPrice)}] - [مستحق: ${App.formatCurrency(s.totalBalance || 0)}]
      </option>
    `).join('');

  if (currentVal && suppliers.some(s => s.id === currentVal)) {
    select.value = currentVal;
  }
}

// Handler when user selects a supplier
function onSupplierSelected(supId) {
  if (!supId) {
    calculateSupplierInvoiceTotals();
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  const priceInput = document.getElementById('inv-sup-unit-price');
  if (priceInput) priceInput.value = sup.unitPrice || 0;

  const typeSelect = document.getElementById('inv-sup-flour-type');
  if (typeSelect && sup.flourType) typeSelect.value = sup.flourType;

  calculateSupplierInvoiceTotals();
  App.showToast(`تم اختيار المطحن: (${sup.name}) وتحديد سعر الطن (${App.formatCurrency(sup.unitPrice)})`, 'info');
}

// Real-time calculation of Supplier Invoice
function calculateSupplierInvoiceTotals() {
  const tons = parseFloat(document.getElementById('inv-sup-tons')?.value) || 0;
  const unitPrice = parseFloat(document.getElementById('inv-sup-unit-price')?.value) || 0;
  const discount = parseFloat(document.getElementById('inv-sup-discount')?.value) || 0;
  const paymentType = document.getElementById('inv-sup-payment-type')?.value || 'آجل';
  const paidInput = document.getElementById('inv-sup-paid');

  const subtotal = tons * unitPrice;
  const grandTotal = Math.max(0, subtotal - discount);

  let paid = 0;
  let remaining = grandTotal;

  if (paymentType === 'كاش') {
    paid = grandTotal;
    remaining = 0;
    if (paidInput) {
      paidInput.value = paid;
      paidInput.readOnly = true;
    }
  } else if (paymentType === 'آجل') {
    paid = 0;
    remaining = grandTotal;
    if (paidInput) {
      paidInput.value = 0;
      paidInput.readOnly = true;
    }
  } else if (paymentType === 'جزئي') {
    if (paidInput) {
      paidInput.readOnly = false;
      paid = Math.min(grandTotal, Math.max(0, parseFloat(paidInput.value) || 0));
    }
    remaining = Math.max(0, grandTotal - paid);
  }

  // Update Live Labels
  const subtotalEl = document.getElementById('inv-sup-subtotal');
  if (subtotalEl) subtotalEl.textContent = App.formatCurrency(subtotal);

  const discountEl = document.getElementById('inv-sup-discount-val');
  if (discountEl) discountEl.textContent = App.formatCurrency(discount);

  const grandTotalEl = document.getElementById('inv-sup-grand-total');
  if (grandTotalEl) grandTotalEl.textContent = App.formatCurrency(grandTotal);

  const paidEl = document.getElementById('inv-sup-paid-val');
  if (paidEl) paidEl.textContent = App.formatCurrency(paid);

  const remainingEl = document.getElementById('inv-sup-remaining-val');
  if (remainingEl) remainingEl.textContent = App.formatCurrency(remaining);

  return { tons, unitPrice, subtotal, discount, grandTotal, paid, remaining, paymentType };
}

// Preview current Draft Supplier Invoice
function previewCurrentSupplierInvoiceDraft() {
  const supId = document.getElementById('inv-supplier-select')?.value;
  if (!supId) {
    App.showToast('يرجى اختيار المطحن المورد أولاً', 'warning');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) {
    App.showToast('المطحن المحدد غير موجود', 'danger');
    return;
  }

  const totals = calculateSupplierInvoiceTotals();
  if (totals.tons <= 0 || totals.unitPrice <= 0) {
    App.showToast('يرجى إدخال كمية الدقيق بالطن وسعر الطن الصحيح', 'warning');
    return;
  }

  const flourType = document.getElementById('inv-sup-flour-type')?.value || sup.flourType || 'دقيق فاخر استخراج 72%';
  const refNum = (document.getElementById('inv-sup-ref')?.value || '').trim() || `REC-${Math.floor(1000 + Math.random() * 9000)}`;
  const notes = (document.getElementById('inv-sup-notes')?.value || '').trim();

  currentSupplierDraftInvoice = {
    id: `SUP-INV-DRAFT-${Date.now().toString().slice(-4)}`,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierPhone: sup.phone,
    supplierAddress: sup.address || '',
    flourType: flourType,
    tons: totals.tons,
    unitPrice: totals.unitPrice,
    subtotal: totals.subtotal,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    paymentType: totals.paymentType,
    paidAmount: totals.paid,
    remainingAmount: totals.remaining,
    refNum: refNum,
    notes: notes,
    date: App.getNowISO(),
    isDraft: true
  };

  renderSupplierInvoicePreview(currentSupplierDraftInvoice, true);
  openModal('preview-supplier-invoice-modal');
}

// Issue and Confirm Supplier Flour Invoice
function submitSupplierInvoice() {
  const supId = document.getElementById('inv-supplier-select')?.value;
  if (!supId) {
    App.showToast('يرجى اختيار المطحن المورد أولاً لإصدار الفاتورة', 'warning');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) {
    App.showToast('المطحن المحدد غير موجود بالسيستم', 'danger');
    return;
  }

  const totals = calculateSupplierInvoiceTotals();
  if (totals.tons <= 0 || totals.unitPrice <= 0) {
    App.showToast('يرجى إدخال كمية الدقيق بالطن وسعر الطن بطريقة صحيحة', 'warning');
    return;
  }

  // Check Treasury liquidity if paying in cash
  if (totals.paid > 0 && App.db.treasury < totals.paid) {
    App.showToast(`عفواً، رصيد الخزينة الحالي (${App.formatCurrency(App.db.treasury)}) لا يكفي لسداد دفعة كاش بقيمة (${App.formatCurrency(totals.paid)})`, 'danger');
    return;
  }

  const flourType = document.getElementById('inv-sup-flour-type')?.value || sup.flourType || 'دقيق فاخر استخراج 72%';
  const refNum = (document.getElementById('inv-sup-ref')?.value || '').trim() || `REC-${Math.floor(1000 + Math.random() * 9000)}`;
  const notes = (document.getElementById('inv-sup-notes')?.value || '').trim();
  const invId = `SUP-INV-${Date.now().toString().slice(-4)}`;
  const timestamp = App.getNowISO();

  const newInvoice = {
    id: invId,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierPhone: sup.phone,
    supplierAddress: sup.address || '',
    flourType: flourType,
    tons: totals.tons,
    unitPrice: totals.unitPrice,
    subtotal: totals.subtotal,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    paymentType: totals.paymentType,
    paidAmount: totals.paid,
    remainingAmount: totals.remaining,
    refNum: refNum,
    notes: notes,
    date: timestamp
  };

  // 1. Add to App.db.supplierInvoices
  if (!App.db.supplierInvoices) App.db.supplierInvoices = [];
  App.db.supplierInvoices.unshift(newInvoice);

  // 2. Add to Supplier's batches (Backwards Compatibility with Supplier Ledger)
  if (!sup.batches) sup.batches = [];
  sup.batches.unshift({
    id: `BATCH-${Date.now().toString().slice(-4)}`,
    invoiceId: invId,
    qtyTons: totals.tons,
    unitPrice: totals.unitPrice,
    totalCost: totals.grandTotal,
    refNum: refNum,
    date: timestamp,
    flourType: flourType
  });

  // 3. Update Supplier Balance (add remaining unpaid dues)
  sup.totalBalance = (sup.totalBalance || 0) + totals.remaining;
  sup.unitPrice = totals.unitPrice;

  // 4. If cash payment made, deduct from Treasury & record in Supplier payments
  if (totals.paid > 0) {
    App.db.treasury = Math.max(0, App.db.treasury - totals.paid);
    if (!sup.payments) sup.payments = [];
    sup.payments.unshift({
      id: `PAY-${Date.now().toString().slice(-4)}`,
      invoiceId: invId,
      amount: totals.paid,
      method: totals.paymentType === 'كاش' ? 'كاش (نقداً من خزينة المصنع)' : 'دفعة مقدمة مع فاتورة التوريد',
      date: timestamp,
      notes: `سداد مرتبط بفاتورة التوريد (${invId})`
    });
  }

  // 5. Audit Log
  if (typeof App.logActivity === 'function') {
    App.logActivity('إصدار فاتورة توريد دقيق 🌾', `تم إصدار فاتورة توريد دقيق رسمية (${invId}) للمطحن (${sup.name}) - ${totals.tons} طن بقيمة (${App.formatCurrency(totals.grandTotal)})`, 'success');
  }

  // 6. Save & Refresh
  App.save();
  loadSuppliersTable();
  loadSupplierInvoicesTable();
  initSupplierInvoiceForm();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');

  // Reset Form
  document.getElementById('inv-sup-tons').value = '';
  document.getElementById('inv-sup-discount').value = '0';
  document.getElementById('inv-sup-paid').value = '0';
  document.getElementById('inv-sup-ref').value = '';
  document.getElementById('inv-sup-notes').value = '';
  calculateSupplierInvoiceTotals();

  App.showToast(`تم إصدار وتأكيد فاتورة توريد الدقيق (${invId}) بنجاح! 🌾📄`, 'success');

  // Open Preview Modal directly with confirmed invoice
  previewSupplierInvoice(invId);
}

// Load and Render Supplier Invoices Table
function loadSupplierInvoicesTable(customInvoices = null) {
  const tbody = document.getElementById('supplier-invoices-tbody');
  if (!tbody) return;

  const invoices = customInvoices || App.db.supplierInvoices || [];

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-6">لا يوجد فواتير توريد دقيق مسجلة حتى الآن</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong>${inv.id}</strong></td>
      <td>
        <strong>${inv.supplierName}</strong>
        ${inv.refNum ? `<div class="text-xs text-muted">إذن: ${inv.refNum}</div>` : ''}
      </td>
      <td>
        <strong class="text-primary-color" style="font-size: 1.05rem;">${inv.tons} طن</strong>
        <div class="text-xs text-muted">${inv.flourType || 'دقيق خام'}</div>
      </td>
      <td>${App.formatCurrency(inv.unitPrice)} / طن</td>
      <td><strong class="text-danger">${App.formatCurrency(inv.grandTotal)}</strong></td>
      <td>
        <span class="badge ${inv.paymentType === 'كاش' ? 'badge-emerald' : (inv.paymentType === 'آجل' ? 'badge-danger' : 'badge-blue')}">
          ${inv.paymentType}
        </span>
      </td>
      <td>
        <div class="text-xs">
          <span class="text-success font-bold">مسدد: ${App.formatCurrency(inv.paidAmount || 0)}</span>
          <br>
          <span class="${(inv.remainingAmount || 0) > 0 ? 'text-danger font-bold' : 'text-muted'}">متبقي: ${App.formatCurrency(inv.remainingAmount || 0)}</span>
        </div>
      </td>
      <td>
        <span class="badge badge-blue"><i class="fa-regular fa-clock ml-1"></i> ${App.formatTimestamp(inv.date)}</span>
      </td>
      <td>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-secondary btn-sm" onclick="previewSupplierInvoice('${inv.id}')" title="معاينة الفاتورة الرسمية"><i class="fa-solid fa-eye text-primary-color"></i> معاينة</button>
          <button class="btn btn-secondary btn-sm" onclick="printSupplierInvoiceDirect('${inv.id}')" title="طباعة الفاتورة A4"><i class="fa-solid fa-print"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteSupplierInvoice('${inv.id}')" title="حذف الفاتورة"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Filter Supplier Invoices
function filterSupplierInvoices(query) {
  const q = (query || '').trim().toLowerCase();
  const invoices = App.db.supplierInvoices || [];
  const filtered = invoices.filter(inv => 
    inv.id.toLowerCase().includes(q) ||
    (inv.supplierName && inv.supplierName.toLowerCase().includes(q)) ||
    (inv.flourType && inv.flourType.toLowerCase().includes(q)) ||
    (inv.refNum && inv.refNum.toLowerCase().includes(q))
  );
  loadSupplierInvoicesTable(filtered);
}

// Preview Supplier Invoice (Confirmed or Draft)
function previewSupplierInvoice(invId) {
  let inv = (App.db.supplierInvoices || []).find(i => i.id === invId);
  if (!inv && currentSupplierDraftInvoice && currentSupplierDraftInvoice.id === invId) {
    inv = currentSupplierDraftInvoice;
  }
  if (!inv) return;

  renderSupplierInvoicePreview(inv, !!inv.isDraft);

  const btnPrint = document.getElementById('btn-print-sup-inv');
  if (btnPrint) btnPrint.onclick = () => window.print();

  const btnPdf = document.getElementById('btn-pdf-sup-inv');
  if (btnPdf) btnPdf.onclick = () => window.print();

  const btnImg = document.getElementById('btn-img-sup-inv');
  if (btnImg) btnImg.onclick = () => downloadSupplierInvoiceAsImage(inv.id);

  const btnWa = document.getElementById('btn-wa-sup-inv');
  if (btnWa) btnWa.onclick = () => sendSupplierInvoiceWhatsApp(inv.id);

  openModal('preview-supplier-invoice-modal');
}

// Render Luxury Official Supplier Invoice Content (Identical luxury to Sales Invoice)
function renderSupplierInvoicePreview(inv, isDraft = false) {
  const container = document.getElementById('supplier-invoice-preview-container');
  if (!container) return;

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
  const sup = (App.db.suppliers || []).find(s => s.id === inv.supplierId || s.name === inv.supplierName);

  container.innerHTML = `
    <div id="printable-supplier-invoice-content" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl !important; text-align: right !important; letter-spacing: 0px !important; word-spacing: 0px !important; color: #1e293b; background: #ffffff; padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; width: 100%; position: relative; overflow: hidden;">
      
      <!-- Luxury Realistic Watermark Seal in Background -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg); pointer-events: none; opacity: 0.055; z-index: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 340px; height: 340px; border: 8px double #059669; border-radius: 50%; user-select: none; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif !important;">
        <div style="border: 2px dashed #059669; border-radius: 50%; width: 304px; height: 304px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
          <span style="font-size: 1.25rem; font-weight: 900; color: #059669; letter-spacing: 0 !important; font-family: 'Cairo', Tahoma, sans-serif;">مصنع الإيمان للمكرونة</span>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0;">
            <span style="font-size: 1.2rem; color: #059669;">★</span>
            <span style="font-size: 2.8rem; line-height: 1;">🌾</span>
            <span style="font-size: 1.2rem; color: #059669;">★</span>
          </div>
          <span style="font-size: 1.05rem; font-weight: 900; color: #ffffff; background: #059669; padding: 3px 18px; border-radius: 20px; letter-spacing: 0 !important; font-family: 'Cairo', Tahoma, sans-serif; margin: 2px 0;">معتمد رسمياً وموثق</span>
          <span style="font-size: 0.82rem; font-weight: 800; color: #047857; margin-top: 4px; letter-spacing: 1px;">ELEMAN PASTA FACTORY</span>
          <span style="font-size: 0.75rem; font-weight: 700; color: #059669; margin-top: 2px; letter-spacing: 0 !important;">إدارة المشتريات وتوريدات المطاحن</span>
        </div>
      </div>

      <!-- Invoice Header with Real Logo -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; position: relative; z-index: 1;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 54px; width: 54px; object-fit: contain; flex-shrink: 0;">
          <div>
            <h2 style="color: #059669; font-weight: 800; font-size: 1.3rem; margin: 0 0 2px 0; letter-spacing: 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0 0 2px 0;">خطوط إنتاج وتعبئة أرقى أنواع المكرونة بالشكارة</p>
            <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">جمهورية مصر العربية - إدارة التوريدات والمخازن</p>
          </div>
        </div>
        <div style="text-align: left; flex: 1; min-width: 160px;">
          <h3 style="font-weight: 800; color: #1e293b; margin: 0 0 2px 0; font-size: 1.15rem; letter-spacing: 0;">فاتورة توريد دقيق خام رسمية</h3>
          <p style="font-size: 0.9rem; font-weight: 800; color: #059669; margin: 0 0 2px 0;">رقم الفاتورة: ${inv.id}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">التاريخ: ${App.formatTimestamp(inv.date)}</p>
          ${inv.refNum ? `<p style="font-size: 0.75rem; color: #64748b; margin: 0;">رقم إذن الاستلام: <strong>${inv.refNum}</strong></p>` : ''}
        </div>
      </div>

      <!-- Supplier Info Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; position: relative; z-index: 1;">
        <div style="flex: 1; min-width: 180px;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">بيانات المطحن / المورد المعتمد:</span>
          <strong style="font-size: 1.05rem; color: #0f172a; font-family: 'Cairo', sans-serif;">${inv.supplierName}</strong>
          ${(inv.supplierPhone || (sup && sup.phone)) ? `<span style="font-size: 0.8rem; color: #64748b; margin-right: 8px;">| هاتف: <strong style="color: #059669;">${inv.supplierPhone || sup.phone}</strong></span>` : ''}
          ${(inv.supplierAddress || (sup && sup.address)) ? `<span style="font-size: 0.75rem; color: #94a3b8; display: block; margin-top: 2px;"><i class="fa-solid fa-location-dot ml-1"></i> ${inv.supplierAddress || sup.address}</span>` : ''}
        </div>
        <div style="text-align: left;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">طريقة الدفع والتسديد:</span>
          <span style="background: ${inv.paymentType === 'كاش' ? '#dcfce7' : (inv.paymentType === 'آجل' ? '#fee2e2' : '#e0f2fe')}; color: ${inv.paymentType === 'كاش' ? '#15803d' : (inv.paymentType === 'آجل' ? '#b91c1c' : '#0369a1')}; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem;">${inv.paymentType}</span>
        </div>
      </div>

      <!-- Items Table -->
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; z-index: 1;">
        <table style="width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background: #f1f5f9;">
            <tr>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 800;">بيان الخامة الموردة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 800;">وحدة القياس</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 800;">الكمية المستلمة</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 800;">سعر الطن المعتمد</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: left; font-weight: 800;">الإجمالي الصافي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">
                دقيق قمح خام مطحون (${inv.flourType || 'دقيق مكرونة'})
                ${inv.notes ? `<div style="font-size: 0.75rem; color: #64748b; font-weight: normal; margin-top: 2px;">بيان: ${inv.notes}</div>` : ''}
              </td>
              <td style="padding: 10px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                <span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">طن دقيق</span>
              </td>
              <td style="padding: 10px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 800; font-size: 1.05rem; color: #0f172a;">
                ${inv.tons} طن
              </td>
              <td style="padding: 10px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${App.formatCurrency(inv.unitPrice)}</td>
              <td style="padding: 10px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 800; color: #059669;">${App.formatCurrency(inv.subtotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totals Breakdown & Official Seal -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; flex-wrap: wrap; gap: 10px; border-top: 2px solid #e2e8f0; padding-top: 10px; position: relative; z-index: 1;">
        <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px;">
          <!-- Pristine Luxury Stamped Official Factory Seal -->
          <div style="position: relative; width: 110px; height: 110px; border: 3px double #059669; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #059669; background: radial-gradient(circle, rgba(5, 150, 105, 0.09) 0%, rgba(5, 150, 105, 0.01) 70%); transform: rotate(-8deg); box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25), inset 0 0 8px rgba(5, 150, 105, 0.05); flex-shrink: 0; user-select: none; padding: 4px; box-sizing: border-box;">
            <div style="width: 96px; height: 96px; border: 1.5px dashed #059669; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 2px; box-sizing: border-box; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif !important;">
              <span style="font-size: 0.72rem; font-weight: 900; color: #047857; line-height: 1.1; margin-bottom: 2px; letter-spacing: 0 !important; font-family: 'Cairo', Tahoma, sans-serif;">مصنع الإيمان</span>
              <div style="display: flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; margin: 1px 0;">
                <span style="font-size: 0.65rem; color: #059669;">★</span>
                <span style="font-size: 1.25rem; line-height: 1;">🌾</span>
                <span style="font-size: 0.65rem; color: #059669;">★</span>
              </div>
              <span style="font-size: 0.6rem; font-weight: 900; background: #059669; color: #ffffff; padding: 1.5px 8px; border-radius: 12px; margin: 2px 0; letter-spacing: 0 !important; font-family: 'Cairo', Tahoma, sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${isDraft ? 'معاينة مسودة' : 'معتمد وموثق'}</span>
              <span style="font-size: 0.52rem; font-weight: 800; color: #047857; line-height: 1; letter-spacing: 0 !important;">إدارة المشتريات</span>
              <span style="font-size: 0.44rem; font-weight: 700; color: #059669; margin-top: 1.5px; letter-spacing: 0.4px;">ELEMAN CERTIFIED</span>
            </div>
          </div>

          <div style="font-size: 0.75rem; color: #64748b; line-height: 1.3;">
            <p style="font-weight: 700; color: #334155; margin: 0 0 2px 0;">فاتورة استلام خامات دقيق معتمدة رسمياً 🌾</p>
            <p style="margin: 0;">* تم فحص جودة الدقيق ومطابقة الوزن وصلاحية التشغيل بمخازن مصنع الإيمان.</p>
          </div>
        </div>

        <div style="flex: 1; min-width: 220px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #475569;">
            <span>إجمالي الشحنة قبل الخصم:</span>
            <strong style="color: #1e293b;">${App.formatCurrency(inv.subtotal)}</strong>
          </div>
          ${(inv.discount && inv.discount > 0) ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #dc2626;">
            <span>الخصم المباشر:</span>
            <strong>-${App.formatCurrency(inv.discount)}</strong>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.05rem; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 3px; color: #059669; font-family: 'Cairo', sans-serif;">
            <span>صافي إجمالي الفاتورة:</span>
            <span>${App.formatCurrency(inv.grandTotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748b; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 3px;">
            <span>المسدد كاش من الخزينة: <strong class="text-success">${App.formatCurrency(inv.paidAmount || 0)}</strong></span>
            <span>المتبقي آجل للمطحن: <strong class="${(inv.remainingAmount || 0) > 0 ? 'text-danger' : 'text-success'}">${App.formatCurrency(inv.remainingAmount || 0)}</strong></span>
          </div>
        </div>
      </div>

      <!-- Official Signatures Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; margin-top: 14px; padding-top: 8px; font-size: 0.75rem; color: #64748b;">
        <span>توقيع أمين مخزن الدقيق: __________________</span>
        <span>توقيع سائق / مندوب المطحن: __________________</span>
        <span>اعتماد الإدارة: __________________</span>
      </div>

    </div>
  `;

  // Update Confirmation action box in modal footer
  const confirmBox = document.getElementById('supplier-invoice-confirm-action-box');
  if (confirmBox) {
    if (isDraft) {
      confirmBox.innerHTML = `
        <button type="button" class="btn btn-primary" onclick="closeModal('preview-supplier-invoice-modal'); submitSupplierInvoice();">
          <i class="fa-solid fa-check ml-1"></i> تأكيد وحفظ الفاتورة رسمياً ⚡
        </button>
      `;
    } else {
      confirmBox.innerHTML = `
        <span class="badge badge-emerald" style="font-size: 0.85rem; padding: 6px 14px;">
          <i class="fa-solid fa-circle-check ml-1"></i> فاتورة رسمية معتمدة ومسجلة بالسحابة
        </span>
      `;
    }
  }
}

// Print Directly
function printSupplierInvoiceDirect(invId) {
  previewSupplierInvoice(invId);
  setTimeout(() => window.print(), 300);
}

// Download Invoice as Image
function downloadSupplierInvoiceAsImage(invId) {
  const content = document.getElementById('printable-supplier-invoice-content');
  if (!content) {
    App.showToast('تعذر العثور على محتوى الفاتورة للتحميل', 'danger');
    return;
  }

  if (typeof html2canvas === 'undefined') {
    App.showToast('جاري استخدام خيار الطباعة لتصدير الفاتورة...', 'info');
    window.print();
    return;
  }

  App.showToast('جاري تجهيز صورة الفاتورة عالية الدقة... ⏳', 'info');
  html2canvas(content, { scale: 2, useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    link.download = `فاتورة_توريد_دقيق_${invId || 'الإيمان'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    App.showToast('تم تحميل صورة الفاتورة بنجاح! 🖼️', 'success');
  }).catch(err => {
    console.error('html2canvas error:', err);
    window.print();
  });
}

// Send Invoice via WhatsApp
function sendSupplierInvoiceWhatsApp(invId) {
  const inv = (App.db.supplierInvoices || []).find(i => i.id === invId) || currentSupplierDraftInvoice;
  if (!inv) return;

  const msg = encodeURIComponent(
    `🌾 *مصنع الإيمان للمكرونة* 🌾\n` +
    `*فاتورة توريد دقيق خام معتمدة*\n\n` +
    `📄 رقم الفاتورة: ${inv.id}\n` +
    `🏢 المطحن / المورد: ${inv.supplierName}\n` +
    `📦 الكمية المستلمة: ${inv.tons} طن (${inv.flourType || 'دقيق'})\n` +
    `💰 سعر الطن: ${App.formatCurrency(inv.unitPrice)}\n` +
    `💵 إجمالي الفاتورة الصافي: ${App.formatCurrency(inv.grandTotal)}\n` +
    `✅ المسدد كاش: ${App.formatCurrency(inv.paidAmount || 0)}\n` +
    `⏳ المتبقي آجل: ${App.formatCurrency(inv.remainingAmount || 0)}\n` +
    `📅 التاريخ: ${App.formatTimestamp(inv.date)}\n\n` +
    `_شكراً لتعاملكم الراقي مع مصنع الإيمان للمكرونة_ 🌾`
  );

  let phone = (inv.supplierPhone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('01')) phone = '2' + phone;
  const waUrl = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
  window.open(waUrl, '_blank');
}

// Delete Supplier Invoice (Super Admin Only)
function deleteSupplierInvoice(invId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف فواتير التوريد مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const inv = (App.db.supplierInvoices || []).find(i => i.id === invId);
  if (!inv) return;

  App.showConfirmModal({
    title: 'حذف فاتورة توريد دقيق',
    message: `هل أنت متأكد من حذف فاتورة التوريد (${inv.id}) للمطحن (${inv.supplierName}) بقيمة (${App.formatCurrency(inv.grandTotal)})؟ سيتم تسوية المستحقات تلقائياً.`,
    icon: 'fa-solid fa-file-excel',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف الفاتورة 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      // Revert Supplier Balance
      const sup = (App.db.suppliers || []).find(s => s.id === inv.supplierId || s.name === inv.supplierName);
      if (sup) {
        sup.totalBalance = Math.max(0, (sup.totalBalance || 0) - (inv.remainingAmount || 0));
        if (sup.batches) sup.batches = sup.batches.filter(b => b.invoiceId !== invId && b.refNum !== inv.refNum);
        if (sup.payments) sup.payments = sup.payments.filter(p => p.invoiceId !== invId);
      }

      // Revert Treasury if cash was paid
      if ((inv.paidAmount || 0) > 0) {
        App.db.treasury = (App.db.treasury || 0) + inv.paidAmount;
      }

      // Remove from supplierInvoices
      App.db.supplierInvoices = (App.db.supplierInvoices || []).filter(i => i.id !== invId);

      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف فاتورة توريد دقيق 🗑️', `تم حذف فاتورة التوريد (${inv.id}) للمطحن (${inv.supplierName}) وتسوية الحسابات`, 'danger');
      }

      App.save();
      loadSuppliersTable();
      loadSupplierInvoicesTable();
      renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
      App.showToast(`تم حذف فاتورة التوريد (${inv.id}) وتسوية حساب المطحن بنجاح 🗑️`, 'danger');
    }
  });
}

