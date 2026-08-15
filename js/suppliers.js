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

function saveNewSupplier() {
  const name = document.getElementById('sup-name').value.trim();
  const phone = document.getElementById('sup-phone').value.trim();
  const flourType = document.getElementById('sup-flour-type').value;
  const price = parseFloat(document.getElementById('sup-price').value) || 0;
  const address = document.getElementById('sup-address').value.trim();
  const notes = document.getElementById('sup-notes').value.trim();

  if (!name || !phone || price <= 0) {
    App.showToast('رجاء ادخل اسم المطحن، الهاتف، وسعر التوريد المحدد', 'warning');
    return;
  }

  const newSup = {
    id: `SUP-${String((App.db.suppliers || []).length + 101)}`,
    name: name,
    phone: phone,
    address: address || 'المنطقة الصناعية',
    flourType: flourType,
    unitPrice: price,
    totalBalance: 0,
    notes: notes || 'تعامل جديد'
  };

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

  App.showToast(`تم إضافة المطحن/المورد (${newSup.name}) بنجاح 🌾`, 'success');
}

function openSupplyBatchModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  document.getElementById('batch-sup-id').value = sup.id;
  document.getElementById('batch-sup-title').textContent = `المطحن: ${sup.name} | نوع الدقيق: ${sup.flourType}`;
  document.getElementById('batch-unit-price').value = sup.unitPrice;
  document.getElementById('batch-tons-qty').value = '';
  document.getElementById('batch-ref-num').value = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

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
  sup.unitPrice = unitPrice; // Update last unit price

  // Log as operating expense record
  if (!App.db.expenses) App.db.expenses = [];
  App.db.expenses.unshift({
    id: `EXP-FLOUR-${Date.now()}`,
    title: `توريد دقيق خام (${qtyTons} طن) - ${sup.name}`,
    category: 'خامات ومواد',
    amount: totalCost,
    date: App.getNowISO(),
    notes: `إذن استلام ${refNum} - بسعر طن: ${App.formatCurrency(unitPrice)}`
  });

  App.save();
  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  closeModal('supply-batch-modal');

  App.showToast(`تم إيداع شحنة (${qtyTons} طن) دقيق وإضافة ${App.formatCurrency(totalCost)} لحساب المطحن`, 'success');
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
  const notes = document.getElementById('pay-sup-notes').value.trim();

  if (amount <= 0) {
    App.showToast('رجاء ادخل المبلغ المراد سداده للمطحن', 'warning');
    return;
  }

  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  sup.totalBalance = Math.max(0, (sup.totalBalance || 0) - amount);
  App.db.treasury = Math.max(0, App.db.treasury - amount);

  App.save();
  loadSuppliersTable();
  renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
  closeModal('pay-supplier-modal');

  App.showToast(`تم سداد ${App.formatCurrency(amount)} للمطحن (${sup.name}) والخصم من الخزنة`, 'success');
}

function openSupplierStatementModal(supId) {
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  const container = document.getElementById('supplier-statement-body');
  const relatedExpenses = (App.db.expenses || []).filter(e => e.title && e.title.includes(sup.name));

  container.innerHTML = `
    <div id="printable-supplier-statement" class="p-6 bg-white rounded-xl border">
      <div class="flex justify-between items-center border-b pb-4 mb-4">
        <div class="flex items-center gap-3">
          <img src="image/logo.png" alt="شعار مصنع الإيمان" style="height: 52px; width: 52px; object-fit: contain;">
          <div>
            <h2 class="text-primary-color font-bold" style="font-size: 1.5rem; margin: 0;">مصنع الإيمان للمكرونة</h2>
            <p class="text-xs text-muted" style="margin: 2px 0;">كشف حساب ومعاملات مطحن الدقيق الخام</p>
          </div>
        </div>
        <div class="text-left">
          <strong>المطحن: ${sup.name}</strong>
          <p class="text-xs text-muted">نوع الدقيق: ${sup.flourType}</p>
          <p class="text-xs text-muted">الهاتف: ${sup.phone} | ${sup.address}</p>
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
        <div class="card bg-light p-4" style="background: var(--accent-rose-light); border-color: var(--accent-rose-border);">
          <span class="text-xs text-muted font-bold text-danger">صافي المستحقات المتبقية</span>
          <h2 class="text-danger font-bold mt-1">${App.formatCurrency(sup.totalBalance)}</h2>
        </div>
      </div>

      <h4 class="font-bold mb-3">سجل توريدات الخامات والشحنات الواردة</h4>
      <table class="table mb-4">
        <thead>
          <tr>
            <th>كود الحركة</th>
            <th>البيان والتفاصيل</th>
            <th>التاريخ والوقت</th>
            <th>القيمة الإجمالية</th>
          </tr>
        </thead>
        <tbody>
          ${relatedExpenses.length > 0 ? relatedExpenses.map(e => `
            <tr>
              <td><strong>${e.id}</strong></td>
              <td>${e.title} <div class="text-xs text-muted">${e.notes || ''}</div></td>
              <td>${App.formatTimestamp(e.date)}</td>
              <td><strong class="text-danger">${App.formatCurrency(e.amount)}</strong></td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="text-center text-muted">لا يوجد توريدات مسجلة مؤخراً لهذ المطحن</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  openModal('supplier-statement-modal');
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
  const sup = (App.db.suppliers || []).find(s => s.id === supId);
  if (!sup) return;

  if (confirm(`هل أنت تأكد من حذف المطحن (${sup.name}) نهائياً من السجل؟`)) {
    App.db.suppliers = (App.db.suppliers || []).filter(s => s.id !== supId);
    App.save();
    loadSuppliersTable();
    renderPageSummaryCards('suppliers', 'suppliers-summary-cards');
    App.showToast(`تم حذف المطحن (${sup.name}) من السجل`, 'danger');
  }
}
