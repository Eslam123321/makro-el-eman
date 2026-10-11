/* ==========================================================================
   مصنع الإيمان للمكرونة - Expenses & Treasury Management Script
   Pure JavaScript (ES6+)
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('expenses');
  loadExpensesTable();

  const catSelect = document.getElementById('exp-category');
  if (catSelect) onExpenseCategoryChange(catSelect.value);

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterExpenses(searchQuery);
    }
  }
});

function filterExpenses(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = App.db.expenses.filter(e => 
    e.title.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q) ||
    (e.notes && e.notes.toLowerCase().includes(q)) ||
    e.id.toLowerCase().includes(q)
  );
  loadExpensesTable(filtered);
}

// Render Expenses Table with Auto-Timestamps
function loadExpensesTable(expensesData = null) {
  const tbody = document.getElementById('expenses-list-tbody');
  const treasuryVal = document.getElementById('expenses-treasury-val');
  const totalExpVal = document.getElementById('total-expenses-val');

  if (treasuryVal) treasuryVal.textContent = App.formatCurrency(App.db.treasury);

  const expenses = expensesData || App.db.expenses;
  const totalExp = expenses.reduce((a, b) => a + (b.amount || 0), 0);
  if (totalExpVal) totalExpVal.textContent = App.formatCurrency(totalExp);

  if (!tbody) return;

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-6">لا يوجد مصروفات مسجلة مطبقة عليها نتائج البحث</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td><strong>${e.id}</strong></td>
      <td>
        <strong>${e.title}</strong>
        ${(e.sacksCount && e.sackPrice) ? `
          <div class="mt-1">
            <span class="badge badge-emerald text-xs" style="font-size: 0.78rem;">
              <i class="fa-solid fa-box-open ml-1"></i> ${Number(e.sacksCount).toLocaleString('ar-EG')} شكارة × ${App.formatCurrency(e.sackPrice)}
            </span>
          </div>
        ` : ''}
        <div class="text-xs text-muted">${e.notes || ''}</div>
      </td>
      <td><span class="badge badge-purple">${e.category}</span></td>
      <td><strong class="text-danger">${App.formatCurrency(e.amount)}</strong></td>
      <td><span class="badge badge-blue"><i class="fa-regular fa-clock ml-1"></i> ${App.formatTimestamp(e.date)}</span></td>
      <td>
        <div class="flex gap-2 items-center flex-wrap">
          <button class="btn btn-secondary btn-sm" onclick="previewExpenseVoucher('${e.id}')" title="معاينة سند الصرف"><i class="fa-solid fa-eye text-primary-color"></i></button>
          <button class="btn btn-secondary btn-sm" onclick="openEditExpenseModal('${e.id}')" title="تعديل المصروف"><i class="fa-solid fa-pen-to-square text-primary-color"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')" title="حذف المصروف"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Modal Card: Add Expense (Auto-Timestamped)
function saveNewExpense() {
  const titleInput = document.getElementById('exp-title');
  const catInput = document.getElementById('exp-category');
  const amountInput = document.getElementById('exp-amount');
  const notesInput = document.getElementById('exp-notes');

  const title = titleInput.value.trim();
  const amount = parseFloat(amountInput.value) || 0;

  if (!title || amount <= 0) {
    App.showToast('رجاء ادخل بيان المصروف وقيمته المستحقة', 'warning');
    return;
  }

  const sacksCountInput = document.getElementById('exp-sacks-count');
  const sackPriceInput = document.getElementById('exp-sack-price');
  const isSacksCategory = (catInput.value || '').includes('شكاير');
  const sacksCount = (isSacksCategory && sacksCountInput) ? (parseInt(sacksCountInput.value) || null) : null;
  const sackPrice = (isSacksCategory && sackPriceInput) ? (parseFloat(sackPriceInput.value) || null) : null;

  const newExp = {
    id: `EXP-${Date.now().toString().slice(-4)}`,
    title: title,
    category: catInput.value || 'تشغيلي',
    amount: amount,
    sacksCount: sacksCount,
    sackPrice: sackPrice,
    date: App.getNowISO(), // Auto-Timestamp
    notes: notesInput.value.trim() || ''
  };

  // Deduct from factory treasury
  App.db.treasury = Math.max(0, App.db.treasury - amount);

  App.db.expenses.unshift(newExp);
  if (typeof App.logActivity === 'function') {
    App.logActivity('صرف من الخزينة 💸', `تم تسجيل مصروف جديد بقيمة (${App.formatCurrency(newExp.amount)}) - ${newExp.title}`, 'danger');
  }
  App.save();

  loadExpensesTable();
  if (document.getElementById('new-expense-modal')) closeModal('new-expense-modal');

  // Reset form
  titleInput.value = '';
  amountInput.value = '';
  notesInput.value = '';
  if (sacksCountInput) sacksCountInput.value = '';
  if (sackPriceInput) sackPriceInput.value = '';
  const summaryBox = document.getElementById('sacks-calc-summary');
  if (summaryBox) summaryBox.style.display = 'none';

  App.showToast(`تم تسجيل المصروف بالختم الزمني الآلي (${newExp.title})`, 'success');
}

// Category Change Handler for Sacks Calculator
function onExpenseCategoryChange(categoryVal) {
  const calcBox = document.getElementById('sacks-calculator-box');
  if (!calcBox) return;

  const isSacks = (categoryVal || '').includes('شكاير') || (categoryVal || '').includes('شكارة');
  calcBox.style.display = isSacks ? 'block' : 'none';

  const titleInput = document.getElementById('exp-title');
  if (isSacks && titleInput && (!titleInput.value.trim() || titleInput.value.trim() === 'شراء شكاير تعبئة وتغليف فارغة')) {
    titleInput.value = 'شراء شكاير تعبئة وتغليف فارغة';
  }

  if (isSacks) {
    calculateSacksExpense();
  }
}

// Auto-switch to sacks category if user types sacks in title
function onExpenseTitleInput(val) {
  const q = (val || '').toLowerCase();
  if (q.includes('شكاير') || q.includes('شكارة') || q.includes('شيكارة')) {
    const catSelect = document.getElementById('exp-category');
    if (catSelect && !catSelect.value.includes('شكاير')) {
      catSelect.value = 'شكاير تعبئة وتغليف';
      onExpenseCategoryChange(catSelect.value);
    }
  }
}

// Sacks Expense Auto-Calculator
function calculateSacksExpense() {
  const countInput = document.getElementById('exp-sacks-count');
  const priceInput = document.getElementById('exp-sack-price');
  const amountInput = document.getElementById('exp-amount');
  const summaryBox = document.getElementById('sacks-calc-summary');
  const textEl = document.getElementById('sacks-calc-text');
  const totalEl = document.getElementById('sacks-calc-total');

  const count = parseInt(countInput?.value) || 0;
  const price = parseFloat(priceInput?.value) || 0;

  if (count > 0 && price > 0) {
    const total = count * price;
    if (amountInput) amountInput.value = total;

    if (summaryBox) summaryBox.style.display = 'flex';
    if (textEl) textEl.innerHTML = `<i class="fa-solid fa-calculator ml-1"></i> الحسبة التلقائية: <strong>${count.toLocaleString('ar-EG')} شكارة</strong> × <strong>${price.toFixed(2)} ج.م</strong>`;
    if (totalEl) totalEl.textContent = `= ${App.formatCurrency(total)}`;

    const titleInput = document.getElementById('exp-title');
    if (titleInput && (!titleInput.value.trim() || titleInput.value.includes('شكاير') || titleInput.value.includes('شكارة'))) {
      titleInput.value = `شراء شكاير تعبئة (${count} شكارة × ${price} ج.م)`;
    }
  } else {
    if (summaryBox) summaryBox.style.display = 'none';
  }
}

function deleteExpense(expId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف المصروفات مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const exp = (App.db.expenses || []).find(e => e.id === expId);
  if (!exp) return;

  App.showConfirmModal({
    title: 'حذف بند المصروف',
    message: `هل أنت متأكد من حذف بند المصروف (${exp.title}) بقيمة (${App.formatCurrency(exp.amount)}) نهائياً من قاعدة البيانات والسحابة؟`,
    icon: 'fa-solid fa-trash-can',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف المصروف 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      const expTitle = exp.title;
      App.db.expenses = (App.db.expenses || []).filter(e => e.id !== expId);
      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف مصروف 🗑️', `تم حذف المصروف (${expTitle}) نهائياً من السيستم`, 'danger');
      }
      App.save();
      loadExpensesTable();
      if (typeof renderPageSummaryCards === 'function') renderPageSummaryCards('expenses', 'expenses-summary-cards');
      App.showToast(`تم حذف بند المصروف (${expTitle}) نهائياً من النظام والسحابة 🗑️`, 'danger');
    }
  });
}

// Preview Expense Voucher Modal
function previewExpenseVoucher(expId) {
  const exp = (App.db.expenses || []).find(e => e.id === expId);
  if (!exp) return;

  const container = document.getElementById('preview-expense-voucher-body');
  if (!container) return;

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  container.innerHTML = `
    <div id="printable-expense-voucher" style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; text-align: right; color: #1e293b; background: #fff; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px;">
      
      <!-- Voucher Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 54px; width: 54px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; font-weight: 800; font-size: 1.35rem; margin: 0 0 2px 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.82rem; color: #64748b; margin: 0;">سند صرف نقدي معتمد من الخزينة 💸</p>
          </div>
        </div>
        <div style="text-align: left;">
          <span class="badge badge-purple" style="font-size: 0.9rem; padding: 4px 10px; font-weight: 800;">${exp.id}</span>
          <p style="font-size: 0.75rem; color: #64748b; margin: 4px 0 0 0;"><i class="fa-regular fa-clock ml-1"></i> ${App.formatTimestamp(exp.date)}</p>
        </div>
      </div>

      <!-- Voucher Key Info Box -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
          <span style="font-size: 0.9rem; color: #475569; font-weight: 700;">المبلغ المستقطع والمصروف:</span>
          <strong style="font-size: 1.45rem; color: #dc2626; font-family: 'Cairo', sans-serif;">${App.formatCurrency(exp.amount)}</strong>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.85rem;">
          <div><span style="color: #64748b;">البيان والتفاصيل:</span> <strong style="color: #0f172a;">${exp.title}</strong></div>
          <div><span style="color: #64748b;">الفئة / البند:</span> <span class="badge badge-secondary" style="font-size: 0.8rem;">${exp.category}</span></div>
          ${(exp.sacksCount && exp.sackPrice) ? `
          <div style="grid-column: span 2;"><span style="color: #64748b;">تفاصيل الشكاير:</span> <strong>${Number(exp.sacksCount).toLocaleString('ar-EG')} شكارة</strong> × <strong>${App.formatCurrency(exp.sackPrice)}</strong></div>
          ` : ''}
          ${exp.notes ? `
          <div style="grid-column: span 2;"><span style="color: #64748b;">ملاحظات إضافية:</span> <em>${exp.notes}</em></div>
          ` : ''}
        </div>
      </div>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 14px; margin-top: 20px; font-size: 0.8rem; color: #475569;">
        <div>توقيع المستلم: ___________________</div>
        <div>أمين الخزينة: ___________________</div>
        <div>اعتماد المدير العام: ___________________</div>
      </div>

    </div>
  `;

  openModal('preview-expense-voucher-modal');
}

// Edit Expense Modal Logic
let activeEditExpenseId = null;

function openEditExpenseModal(expId) {
  const exp = (App.db.expenses || []).find(e => e.id === expId);
  if (!exp) return;

  activeEditExpenseId = expId;
  const container = document.getElementById('edit-expense-modal-body');
  if (!container) return;

  const isSacks = (exp.category || '').includes('شكاير') || (exp.sacksCount > 0);

  container.innerHTML = `
    <div class="form-group mb-3">
      <label>كود المصروف</label>
      <input type="text" class="form-control" value="${exp.id}" readonly disabled style="background: #f8fafc; font-weight: bold;">
    </div>
    <div class="form-group mb-3">
      <label>بيان وتفاصيل المصروف <span class="text-danger">*</span></label>
      <input type="text" id="edit-exp-title" class="form-control" value="${exp.title || ''}">
    </div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="form-group mb-0">
        <label>الفئة / البند <span class="text-danger">*</span></label>
        <select id="edit-exp-category" class="form-control" onchange="onEditExpenseCategoryChange(this.value)">
          <option value="تشغيلي" ${exp.category === 'تشغيلي' ? 'selected' : ''}>مصروفات تشغيلية</option>
          <option value="شكاير تعبئة وتغليف" ${exp.category === 'شكاير تعبئة وتغليف' ? 'selected' : ''}>شكاير تعبئة وتغليف فارغة</option>
          <option value="صيانة وقطع غيار" ${exp.category === 'صيانة وقطع غيار' ? 'selected' : ''}>صيانة وقطع غيار</option>
          <option value="كهرباء ومرافق" ${exp.category === 'كهرباء ومرافق' ? 'selected' : ''}>كهرباء ومرافق</option>
          <option value="نقل وسيارات" ${exp.category === 'نقل وسيارات' ? 'selected' : ''}>نقل وسيارات</option>
          <option value="رواتب وسلف" ${exp.category === 'رواتب وسلف' ? 'selected' : ''}>رواتب وسلف</option>
          <option value="نثريات وإكراميات" ${exp.category === 'نثريات وإكراميات' ? 'selected' : ''}>نثريات وإكراميات</option>
          <option value="أخرى" ${exp.category === 'أخرى' ? 'selected' : ''}>أخرى</option>
        </select>
      </div>
      <div class="form-group mb-0">
        <label>المبلغ المستقطع (جنيه) <span class="text-danger">*</span></label>
        <input type="number" id="edit-exp-amount" class="form-control" value="${exp.amount || 0}" min="1" step="0.5">
      </div>
    </div>

    <div id="edit-sacks-calculator-box" class="p-3 bg-slate-50 border rounded-lg mb-3" style="display: ${isSacks ? 'block' : 'none'};">
      <span class="text-xs font-bold text-muted block mb-2"><i class="fa-solid fa-calculator ml-1"></i> تفاصيل الشكاير:</span>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs">عدد الشكاير</label>
          <input type="number" id="edit-exp-sacks-count" class="form-control" value="${exp.sacksCount || ''}" oninput="calcEditSacksExpense()">
        </div>
        <div>
          <label class="text-xs">سعر الشكارة (جنيه)</label>
          <input type="number" id="edit-exp-sack-price" class="form-control" value="${exp.sackPrice || ''}" step="0.1" oninput="calcEditSacksExpense()">
        </div>
      </div>
    </div>

    <div class="form-group mb-0">
      <label>ملاحظات إضافية</label>
      <input type="text" id="edit-exp-notes" class="form-control" value="${exp.notes || ''}">
    </div>
  `;

  openModal('edit-expense-modal');
}

function onEditExpenseCategoryChange(cat) {
  const box = document.getElementById('edit-sacks-calculator-box');
  if (!box) return;
  const isSacks = (cat || '').includes('شكاير');
  box.style.display = isSacks ? 'block' : 'none';
}

function calcEditSacksExpense() {
  const count = parseInt(document.getElementById('edit-exp-sacks-count')?.value) || 0;
  const price = parseFloat(document.getElementById('edit-exp-sack-price')?.value) || 0;
  const amountEl = document.getElementById('edit-exp-amount');
  if (count > 0 && price > 0 && amountEl) {
    amountEl.value = count * price;
  }
}

function saveEditedExpense() {
  const exp = (App.db.expenses || []).find(e => e.id === activeEditExpenseId);
  if (!exp) return;

  const title = (document.getElementById('edit-exp-title')?.value || '').trim();
  const category = document.getElementById('edit-exp-category')?.value || 'تشغيلي';
  const amount = parseFloat(document.getElementById('edit-exp-amount')?.value) || 0;
  const notes = (document.getElementById('edit-exp-notes')?.value || '').trim();

  if (!title || amount <= 0) {
    App.showToast('رجاء ادخل بيان المصروف والمبلغ بشكل صحيح', 'warning');
    return;
  }

  const isSacks = category.includes('شكاير');
  const sacksCount = isSacks ? (parseInt(document.getElementById('edit-exp-sacks-count')?.value) || null) : null;
  const sackPrice = isSacks ? (parseFloat(document.getElementById('edit-exp-sack-price')?.value) || null) : null;

  const oldAmount = exp.amount || 0;
  const diff = amount - oldAmount;

  // Adjust treasury balance
  App.db.treasury = Math.max(0, (App.db.treasury || 0) - diff);

  exp.title = title;
  exp.category = category;
  exp.amount = amount;
  exp.notes = notes;
  exp.sacksCount = sacksCount;
  exp.sackPrice = sackPrice;

  if (typeof App.logActivity === 'function') {
    App.logActivity('تعديل مصروف ✏️', `تم تعديل بيانات المصروف (${exp.id}) بقيمة (${App.formatCurrency(exp.amount)})`, 'info');
  }

  App.save();
  loadExpensesTable();
  if (typeof renderPageSummaryCards === 'function') renderPageSummaryCards('expenses', 'expenses-summary-cards');
  closeModal('edit-expense-modal');
  App.showToast(`تم حفظ تعديلات المصروف (${exp.title}) بنجاح 💾`, 'success');
}
