/* ==========================================================================
   مصنع الإيمان للمكرونة - Inventory Management Script (STRICTLY NO SKU, ONLY SACKS)
   Pure JavaScript (ES6+)
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('inventory');
  loadInventoryTable();

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterProducts(searchQuery);
    }
  }
});

function filterProducts(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = App.db.products.filter(p => 
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q)
  );
  loadInventoryTable(filtered);
}

// Render Inventory Table
function loadInventoryTable(productsData = null) {
  const tbody = document.getElementById('inventory-list-tbody');
  if (!tbody) return;

  const products = productsData || App.db.products;
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد منتجات بالمخزن مطبقة عليها الفلترة</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>
        <strong>${p.name}</strong>
        <div class="text-xs text-muted">فئة: ${p.category}</div>
      </td>
      <td><span class="badge badge-blue">${p.unit}</span></td>
      <td>
        <strong style="font-size: 1.05rem;" class="${p.stock < 150 ? 'text-danger' : 'text-primary-color'}">
          ${p.stock} شكارة
        </strong>
      </td>
      <td>${App.formatCurrency(p.costPrice)} / شكارة</td>
      <td><strong class="text-success">${App.formatCurrency(p.sellPrice)} / شكارة</strong></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="openAddBatchModal('${p.id}')" title="إضافة شحنة/وارد"><i class="fa-solid fa-plus"></i> توريد جديد</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${p.id}')" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Modal Card: Create New Product (NO SKU FIELD)
function saveNewProduct() {
  const nameInput = document.getElementById('prod-name');
  const catInput = document.getElementById('prod-category');
  const stockInput = document.getElementById('prod-stock');
  const costInput = document.getElementById('prod-cost');
  const sellInput = document.getElementById('prod-sell');

  const name = nameInput.value.trim();
  if (!name) {
    App.showToast('رجاء ادخل اسم المنتج وتحديد نوع الشكارة', 'warning');
    return;
  }

  const stock = parseInt(stockInput.value) || 0;
  const cost = parseFloat(costInput.value) || 0;
  const sell = parseFloat(sellInput.value) || 0;

  const newProd = {
    id: `PRD-${100 + App.db.products.length + 1}`,
    name: name.includes('شكارة') ? name : `${name} (شكارة)`, // Ensure Sack in name
    unit: 'شكارة', // STRICTLY ONLY SACKS
    stock: stock,
    costPrice: cost,
    sellPrice: sell,
    category: catInput.value || 'درجة أولى'
  };

  App.db.products.push(newProd);
  App.save();
  loadInventoryTable();
  if (document.getElementById('new-product-modal')) closeModal('new-product-modal');

  // Reset form
  nameInput.value = '';
  stockInput.value = '';
  costInput.value = '';
  sellInput.value = '';

  App.showToast(`تمت إضافة صنف المكرونة الجديد (${newProd.name})`, 'success');
}

// Dynamic Average Costing Logic for New Batches
function openAddBatchModal(prodId) {
  const prod = App.db.products.find(p => p.id === prodId);
  if (!prod) return;

  document.getElementById('batch-prod-id').value = prod.id;
  document.getElementById('batch-prod-title').textContent = `${prod.name} (المخزون الحالي: ${prod.stock} شكارة | التكلفة الحالية: ${prod.costPrice} ج.م)`;
  document.getElementById('batch-qty').value = '';
  document.getElementById('batch-cost').value = prod.costPrice;

  openModal('add-batch-modal');
}

function processNewBatchSupply() {
  const prodId = document.getElementById('batch-prod-id').value;
  const qtyInput = document.getElementById('batch-qty');
  const costInput = document.getElementById('batch-cost');

  const addedQty = parseInt(qtyInput.value) || 0;
  const newBatchCost = parseFloat(costInput.value) || 0;

  if (addedQty <= 0) {
    App.showToast('رجاء ادخل كمية الشحنة الموردة الجديدة', 'warning');
    return;
  }

  const prod = App.db.products.find(p => p.id === prodId);
  if (!prod) return;

  // DYNAMIC AVERAGE COST FORMULA:
  // Weighted Average Cost = ((OldStock * OldCost) + (AddedQty * AddedCost)) / (OldStock + AddedQty)
  const oldTotalCost = prod.stock * prod.costPrice;
  const newBatchTotalCost = addedQty * newBatchCost;
  const updatedStock = prod.stock + addedQty;
  const updatedAverageCost = Math.round((oldTotalCost + newBatchTotalCost) / updatedStock);

  prod.stock = updatedStock;
  prod.costPrice = updatedAverageCost;

  App.save();
  loadInventoryTable();
  closeModal('add-batch-modal');

  App.showToast(`تم توريد ${addedQty} شكارة وتحديث متوسط سعر التكلفة الآلي إلى (${updatedAverageCost} ج.م)`, 'success');
}

// Modal Card: Edit Product
function openEditProductModal(prodId) {
  const prod = App.db.products.find(p => p.id === prodId);
  if (!prod) return;

  document.getElementById('edit-prod-id').value = prod.id;
  document.getElementById('edit-prod-name').value = prod.name;
  document.getElementById('edit-prod-stock').value = prod.stock;
  document.getElementById('edit-prod-cost').value = prod.costPrice;
  document.getElementById('edit-prod-sell').value = prod.sellPrice;
  document.getElementById('edit-prod-category').value = prod.category;

  openModal('edit-product-modal');
}

function updateProduct() {
  const prodId = document.getElementById('edit-prod-id').value;
  const prod = App.db.products.find(p => p.id === prodId);
  if (!prod) return;

  prod.name = document.getElementById('edit-prod-name').value;
  prod.stock = parseInt(document.getElementById('edit-prod-stock').value) || 0;
  prod.costPrice = parseFloat(document.getElementById('edit-prod-cost').value) || 0;
  prod.sellPrice = parseFloat(document.getElementById('edit-prod-sell').value) || 0;
  prod.category = document.getElementById('edit-prod-category').value;

  App.save();
  loadInventoryTable();
  closeModal('edit-product-modal');
  App.showToast('تم تحديث بيانات الصنف بنجاح', 'success');
}

function deleteProduct(prodId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف الأصناف من المخزن مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const prod = (App.db.products || []).find(p => p.id === prodId);
  if (!prod) return;

  App.showConfirmModal({
    title: 'حذف صنف من المخزن',
    message: `هل أنت متأكد من رغبتك في حذف الصنف (${prod.name}) نهائياً من المخزن وقاعدة البيانات؟`,
    icon: 'fa-solid fa-box-archive',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف الصنف 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      const prodName = prod.name;
      App.db.products = (App.db.products || []).filter(p => p.id !== prodId);
      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف صنف من المخزن 🗑️', `تم حذف الصنف (${prodName}) نهائياً من المخازن`, 'danger');
      }
      App.save();
      loadInventoryTable();
      if (typeof renderPageSummaryCards === 'function') renderPageSummaryCards('inventory', 'inventory-summary-cards');
      App.showToast(`تم حذف الصنف (${prodName}) نهائياً من النظام والسحابة 🗑️`, 'danger');
    }
  });
}

/* ==========================================================================
   Comprehensive Inventory & Stocktaking Audit Report (Daily, Monthly, Yearly & Custom Range)
   ========================================================================== */

