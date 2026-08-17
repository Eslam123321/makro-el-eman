/* ==========================================================================
   مصنع الإيمان للمكرونة - Advanced POS & Invoicing Script (Enterprise Edition)
   Pure JavaScript (ES6+)
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

let currentInvoiceItems = [];
let currentDraftInvoice = null;

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('sales');
  loadInvoicesTable();
  initSalesForm();

  // Handle URL Search/Preview query
  const urlParams = new URLSearchParams(window.location.search);
  const previewId = urlParams.get('preview');
  if (previewId) {
    previewInvoice(previewId);
  }
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterInvoices(searchQuery);
    }
  }
});

function initSalesForm() {
  const customerSelect = document.getElementById('inv-customer-select');
  const productCardsGrid = document.getElementById('pos-products-grid');

  if (customerSelect) {
    const currentVal = customerSelect.value;
    customerSelect.innerHTML = '<option value="">-- اختر العميل --</option>' +
      App.db.customers.map(c => `<option value="${c.id}">${c.name} (${c.phone}) - [ديون: ${c.totalDebt} ج.م]</option>`).join('');
    if (currentVal) customerSelect.value = currentVal;
  }

  // POS Interactive Product Cards Grid (STRICT OUT OF STOCK PROTECTION)
  if (productCardsGrid) {
    productCardsGrid.innerHTML = App.db.products.map(p => {
      const isOutOfStock = p.stock <= 0;
      return `
        <div class="pos-product-card ${isOutOfStock ? 'out-of-stock-card' : ''}" onclick="${isOutOfStock ? `App.showToast('عفواً، صنف (${p.name}) نفد من المخزن ولا يمكن إضافته للبيع 🚫', 'danger')` : `quickAddProductToInvoice('${p.id}')`}">
          <div>
            <div class="pos-card-header">
              <span class="badge badge-blue">${p.unit}</span>
              <span class="badge ${isOutOfStock ? 'badge-danger' : 'badge-emerald'} text-xs">
                ${isOutOfStock ? 'غير متوفر 🚫' : 'متاح بالمخزن 🟢'}
              </span>
            </div>
            <div class="pos-card-title" style="${isOutOfStock ? 'color: var(--text-muted);' : ''}">${p.name}</div>
            <div class="pos-card-category">فئة: ${p.category}</div>
          </div>
          <div class="pos-card-footer">
            <div>
              <div class="pos-card-price ${isOutOfStock ? 'text-muted' : ''}">${App.formatCurrency(p.sellPrice)}</div>
              <div class="pos-card-stock ${isOutOfStock ? 'text-danger font-bold' : (p.stock < 150 ? 'text-warning font-bold' : 'text-muted')}">
                ${isOutOfStock ? 'نفدت الكمية (0 شكارة)' : 'المتاح: ' + p.stock + ' شكارة'}
              </div>
            </div>
            ${isOutOfStock ? `
              <span class="badge badge-danger text-xs">ممنوع البيع 🚫</span>
            ` : `
              <button class="btn-add-pos-item" onclick="event.stopPropagation(); quickAddProductToInvoice('${p.id}')">
                <i class="fa-solid fa-plus"></i> إضافة للفاتورة
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }
}

// Quick Add Product Card click
function quickAddProductToInvoice(productId) {
  const product = App.db.products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock <= 0) {
    App.showToast(`عفواً، رصيد الصنف (${product.name}) غير متاح حالياً بالمخزن (ممنوع البيع)`, 'danger');
    return;
  }

  const existingIdx = currentInvoiceItems.findIndex(i => i.id === productId);
  if (existingIdx > -1) {
    if (currentInvoiceItems[existingIdx].qty + 1 > product.stock) {
      App.showToast(`تجاوزت الكمية المتاحة بالشكارة في المخزن (${product.stock})`, 'warning');
      return;
    }
    currentInvoiceItems[existingIdx].qty += 1;
    currentInvoiceItems[existingIdx].total = currentInvoiceItems[existingIdx].qty * currentInvoiceItems[existingIdx].price;
  } else {
    currentInvoiceItems.push({
      id: product.id,
      name: product.name,
      unit: 'شكارة',
      qty: 1,
      price: product.sellPrice,
      total: product.sellPrice
    });
  }

  renderCurrentInvoiceItems();
  App.showToast(`تمت إضافة (1 شكارة) من ${product.name}`, 'success');
}

function updateInvoiceItemRealtime(index, key, value) {
  if (!currentInvoiceItems[index]) return;
  const val = parseFloat(value) || 0;
  currentInvoiceItems[index][key] = val;
  currentInvoiceItems[index].total = (currentInvoiceItems[index].qty || 0) * (currentInvoiceItems[index].price || 0);

  // Update total cell in row in real-time
  const totalCell = document.getElementById(`item-total-val-${index}`);
  if (totalCell) {
    totalCell.textContent = App.formatCurrency(currentInvoiceItems[index].total);
  }

  calculateTotals();
}

function validateInvoiceItemQty(index, value) {
  const val = parseFloat(value) || 0;
  if (val <= 0) {
    removeInvoiceItem(index);
    return;
  }
  updateInvoiceItemRealtime(index, 'qty', val);
}

function changeItemQty(index, delta) {
  if (!currentInvoiceItems[index]) return;
  const currentQty = currentInvoiceItems[index].qty || 1;
  const newQty = Math.max(1, currentQty + delta);
  
  const inputEl = document.getElementById(`item-qty-input-${index}`);
  if (inputEl) inputEl.value = newQty;

  updateInvoiceItemRealtime(index, 'qty', newQty);
}

function updateInvoiceItem(index, key, value) {
  updateInvoiceItemRealtime(index, key, value);
}

function removeInvoiceItem(index) {
  currentInvoiceItems.splice(index, 1);
  renderCurrentInvoiceItems();
}

function renderCurrentInvoiceItems() {
  const tbody = document.getElementById('current-invoice-tbody');
  if (!tbody) return;

  if (currentInvoiceItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-6">اختر أصناف من الشبكة أعلاه لإضافتها فوراً للفاتورة</td></tr>`;
    calculateTotals();
    return;
  }

  tbody.innerHTML = currentInvoiceItems.map((item, idx) => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td><span class="badge badge-blue">${item.unit}</span></td>
      <td>
        <div class="flex items-center justify-center gap-1" style="min-width: 125px;">
          <button type="button" class="btn btn-secondary btn-sm" style="width: 28px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; border-radius: 6px;" onclick="changeItemQty(${idx}, -1)" title="تقليل شكارة">-</button>
          <input type="number" id="item-qty-input-${idx}" min="1" value="${item.qty}" class="form-control text-center font-bold" style="width: 60px; height: 32px; padding: 2px;" onclick="this.select()" oninput="updateInvoiceItemRealtime(${idx}, 'qty', this.value)" onchange="validateInvoiceItemQty(${idx}, this.value)" title="يمكنك كتابة أي رقم يدوي">
          <button type="button" class="btn btn-secondary btn-sm" style="width: 28px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; border-radius: 6px;" onclick="changeItemQty(${idx}, 1)" title="زيادة شكارة">+</button>
        </div>
      </td>
      <td>
        <input type="text" value="${App.formatCurrency(item.price)}" class="form-control text-center font-bold" style="width: 100px; height: 32px; padding: 2px; background: var(--bg-main);" disabled readonly title="سعر الشكارة ثابت ومحدد مسبقاً في المخزن">
      </td>
      <td><strong class="text-success" id="item-total-val-${idx}">${App.formatCurrency(item.total)}</strong></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="removeInvoiceItem(${idx})" title="حذف الصنف"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');

  calculateTotals();
}

// Zero Tax Math Formula
function calculateTotals() {
  const subtotal = currentInvoiceItems.reduce((acc, i) => acc + i.total, 0);
  const discountInput = document.getElementById('inv-discount');
  const paidInput = document.getElementById('inv-paid');

  const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
  const grandTotal = Math.max(0, subtotal - discount);

  const paid = parseFloat(paidInput ? paidInput.value : 0) || 0;
  const remaining = Math.max(0, grandTotal - paid);

  if (document.getElementById('inv-subtotal-val')) document.getElementById('inv-subtotal-val').textContent = App.formatCurrency(subtotal);
  if (document.getElementById('inv-tax-val')) document.getElementById('inv-tax-val').textContent = App.formatCurrency(0);
  if (document.getElementById('inv-grandtotal-val')) document.getElementById('inv-grandtotal-val').textContent = App.formatCurrency(grandTotal);
  if (document.getElementById('inv-remaining-val')) document.getElementById('inv-remaining-val').textContent = App.formatCurrency(remaining);
}

// Open invoice preview from builder (Draft state, does NOT commit to DB yet)
function openInvoicePreviewFromBuilder() {
  if (currentInvoiceItems.length === 0) {
    App.showToast('عفواً، لا يمكن فتح فاتورة فارغة بدون شكاير', 'danger');
    return;
  }

  const customerSelect = document.getElementById('inv-customer-select');
  const paymentTypeSelect = document.getElementById('inv-payment-type');
  const discountInput = document.getElementById('inv-discount');
  const paidInput = document.getElementById('inv-paid');

  const customerId = customerSelect ? customerSelect.value : '';
  const customer = App.db.customers.find(c => c.id === customerId);

  const subtotal = currentInvoiceItems.reduce((acc, i) => acc + i.total, 0);
  const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
  const grandTotal = Math.max(0, subtotal - discount);
  const paidAmount = parseFloat(paidInput ? paidInput.value : 0) || (paymentTypeSelect && paymentTypeSelect.value === 'كاش' ? grandTotal : 0);
  const remainingAmount = Math.max(0, grandTotal - paidAmount);

  currentDraftInvoice = {
    id: `INV-2026-${String(App.db.invoices.length + 1).padStart(3, '0')}`,
    date: App.getNowISO(),
    customerName: customer ? customer.name : (customerId ? 'عميل' : 'عميل نقدي'),
    customerId: customerId || '',
    items: JSON.parse(JSON.stringify(currentInvoiceItems)),
    subtotal: subtotal,
    discount: discount,
    tax: 0,
    grandTotal: grandTotal,
    paidAmount: paidAmount,
    remainingAmount: remainingAmount,
    paymentType: paymentTypeSelect ? paymentTypeSelect.value : 'كاش',
    status: 'معاينة قيد الإصدار',
    isDraft: true
  };

  renderInvoicePreviewContent(currentDraftInvoice, true);
  openModal('preview-invoice-modal');
}

// Confirm & Commit draft invoice into system DB & Invoices Table
function confirmAndCommitDraftInvoice() {
  if (!currentDraftInvoice || !currentDraftInvoice.isDraft) {
    App.showToast('الفاتورة الحالية مؤكدة ومسجلة بالفعل بالنظام', 'warning');
    return;
  }

  // Stock availability check
  for (const item of currentDraftInvoice.items) {
    const prd = App.db.products.find(p => p.id === item.id);
    if (!prd || prd.stock < item.qty) {
      App.showToast(`عفواً، الكمية المطلوبة من (${item.name}) تتجاوز رصيد المخزن المتاح`, 'danger');
      return;
    }
  }

  // Deduct stock
  currentDraftInvoice.items.forEach(item => {
    const prd = App.db.products.find(p => p.id === item.id);
    if (prd) {
      prd.stock = Math.max(0, prd.stock - item.qty);
    }
  });

  // Update customer debt if remaining > 0
  const customer = App.db.customers.find(c => c.id === currentDraftInvoice.customerId || c.name === currentDraftInvoice.customerName);
  if (customer && currentDraftInvoice.remainingAmount > 0) {
    customer.totalDebt += currentDraftInvoice.remainingAmount;
  }

  // Update treasury with paid amount
  App.db.treasury += currentDraftInvoice.paidAmount;

  // Finalize invoice status
  currentDraftInvoice.status = 'مؤكدة';
  delete currentDraftInvoice.isDraft;

  // Save into DB
  App.db.invoices.unshift(currentDraftInvoice);
  if (typeof App.logActivity === 'function') {
    App.logActivity('إصدار فاتورة مبيعات جديدة 📄', `تم إصدار الفاتورة (${currentDraftInvoice.id}) للعميل (${currentDraftInvoice.customerName}) بإجمالي (${App.formatCurrency(currentDraftInvoice.grandTotal)}) والدفع (${currentDraftInvoice.paymentType})`, 'success');
  }
  App.save();

  // Reset page form & reload table
  const confirmedId = currentDraftInvoice.id;
  resetInvoiceForm();
  loadInvoicesTable();

  App.showToast(`تم تأكيد وإصدار الفاتورة (${confirmedId}) بنجاح وتحديث السجل والمخزن ⚡`, 'success');

  // Update preview modal status view to confirmed
  renderInvoicePreviewContent(App.db.invoices.find(i => i.id === confirmedId), false);
}

function resetInvoiceForm() {
  currentInvoiceItems = [];
  currentDraftInvoice = null;

  const customerSelect = document.getElementById('inv-customer-select');
  const paymentTypeSelect = document.getElementById('inv-payment-type');
  const discountInput = document.getElementById('inv-discount');
  const paidInput = document.getElementById('inv-paid');

  if (customerSelect) customerSelect.value = '';
  if (paymentTypeSelect) paymentTypeSelect.value = 'كاش';
  if (discountInput) discountInput.value = '0';
  if (paidInput) paidInput.value = '';

  renderCurrentInvoiceItems();
  calculateTotals();
  initSalesForm();
}

function filterInvoices(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = App.db.invoices.filter(inv => 
    inv.id.toLowerCase().includes(q) ||
    inv.customerName.toLowerCase().includes(q) ||
    inv.paymentType.toLowerCase().includes(q)
  );
  loadInvoicesTable(filtered);
}

function loadInvoicesTable(invoicesData = null) {
  const tbody = document.getElementById('invoices-list-tbody');
  if (!tbody) return;

  const invoices = invoicesData || App.db.invoices;
  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد فواتير صادرة مطبقة عليها نتائج البحث</td></tr>`;
    return;
  }

  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong>${inv.id}</strong></td>
      <td>${inv.customerName}</td>
      <td>${App.formatTimestamp(inv.date)}</td>
      <td><span class="badge ${inv.paymentType === 'كاش' ? 'badge-success' : 'badge-warning'}">${inv.paymentType}</span></td>
      <td><strong class="text-success">${App.formatCurrency(inv.grandTotal)}</strong></td>
      <td><span class="badge ${inv.status === 'مؤكدة' ? 'badge-success' : (inv.status === 'مرتجعة بالكامل' ? 'badge-danger' : 'badge-warning')}">${inv.status}</span></td>
      <td>
        <div class="flex gap-1 flex-wrap">
          <button class="btn btn-secondary btn-sm" onclick="previewInvoice('${inv.id}')" title="معاينة"><i class="fa-solid fa-eye text-primary-color"></i> معاينة</button>
          <button class="btn btn-whatsapp btn-sm" onclick="sendInvoiceWhatsApp('${inv.id}')" title="إرسال عبر الواتساب"><i class="fa-brands fa-whatsapp"></i> واتساب</button>
          ${isSuperAdmin ? `
            ${inv.status !== 'مرتجعة بالكامل' ? `<button class="btn btn-secondary btn-sm" onclick="openInvoiceReturnModal('${inv.id}')" title="إرجاع أصناف أو شكاير محددة من الفاتورة" style="color: #d97706;"><i class="fa-solid fa-rotate-left"></i> مرتجع</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="openEditInvoiceModal('${inv.id}')" title="تعديل بيانات وأصناف الفاتورة"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
            <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')" title="حذف الفاتورة نهائياً"><i class="fa-solid fa-trash"></i> حذف</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// --------------------------------------------------------------------------
// Itemized Partial / Full Return Engine (مرتجع جزئي أو كلي بالشكارة)
// --------------------------------------------------------------------------
let activeReturnInvoiceId = null;

function openInvoiceReturnModal(invId) {
  const currentUser = App.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، خاصية إرجاع الفواتير مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const inv = (App.db.invoices || []).find(i => i.id === invId);
  if (!inv) return;

  if (inv.status === 'مرتجعة بالكامل') {
    App.showToast('هذه الفاتورة تم إرجاع كافة بنودها بالكامل مسبقاً!', 'warning');
    return;
  }

  activeReturnInvoiceId = invId;
  const container = document.getElementById('return-invoice-body');
  if (!container) return;

  const totalSacks = (inv.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const alreadyReturnedSacks = (inv.items || []).reduce((s, i) => s + (i.returnedQty || 0), 0);

  container.innerHTML = `
    <div class="card bg-light p-4 mb-4 border">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div>
          <strong class="text-primary-color" style="font-size: 1.1rem;">فاتورة رقم: ${inv.id}</strong>
          <p class="text-xs text-muted mt-1">العميل: <strong>${inv.customerName}</strong> | التاريخ: ${App.formatTimestamp(inv.date)}</p>
        </div>
        <div class="text-left">
          <span class="text-xs text-muted block">الإجمالي الأصلي: <strong class="text-success">${App.formatCurrency(inv.grandTotal)}</strong></span>
          <span class="text-xs text-muted block">المسدد كاش: <strong>${App.formatCurrency(inv.paidAmount)}</strong> | المتبقي آجل: <strong class="text-danger">${App.formatCurrency(inv.remainingAmount)}</strong></span>
        </div>
      </div>
    </div>

    <h4 class="font-bold mb-2"><i class="fa-solid fa-boxes-stacked text-primary-color ml-1"></i> حدد عدد الشكاير المراد إرجاعها (استخدم أزرار + و - أو اكتب العدد):</h4>
    
    <div class="table-container mb-4">
      <table class="table">
        <thead>
          <tr>
            <th>اسم صنف المكرونة</th>
            <th>سعر الشكارة</th>
            <th>الكمية الأصلية</th>
            <th>المرتجع سابقاً</th>
            <th>الصافي المباع</th>
            <th style="width: 170px; text-align: center;">الكمية للإرجاع (شكارة)</th>
            <th>قيمة المرتجع</th>
          </tr>
        </thead>
        <tbody>
          ${(inv.items || []).map((item, index) => {
            const activeQty = (item.qty || 0) - (item.returnedQty || 0);
            return `
              <tr>
                <td><strong>${item.name}</strong></td>
                <td>${App.formatCurrency(item.price)}</td>
                <td>${item.qty} شكارة</td>
                <td><span class="badge badge-rose">${item.returnedQty || 0} شكارة</span></td>
                <td><strong class="text-primary-color">${activeQty} شكارة</strong></td>
                <td>
                  ${activeQty > 0 ? `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="stepReturnQty(${index}, -1)" style="padding: 2px 10px; font-weight: 900; font-size: 1.15rem; height: 36px; border-radius: 8px;">-</button>
                      <input type="number" 
                             id="return-qty-input-${index}" 
                             class="form-control" 
                             min="0" 
                             max="${activeQty}" 
                             value="0" 
                             data-price="${item.price}"
                             data-item-index="${index}"
                             oninput="calculateReturnSummaryTotal()" 
                             style="font-weight: 800; text-align: center; width: 68px; font-size: 1.05rem; height: 36px; border-radius: 8px;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="stepReturnQty(${index}, 1)" style="padding: 2px 10px; font-weight: 900; font-size: 1.15rem; height: 36px; border-radius: 8px;">+</button>
                    </div>
                  ` : '<span class="badge badge-secondary">تم إرجاعه بالكامل</span>'}
                </td>
                <td><strong id="return-row-val-${index}" class="text-danger">0 ج.م</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="card p-4 border mb-3" style="background: #fffbeb; border-color: #fde68a;">
      <div class="flex justify-between items-center flex-wrap gap-3">
        <div>
          <span class="text-xs text-muted block font-bold">ملخص الشحنة المرتجعة للمخزن:</span>
          <h4>إجمالي المرتجع الآن: <span id="return-total-sacks-count" class="text-primary-color font-bold" style="font-size: 1.2rem;">0</span> شكارة</h4>
        </div>
        <div class="text-left">
          <span class="text-xs text-muted block font-bold">إجمالي المبلغ المستحق رده / تسويته:</span>
          <h2 id="return-total-refund-val" class="text-danger font-bold">0 ج.م</h2>
        </div>
      </div>
    </div>

    <div class="text-center pt-2">
      <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('return-invoice-modal'); openEditInvoiceModal('${inv.id}');" style="color: #2563eb; font-weight: 700;">
        <i class="fa-solid fa-pen-to-square ml-1"></i> أو الانتقال لتعديل كافة بيانات وأصناف الفاتورة بالكامل 📝
      </button>
    </div>
  `;

  openModal('return-invoice-modal');
}

function stepReturnQty(index, delta) {
  const input = document.getElementById(`return-qty-input-${index}`);
  if (!input) return;
  let val = (parseInt(input.value) || 0) + delta;
  const max = parseInt(input.max) || 0;
  if (val < 0) val = 0;
  if (val > max) val = max;
  input.value = val;
  calculateReturnSummaryTotal();
}

function calculateReturnSummaryTotal() {
  const inv = (App.db.invoices || []).find(i => i.id === activeReturnInvoiceId);
  if (!inv) return;

  let totalRefund = 0;
  let totalSacks = 0;

  (inv.items || []).forEach((item, index) => {
    const input = document.getElementById(`return-qty-input-${index}`);
    if (input) {
      let qty = parseInt(input.value) || 0;
      const activeQty = (item.qty || 0) - (item.returnedQty || 0);
      if (qty < 0) qty = 0;
      if (qty > activeQty) {
        qty = activeQty;
        input.value = qty;
      }
      const rowVal = qty * (item.price || 0);
      totalRefund += rowVal;
      totalSacks += qty;

      const rowValEl = document.getElementById(`return-row-val-${index}`);
      if (rowValEl) rowValEl.textContent = App.formatCurrency(rowVal);
    }
  });

  const countEl = document.getElementById('return-total-sacks-count');
  const refundEl = document.getElementById('return-total-refund-val');

  if (countEl) countEl.textContent = totalSacks;
  if (refundEl) refundEl.textContent = App.formatCurrency(totalRefund);
}

function confirmProcessItemizedReturn() {
  const inv = (App.db.invoices || []).find(i => i.id === activeReturnInvoiceId);
  if (!inv) return;

  let totalReturnSacks = 0;
  let totalRefundAmount = 0;
  const returnDetails = [];

  (inv.items || []).forEach((item, index) => {
    const input = document.getElementById(`return-qty-input-${index}`);
    if (input) {
      const returnQty = parseInt(input.value) || 0;
      if (returnQty > 0) {
        totalReturnSacks += returnQty;
        const refundVal = returnQty * item.price;
        totalRefundAmount += refundVal;

        // 1. Restore stock in inventory
        const prod = (App.db.products || []).find(p => p.id === item.id || p.name === item.name);
        if (prod) {
          prod.stock = (prod.stock || 0) + returnQty;
        }

        // 2. Mark returned qty on item
        item.returnedQty = (item.returnedQty || 0) + returnQty;
        returnDetails.push({ name: item.name, qty: returnQty, unitPrice: item.price, totalRefund: refundVal });
      }
    }
  });

  if (totalReturnSacks <= 0) {
    App.showToast('رجاء حدد كمية الشكاير المراد إرجاعها (شكارة واحدة على الأقل)', 'warning');
    return;
  }

  // 3. Financial Reconciliation:
  // If invoice had debt remaining -> deduct from customer debt first
  let remainingRefund = totalRefundAmount;
  const cust = (App.db.customers || []).find(c => c.name === inv.customerName || c.id === inv.customerId);

  if (inv.remainingAmount > 0 && cust) {
    const debtDeduction = Math.min(inv.remainingAmount, remainingRefund);
    cust.totalDebt = Math.max(0, (cust.totalDebt || 0) - debtDeduction);
    inv.remainingAmount = Math.max(0, inv.remainingAmount - debtDeduction);
    remainingRefund -= debtDeduction;
  }

  // If cash was paid and there's remaining refund -> refund from Treasury
  if (remainingRefund > 0) {
    App.db.treasury = Math.max(0, (App.db.treasury || 0) - remainingRefund);
    inv.paidAmount = Math.max(0, (inv.paidAmount || 0) - remainingRefund);
  }

  // 4. Update Invoice Status
  const totalOriginalSacks = (inv.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const totalAccumulatedReturned = (inv.items || []).reduce((s, i) => s + (i.returnedQty || 0), 0);

  if (totalAccumulatedReturned >= totalOriginalSacks) {
    inv.status = 'مرتجعة بالكامل';
  } else {
    inv.status = `مرتجع جزئي (${totalAccumulatedReturned} شكارة)`;
  }

  // Track return history log on invoice
  if (!inv.returnLogs) inv.returnLogs = [];
  inv.returnLogs.unshift({
    timestamp: App.getNowISO(),
    returnedSacks: totalReturnSacks,
    refundAmount: totalRefundAmount,
    details: returnDetails
  });

  if (typeof App.logActivity === 'function') {
    App.logActivity('مرتجع بضاعة من فاتورة ↩️', `تم إرجاع (${totalReturnSacks} شكارة) من الفاتورة (${inv.id}) للعميل (${inv.customerName}) بقيمة (${App.formatCurrency(totalRefundAmount)})`, 'warning');
  }

  App.save();
  closeModal('return-invoice-modal');
  loadInvoicesTable();
  renderPageSummaryCards('sales', 'sales-summary-cards');
  App.showToast(`تم إرجاع (${totalReturnSacks} شكارة) بنجاح وإعادتها للمخزن وتحديث الحسابات ↩️📦`, 'success');
}

// --------------------------------------------------------------------------
// Edit Invoice Engine (تعديل كامل للفاتورة وإعادة ضبط المخزون والمالية)
// --------------------------------------------------------------------------
let activeEditInvoiceId = null;

function openEditInvoiceModal(invId) {
  const currentUser = App.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، خاصية تعديل الفواتير مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const inv = (App.db.invoices || []).find(i => i.id === invId);
  if (!inv) return;

  activeEditInvoiceId = invId;
  const container = document.getElementById('edit-invoice-body');
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="form-group">
        <label>رقم الفاتورة</label>
        <input type="text" class="form-control" value="${inv.id}" readonly disabled style="background: #f8fafc; font-weight: bold;">
      </div>
      <div class="form-group">
        <label>العميل المستلم</label>
        <select id="edit-inv-customer" class="form-control">
          ${(App.db.customers || []).map(c => `
            <option value="${c.name}" ${c.name === inv.customerName ? 'selected' : ''}>${c.name} (${c.phone})</option>
          `).join('')}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="form-group">
        <label>طريقة الدفع والتسديد</label>
        <select id="edit-inv-paytype" class="form-control" onchange="onEditPayTypeChange()">
          <option value="كاش" ${inv.paymentType === 'كاش' ? 'selected' : ''}>دفع كاش (نقدي كامل)</option>
          <option value="آجل" ${inv.paymentType === 'آجل' ? 'selected' : ''}>آجل (مديونية على العميل)</option>
          <option value="دفع جزئي" ${inv.paymentType === 'دفع جزئي' ? 'selected' : ''}>دفع جزئي (عربون والباقي آجل)</option>
        </select>
      </div>
      <div class="form-group">
        <label>المبلغ المسدد كاش (جنيه)</label>
        <input type="number" id="edit-inv-paid" class="form-control" value="${inv.paidAmount || 0}" min="0" oninput="recalcEditInvoiceTotals()">
      </div>
      <div class="form-group">
        <label>الخصم المباشر (جنيه)</label>
        <input type="number" id="edit-inv-discount" class="form-control" value="${inv.discount || 0}" min="0" oninput="recalcEditInvoiceTotals()">
      </div>
    </div>

    <h4 class="font-bold mb-2"><i class="fa-solid fa-bag-shopping text-primary-color ml-1"></i> أصناف وكميات الشكاير بالفاتورة:</h4>
    <div class="table-container mb-4">
      <table class="table">
        <thead>
          <tr>
            <th>اسم صنف المكرونة</th>
            <th>سعر بيع الشكارة</th>
            <th style="width: 140px;">عدد الشكاير</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${(inv.items || []).map((item, index) => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td>${App.formatCurrency(item.price)}</td>
              <td>
                <input type="number" 
                       id="edit-item-qty-${index}" 
                       class="form-control" 
                       value="${item.qty}" 
                       min="1" 
                       data-price="${item.price}"
                       oninput="recalcEditInvoiceTotals()" 
                       style="font-weight: bold; text-align: center;">
              </td>
              <td><strong id="edit-item-total-${index}" class="text-success">${App.formatCurrency(item.qty * item.price)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card p-4 border" style="background: var(--primary-light);">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div>
          <span class="text-xs text-muted block">الإجمالي الصافي النهائي بعد التعديل:</span>
          <h2 id="edit-inv-grand-total" class="text-primary-color font-bold">${App.formatCurrency(inv.grandTotal)}</h2>
        </div>
        <div class="text-left">
          <span class="text-xs text-muted block">المتبقي مديونية على العميل:</span>
          <h3 id="edit-inv-remaining" class="text-danger font-bold">${App.formatCurrency(inv.remainingAmount)}</h3>
        </div>
      </div>
    </div>
  `;

  openModal('edit-invoice-modal');
}

function onEditPayTypeChange() {
  const type = document.getElementById('edit-inv-paytype').value;
  const paidInput = document.getElementById('edit-inv-paid');
  const inv = (App.db.invoices || []).find(i => i.id === activeEditInvoiceId);
  if (!inv) return;

  if (type === 'كاش') {
    recalcEditInvoiceTotals(true);
  } else if (type === 'آجل') {
    if (paidInput) paidInput.value = 0;
    recalcEditInvoiceTotals();
  } else {
    recalcEditInvoiceTotals();
  }
}

function recalcEditInvoiceTotals(setPaidFull = false) {
  const inv = (App.db.invoices || []).find(i => i.id === activeEditInvoiceId);
  if (!inv) return;

  let subtotal = 0;
  (inv.items || []).forEach((item, index) => {
    const input = document.getElementById(`edit-item-qty-${index}`);
    if (input) {
      const qty = Math.max(1, parseInt(input.value) || 1);
      const total = qty * (item.price || 0);
      subtotal += total;
      const totalEl = document.getElementById(`edit-item-total-${index}`);
      if (totalEl) totalEl.textContent = App.formatCurrency(total);
    }
  });

  const discInput = document.getElementById('edit-inv-discount');
  const discount = Math.max(0, parseFloat(discInput ? discInput.value : 0) || 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const paidInput = document.getElementById('edit-inv-paid');
  if (setPaidFull && paidInput) {
    paidInput.value = grandTotal;
  }

  const paidAmount = Math.min(grandTotal, Math.max(0, parseFloat(paidInput ? paidInput.value : 0) || 0));
  const remainingAmount = Math.max(0, grandTotal - paidAmount);

  const grandEl = document.getElementById('edit-inv-grand-total');
  const remEl = document.getElementById('edit-inv-remaining');

  if (grandEl) grandEl.textContent = App.formatCurrency(grandTotal);
  if (remEl) remEl.textContent = App.formatCurrency(remainingAmount);
}

function saveEditedInvoice() {
  const inv = (App.db.invoices || []).find(i => i.id === activeEditInvoiceId);
  if (!inv) return;

  const newCustName = document.getElementById('edit-inv-customer').value;
  const newPayType = document.getElementById('edit-inv-paytype').value;
  const newDiscount = Math.max(0, parseFloat(document.getElementById('edit-inv-discount').value) || 0);
  
  // 1. Re-balance inventory stock differences
  let newSubtotal = 0;
  (inv.items || []).forEach((item, index) => {
    const input = document.getElementById(`edit-item-qty-${index}`);
    if (input) {
      const newQty = Math.max(1, parseInt(input.value) || 1);
      const oldQty = item.qty || 0;
      const diff = newQty - oldQty; // if diff > 0, deduct stock. If diff < 0, restore stock.

      const prod = (App.db.products || []).find(p => p.id === item.id || p.name === item.name);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - diff);
      }

      item.qty = newQty;
      item.total = newQty * (item.price || 0);
      newSubtotal += item.total;
    }
  });

  const newGrandTotal = Math.max(0, newSubtotal - newDiscount);
  const paidInput = document.getElementById('edit-inv-paid');
  let newPaid = Math.min(newGrandTotal, Math.max(0, parseFloat(paidInput.value) || 0));
  if (newPayType === 'كاش') newPaid = newGrandTotal;
  if (newPayType === 'آجل') newPaid = 0;
  const newRemaining = Math.max(0, newGrandTotal - newPaid);

  // 2. Adjust Finances (Treasury & Customer Debts)
  const oldPaid = inv.paidAmount || 0;
  const oldRemaining = inv.remainingAmount || 0;
  const oldCustName = inv.customerName;

  // Treasury adjustment
  const treasuryDiff = newPaid - oldPaid;
  App.db.treasury = Math.max(0, (App.db.treasury || 0) + treasuryDiff);

  // Customer debt adjustment
  if (oldCustName === newCustName) {
    const cust = (App.db.customers || []).find(c => c.name === newCustName);
    if (cust) {
      const debtDiff = newRemaining - oldRemaining;
      cust.totalDebt = Math.max(0, (cust.totalDebt || 0) + debtDiff);
    }
  } else {
    // Customer changed
    const oldCust = (App.db.customers || []).find(c => c.name === oldCustName);
    if (oldCust) oldCust.totalDebt = Math.max(0, (oldCust.totalDebt || 0) - oldRemaining);

    const newCust = (App.db.customers || []).find(c => c.name === newCustName);
    if (newCust) {
      newCust.totalDebt = (newCust.totalDebt || 0) + newRemaining;
      inv.customerId = newCust.id;
    }
  }

  // 3. Save new invoice properties
  inv.customerName = newCustName;
  inv.paymentType = newPayType;
  inv.discount = newDiscount;
  inv.subtotal = newSubtotal;
  inv.grandTotal = newGrandTotal;
  inv.paidAmount = newPaid;
  inv.remainingAmount = newRemaining;
  inv.totalSacks = (inv.items || []).reduce((s, i) => s + (i.qty || 0), 0);

  if (typeof App.logActivity === 'function') {
    App.logActivity('تعديل فاتورة مبيعات 📝', `تم تعديل بيانات الفاتورة (${inv.id}) للعميل (${newCustName}) بإجمالي جديد (${App.formatCurrency(newGrandTotal)})`, 'info');
  }

  App.save();
  closeModal('edit-invoice-modal');
  loadInvoicesTable();
  renderPageSummaryCards('sales', 'sales-summary-cards');
  App.showToast(`تم حفظ وتحديث الفاتورة (${inv.id}) وإعادة ضبط المخزون والحسابات بنجاح 💾✨`, 'success');
}

// Delete Invoice Completely (Super Admin Only)
function deleteInvoice(invId) {
  const currentUser = App.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، خاصية حذف الفواتير مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const inv = (App.db.invoices || []).find(i => i.id === invId);
  if (!inv) return;

  App.showConfirmModal({
    title: 'حذف الفاتورة نهائياً',
    message: `تحذير: هل أنت متأكد من الحذف النهائي للفاتورة رقم (${inv.id}) للعميل (${inv.customerName})؟ سيتم مسحها نهائياً من قاعدة البيانات والسحابة.`,
    icon: 'fa-solid fa-trash-can',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف الفاتورة نهائياً 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      App.db.invoices = (App.db.invoices || []).filter(i => i.id !== invId);
      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف فاتورة مبيعات 🗑️', `تم حذف الفاتورة (${inv.id}) نهائياً من السيستم`, 'danger');
      }
      App.save();
      loadInvoicesTable();
      renderPageSummaryCards('sales', 'sales-summary-cards');
      App.showToast(`تم حذف الفاتورة (${inv.id}) نهائياً من النظام والسحابة 🗑️`, 'danger');
    }
  });
}

// Quick Invoice Preview Card Modal
function previewInvoice(invId) {
  let inv = App.db.invoices.find(i => i.id === invId);
  if (!inv && currentDraftInvoice && currentDraftInvoice.id === invId) {
    inv = currentDraftInvoice;
  }
  if (!inv) return;

  renderInvoicePreviewContent(inv, !!inv.isDraft);
  openModal('preview-invoice-modal');
}

function renderInvoicePreviewContent(inv, isDraft = false) {
  const container = document.getElementById('invoice-preview-container');
  if (!container) return;

  container.innerHTML = `
    <div id="printable-invoice-content" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl !important; text-align: right !important; letter-spacing: 0px !important; word-spacing: 0px !important; color: #1e293b; background: #ffffff; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; width: 100%;">
      
      <!-- Invoice Header with Real Logo -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${(typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png'}" alt="شعار مصنع الإيمان" style="height: 52px; width: 52px; object-fit: contain; flex-shrink: 0;">
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
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="flex: 1; min-width: 180px;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">بيانات العميل المستلم:</span>
          <strong style="font-size: 1.05rem; color: #0f172a; font-family: 'Cairo', sans-serif;">${inv.customerName}</strong>
          ${(() => {
            const cust = App.db.customers ? App.db.customers.find(c => c.name === inv.customerName || c.id === inv.customerId) : null;
            return cust && cust.phone ? `<span style="font-size: 0.8rem; color: #64748b; margin-right: 8px;">| هاتف: <strong style="color: #059669;">${cust.phone}</strong></span>` : '';
          })()}
        </div>
        <div style="text-align: left;">
          <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px;">طريقة السداد:</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem;">${inv.paymentType}</span>
        </div>
      </div>

      <!-- Items Table (Responsive Horizontal Scroll on Small Phones) -->
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
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
            ${inv.items.map(item => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${item.name}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;"><span style="background: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">${item.unit}</span></td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700;">
                  ${item.qty} شكارة
                  ${(item.returnedQty && item.returnedQty > 0) ? `<div style="font-size: 0.72rem; color: #dc2626; font-weight: 700;">(مرتجع: ${item.returnedQty} شكارة)</div>` : ''}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${App.formatCurrency(item.price)}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 800; color: #059669;">${App.formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals Breakdown & Official Seal -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; flex-wrap: wrap; gap: 10px; border-top: 2px solid #e2e8f0; padding-top: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 220px;">
          <!-- Official Stamp -->
          <div style="border: 2px solid #059669; padding: 6px 10px; border-radius: 8px; color: #059669; text-align: center; background: rgba(5, 150, 105, 0.04); flex-shrink: 0;">
            <img src="${(typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png'}" alt="شعار" style="height: 24px; display: block; margin: 0 auto 2px auto;">
            <strong style="font-size: 0.75rem; display: block;">مصنع الإيمان للمكرونة</strong>
            <span style="font-size: 0.68rem; font-weight: 700;">${isDraft ? 'معاينة مسودة' : 'معتمدة رسمياً 🌾'}</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748b; line-height: 1.3;">
            <p style="font-weight: 700; color: #334155; margin: 0 0 2px 0;">شكراً لتعاملكم مع مصنع الإيمان للمكرونة 🌾</p>
            <p style="margin: 0;">* يسعدنا خدمتكم دائماً وتوفير أجود أنواع المكرونة بالشكارة.</p>
          </div>
        </div>

        <div style="flex: 1; min-width: 220px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #475569;">
            <span>المجموع الفرعي للشكاير:</span>
            <strong style="color: #1e293b;">${App.formatCurrency(inv.subtotal)}</strong>
          </div>
          ${inv.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 3px; color: #dc2626;">
            <span>الخصم المباشر:</span>
            <strong>-${App.formatCurrency(inv.discount)}</strong>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.05rem; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 3px; color: #059669; font-family: 'Cairo', sans-serif;">
            <span>الإجمالي الواجب سداده:</span>
            <span>${App.formatCurrency(inv.grandTotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 3px;">
            <span>المسدد: ${App.formatCurrency(inv.paidAmount)}</span>
            <span>المتبقي: ${App.formatCurrency(inv.remainingAmount)}</span>
          </div>
        </div>
      </div>

    </div>
  `;

  // Attach button actions
  const btnPrint = document.getElementById('btn-print-inv');
  const btnPdf = document.getElementById('btn-pdf-inv');
  const btnImg = document.getElementById('btn-img-inv');
  const btnWa = document.getElementById('btn-wa-inv');
  const confirmContainer = document.getElementById('confirm-save-container');

  if (btnPrint) btnPrint.onclick = () => window.print();
  if (btnPdf) btnPdf.onclick = () => {
    App.showToast('جاري تحويل وتصدير ملف PDF للفاتورة الرسمية...', 'success');
    window.print();
  };
  if (btnImg) btnImg.onclick = () => downloadInvoiceAsImage();
  if (btnWa) btnWa.onclick = () => sendInvoiceWhatsApp(inv.id);

  if (confirmContainer) {
    if (isDraft) {
      confirmContainer.innerHTML = `
        <button class="btn btn-success" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 0.65rem 1.35rem; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(16,185,129,0.3);" onclick="confirmAndCommitDraftInvoice()">
          <i class="fa-solid fa-circle-check ml-1"></i> تأكيد وإصدار الفاتورة ⚡
        </button>
      `;
    } else {
      confirmContainer.innerHTML = `
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="closeModal('preview-invoice-modal'); openInvoiceReturnModal('${inv.id}');" style="color: #d97706; font-weight: 700; border-radius: 8px;">
            <i class="fa-solid fa-rotate-left"></i> مرتجع شكاير
          </button>
          <button class="btn btn-secondary btn-sm" onclick="closeModal('preview-invoice-modal'); openEditInvoiceModal('${inv.id}');" style="color: #2563eb; font-weight: 700; border-radius: 8px;">
            <i class="fa-solid fa-pen-to-square"></i> تعديل الفاتورة
          </button>
          <span class="badge badge-emerald font-bold" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; border-radius: 8px;">
            <i class="fa-solid fa-circle-check ml-1"></i> معتمدة بالسجل
          </span>
        </div>
      `;
    }
  }
}





