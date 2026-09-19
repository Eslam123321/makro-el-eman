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
        <button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button>
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