function openInventoryReportModal() {
  const periodSelect = document.getElementById('inv-report-period');
  if (periodSelect) periodSelect.value = 'current_month';

  const todayIso = new Date().toISOString().slice(0, 10);
  const singleDateIn = document.getElementById('inv-single-date');
  const startIn = document.getElementById('inv-start-date');
  const endIn = document.getElementById('inv-end-date');

  if (singleDateIn) singleDateIn.value = todayIso;
  if (startIn) startIn.value = todayIso;
  if (endIn) endIn.value = todayIso;

  handleInvReportPeriodChange('current_month');
  openModal('inventory-report-modal');
}

function handleInvReportPeriodChange(periodVal) {
  const singleGroup = document.getElementById('inv-single-day-group');
  const startGroup = document.getElementById('inv-custom-start-group');
  const endGroup = document.getElementById('inv-custom-end-group');

  if (singleGroup) singleGroup.style.display = periodVal === 'day_specific' ? 'block' : 'none';
  if (startGroup) startGroup.style.display = periodVal === 'custom' ? 'block' : 'none';
  if (endGroup) endGroup.style.display = periodVal === 'custom' ? 'block' : 'none';

  renderInventoryReportContent();
}

function renderInventoryReportContent() {
  const container = document.getElementById('inventory-report-content-container');
  if (!container) return;

  const periodVal = document.getElementById('inv-report-period') ? document.getElementById('inv-report-period').value : 'current_month';
  const catFilter = document.getElementById('inv-category-filter') ? document.getElementById('inv-category-filter').value : 'all';
  const singleDateVal = document.getElementById('inv-single-date') ? document.getElementById('inv-single-date').value : '';
  const startDateVal = document.getElementById('inv-start-date') ? document.getElementById('inv-start-date').value : '';
  const endDateVal = document.getElementById('inv-end-date') ? document.getElementById('inv-end-date').value : '';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayIso = now.toISOString().slice(0, 10);

  let periodLabel = 'الجرد الشامل للمخزن';
  let dateFilterFn = (invDateStr) => true;

  if (periodVal === 'today') {
    periodLabel = `جرد اليوم: ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now)}`;
    dateFilterFn = (d) => d && d.startsWith(todayIso);
  } else if (periodVal === 'day_specific' && singleDateVal) {
    const dObj = new Date(singleDateVal);
    periodLabel = `جرد يوم: ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(dObj)} (${singleDateVal})`;
    dateFilterFn = (d) => d && d.startsWith(singleDateVal);
  } else if (periodVal === 'current_month') {
    periodLabel = `جرد شهر ${new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(now)}`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}-${currentMonth}`);
  } else if (periodVal.startsWith('month_')) {
    const mNum = periodVal.replace('month_', '');
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    periodLabel = `جرد شهر ${monthNames[parseInt(mNum) - 1]} لسنة ${currentYear}`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}-${mNum}`);
  } else if (periodVal === 'year') {
    periodLabel = `تقرير جرد سنة ${currentYear} كاملة`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}`);
  } else if (periodVal === 'custom' && startDateVal && endDateVal) {
    periodLabel = `فترة الجرد: من تاريخ (${startDateVal}) إلى (${endDateVal})`;
    dateFilterFn = (d) => d && d.slice(0, 10) >= startDateVal && d.slice(0, 10) <= endDateVal;
  } else if (periodVal === 'all') {
    periodLabel = 'الجرد الشامل لكافة الأصناف بالمخزن';
    dateFilterFn = (d) => true;
  }

  // Filter products by category if chosen
  let products = App.db.products || [];
  if (catFilter && catFilter !== 'all') {
    products = products.filter(p => p.category === catFilter);
  }

  // Calculate dispatched/sold quantities in this period from App.db.invoices
  const periodInvoices = (App.db.invoices || []).filter(inv => dateFilterFn(inv.date));
  const productSoldMap = {};

  periodInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const pName = (item.name || '').trim();
      productSoldMap[pName] = (productSoldMap[pName] || 0) + (item.qty || 0);
    });
  });

  // Calculate totals
  const totalSacks = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalCostVal = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || 0)), 0);
  const totalSellVal = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.sellPrice || 0)), 0);
  const totalProfitMargin = totalSellVal - totalCostVal;
  const totalSoldInPeriod = Object.values(productSoldMap).reduce((a, b) => a + b, 0);

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  container.innerHTML = `
    <div id="printable-inventory-report-sheet" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl; text-align: right; color: #1e293b; background: #ffffff;">
      
      <!-- Report Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 60px; width: 60px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; font-weight: 700; font-size: 1.4rem; margin: 0 0 2px 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 2px 0;">إدارة المخازن ومراقبة المخزون وتكلفة الإنتاج</p>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">تقرير الجرد الدوري وحركة الأصناف المعتمد</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="font-weight: 700; color: #1e293b; margin: 0 0 2px 0; font-size: 1.15rem;">تقرير جرد المخزون</h3>
          <p style="font-size: 0.85rem; font-weight: 700; color: #059669; margin: 0 0 2px 0;">${periodLabel}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">تاريخ التحرير: ${App.getFormattedCurrentDate()}</p>
        </div>
      </div>

      <!-- KPI Summary Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #64748b; font-weight: bold; display: block;">إجمالي الشكاير المتوفرة</span>
          <strong style="font-size: 1.15rem; color: #059669; display: block; margin-top: 2px;">${totalSacks} شكارة</strong>
          <span style="font-size: 0.65rem; color: #94a3b8;">(${products.length} أصناف مسجلة)</span>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #1e40af; font-weight: bold; display: block;">تقييم المخزون بالتكلفة</span>
          <strong style="font-size: 1.05rem; color: #1d4ed8; display: block; margin-top: 2px;">${App.formatCurrency(totalCostVal)}</strong>
          <span style="font-size: 0.65rem; color: #1e40af;">رأس المال بالمخزن</span>
        </div>

        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #065f46; font-weight: bold; display: block;">القيمة البيعية المتوقعة</span>
          <strong style="font-size: 1.05rem; color: #047857; display: block; margin-top: 2px;">${App.formatCurrency(totalSellVal)}</strong>
          <span style="font-size: 0.65rem; color: #065f46;">إجمالي الإيراد المتوقع</span>
        </div>

        <div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #86198f; font-weight: bold; display: block;">هامش الأرباح المتوقع</span>
          <strong style="font-size: 1.05rem; color: #a21caf; display: block; margin-top: 2px;">+${App.formatCurrency(totalProfitMargin)}</strong>
          <span style="font-size: 0.65rem; color: #86198f;">ربح البضاعة المتوفرة</span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #92400e; font-weight: bold; display: block;">منصرف المبيعات بالفترة</span>
          <strong style="font-size: 1.05rem; color: #b45309; display: block; margin-top: 2px;">${totalSoldInPeriod} شكارة</strong>
          <span style="font-size: 0.65rem; color: #92400e;">(${periodInvoices.length} فاتورة مسجلة)</span>
        </div>
      </div>

      <!-- Inventory Breakdown Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0; font-size: 0.78rem;">
        <thead style="background: #f1f5f9;">
          <tr>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">كود الصنف</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">اسم المنتج والعبوة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">الفئة والدرجة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">المخزون الحالي</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">سعر التكلفة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">إجمالي التكلفة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">سعر البيع</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">إجمالي البيع</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">المبيعات بالفترة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">حالة المخزون</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const costTotal = (p.stock || 0) * (p.costPrice || 0);
            const sellTotal = (p.stock || 0) * (p.sellPrice || 0);
            const soldQty = productSoldMap[p.name] || 0;
            
            let statusTag = `<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: bold;">متوفر 🟢</span>`;
            if (p.stock <= 0) {
              statusTag = `<span style="background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-weight: bold;">نفد 🔴</span>`;
            } else if (p.stock < 150) {
              statusTag = `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">منخفض ⚠️</span>`;
            }

            return `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${p.id}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
                  <strong>${p.name}</strong>
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${p.category}</span>
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; font-size: 0.85rem; color: ${p.stock < 150 ? '#dc2626' : '#059669'};">
                  ${p.stock} شكارة
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left;">${App.formatCurrency(p.costPrice)}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #1d4ed8;">${App.formatCurrency(costTotal)}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left;">${App.formatCurrency(p.sellPrice)}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #059669;">${App.formatCurrency(sellTotal)}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">
                  ${soldQty > 0 ? `<span style="color: #b45309;">${soldQty} شكارة</span>` : '<span style="color: #94a3b8;">-</span>'}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${statusTag}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 14px;">
        <div style="border: 2px solid #059669; padding: 6px 12px; border-radius: 8px; color: #059669; text-align: center; background: rgba(5, 150, 105, 0.04);">
          <img src="${logoSrc}" alt="شعار" style="height: 24px; display: block; margin: 0 auto 2px auto;">
          <strong style="font-size: 0.8rem; display: block;">مصنع الإيمان للمكرونة</strong>
          <span style="font-size: 0.7rem; font-weight: 700;">جرد معتمد رسمياً 🌾</span>
        </div>
        <div style="font-size: 0.8rem; color: #475569; text-align: left; line-height: 1.7;">
          <p style="margin: 0;">أمين ومسؤول المخازن: ________________________</p>
          <p style="margin: 0;">مدير الرقابة والجرد العام: ________________________</p>
        </div>
      </div>

    </div>
  `;
}

function printInventoryReport() {
  const contentEl = document.getElementById('printable-inventory-report');
  if (!contentEl) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير جرد المخزون وحركة الأصناف الشامل - مصنع الإيمان</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: 'Cairo', sans-serif; padding: 12px; direction: rtl; color: #0f172a; margin: 0; background: #fff; }
        table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; margin-top: 5px; }
        th, td { border: 1px solid #cbd5e1 !important; padding: 6px 7px !important; text-align: right; }
        th { background: #f8fafc !important; font-weight: 800; color: #1e293b; text-align: center; }
        .no-print { display: none !important; }
      </style>
    </head>
    <body>
      ${contentEl.outerHTML}
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
