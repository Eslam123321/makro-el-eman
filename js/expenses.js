/* ==========================================================================
   مصنع الإيمان للمكرونة - Expenses & Treasury Management Script
   Pure JavaScript (ES6+)
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('expenses');
  loadExpensesTable();

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

  const newExp = {
    id: `EXP-${Date.now().toString().slice(-4)}`,
    title: title,
    category: catInput.value || 'تشغيلي',
    amount: amount,
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

  App.showToast(`تم تسجيل المصروف بالختم الزمني الآلي (${newExp.title})`, 'success');
}

function deleteExpense(expId) {
  if (confirm('هل أنت تأكد من إلغاء هذا المصروف؟')) {
    App.db.expenses = App.db.expenses.filter(e => e.id !== expId);
    App.save();
    loadExpensesTable();
    App.showToast('تم حذف بند المصروفات', 'danger');
  }
}
