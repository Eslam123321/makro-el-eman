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
        <input type="number" min="0" value="${item.price}" class="form-control text-center font-bold" style="width: 95px; height: 32px; padding: 2px;" onclick="this.select()" oninput="updateInvoiceItemRealtime(${idx}, 'price', this.value)">
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

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong>${inv.id}</strong></td>
      <td>${inv.customerName}</td>
      <td>${App.formatTimestamp(inv.date)}</td>
      <td><span class="badge ${inv.paymentType === 'كاش' ? 'badge-success' : 'badge-warning'}">${inv.paymentType}</span></td>
      <td><strong class="text-success">${App.formatCurrency(inv.grandTotal)}</strong></td>
      <td><span class="badge ${inv.status === 'مؤكدة' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="previewInvoice('${inv.id}')" title="معاينة"><i class="fa-solid fa-eye"></i> معاينة الفاتورة</button>
          <button class="btn btn-whatsapp btn-sm" onclick="sendInvoiceWhatsApp('${inv.id}')" title="إرسال عبر الواتساب"><i class="fa-brands fa-whatsapp"></i> الواتساب</button>
        </div>
      </td>
    </tr>
  `).join('');
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
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${item.qty} شكارة</td>
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
        <span class="badge badge-emerald font-bold" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: #d1fae5; color: #047857; border: 1px solid #a7f3d0;">
          <i class="fa-solid fa-circle-check ml-1"></i> فاتورة مؤكدة ومسجلة بالسجل
        </span>
      `;
    }
  }
}




