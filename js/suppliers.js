/* ==========================================================================
   مصنع الإيمان للمكرونة - Suppliers & Flour Mills Script
   Pure JavaScript (ES6+) - Per-Mill Custom Pricing & Account Ledger
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('suppliers');
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  loadSuppliersTable();

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
