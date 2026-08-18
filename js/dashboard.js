/* ==========================================================================
   مصنع الإيمان للمكرونة - Executive Dashboard Script (Enterprise Edition)
   Pure JavaScript (ES6+)
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

let currentDashboardFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('dashboard');
  loadDashboardData();
  renderDateHeader();
});

function renderDateHeader() {
  const ticker = document.getElementById('date-ticker');
  if (ticker) {
    ticker.innerHTML = `<span><i class="fa-regular fa-calendar-check text-primary-color ml-1"></i> ${App.getFormattedCurrentDate()}</span>`;
  }
}

function setDashboardTimeFilter(filterPeriod) {
  currentDashboardFilter = filterPeriod;
  document.querySelectorAll('.time-filter-btn').forEach(btn => btn.classList.remove('btn-primary'));
  const activeBtn = document.getElementById(`filter-btn-${filterPeriod}`);
  if (activeBtn) activeBtn.classList.add('btn-primary');

  loadDashboardData();
  App.showToast(`تم تصفية لوحة التحكم للفترة: (${filterPeriod === 'today' ? 'اليوم' : (filterPeriod === 'month' ? 'الشهر الحالي' : (filterPeriod === 'year' ? 'السنة الحالية' : 'كافة الأوقات'))})`, 'info');
}

function loadDashboardData() {
  const invoices = App.db.invoices;
  const expenses = App.db.expenses;
  const customers = App.db.customers;
  const products = App.db.products;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);
  const yearStr = String(now.getFullYear());

  // Filtered datasets based on currentDashboardFilter
  let filteredInvoices = invoices;
  let filteredExpenses = expenses;

  if (currentDashboardFilter === 'today') {
    filteredInvoices = invoices.filter(i => i.date.startsWith(todayStr));
    filteredExpenses = expenses.filter(e => e.date.startsWith(todayStr));
  } else if (currentDashboardFilter === 'month') {
    filteredInvoices = invoices.filter(i => i.date.startsWith(monthStr));
    filteredExpenses = expenses.filter(e => e.date.startsWith(monthStr));
  } else if (currentDashboardFilter === 'year') {
    filteredInvoices = invoices.filter(i => i.date.startsWith(yearStr));
    filteredExpenses = expenses.filter(e => e.date.startsWith(yearStr));
  }

  // Helper for Net Sales of an invoice (excluding full returns, and using active net grandTotal)
  const getNetSales = (inv) => inv.status === 'مرتجعة بالكامل' ? 0 : (inv.grandTotal || 0);

  // Helper for Net Active COGS
  function getCOGS(invList) {
    let cogs = 0;
    invList.forEach(inv => {
      if (inv.status === 'مرتجعة بالكامل') return;
      (inv.items || []).forEach(item => {
        const prd = products.find(p => p.id === item.id || p.name === item.name);
        const cost = prd ? prd.costPrice : (item.price * 0.8);
        const activeQty = Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
        cogs += (cost * activeQty);
      });
    });
    return cogs;
  }

  // Calculate Net Sales Breakdown
  const salesToday = invoices.filter(i => i.date.startsWith(todayStr)).reduce((a, b) => a + getNetSales(b), 0);
  const salesMonth = invoices.filter(i => i.date.startsWith(monthStr)).reduce((a, b) => a + getNetSales(b), 0);
  const salesYear = invoices.filter(i => i.date.startsWith(yearStr)).reduce((a, b) => a + getNetSales(b), 0);
  const totalSalesAll = invoices.reduce((a, b) => a + getNetSales(b), 0);

  const profitToday = salesToday - getCOGS(invoices.filter(i => i.date.startsWith(todayStr))) - expenses.filter(e => e.date.startsWith(todayStr)).reduce((a, b) => a + b.amount, 0);
  const profitMonth = salesMonth - getCOGS(invoices.filter(i => i.date.startsWith(monthStr))) - expenses.filter(e => e.date.startsWith(monthStr)).reduce((a, b) => a + b.amount, 0);
  const profitYear = salesYear - getCOGS(invoices.filter(i => i.date.startsWith(yearStr))) - expenses.filter(e => e.date.startsWith(yearStr)).reduce((a, b) => a + b.amount, 0);
  
  const currentSales = filteredInvoices.reduce((a, b) => a + getNetSales(b), 0);
  const currentExp = filteredExpenses.reduce((a, b) => a + b.amount, 0);
  const currentCOGS = getCOGS(filteredInvoices);
  const currentNetProfit = currentSales - currentCOGS - currentExp;

  // Complete Financial Balance (Liquidity, Customer Debts, Supplier Dues)
  const totalDebts = (customers || []).reduce((a, b) => a + (b.totalDebt || 0), 0);
  const supplierDues = (App.db.suppliers || []).reduce((a, b) => a + (b.totalBalance || 0), 0);
  const cashLiquidity = App.db.treasury || 0;
  const netFinancial = cashLiquidity + totalDebts - supplierDues;

  // Render Daily, Monthly, Yearly Breakdowns
  if (document.getElementById('sales-today-val')) document.getElementById('sales-today-val').textContent = App.formatCurrency(salesToday);
  if (document.getElementById('sales-month-val')) document.getElementById('sales-month-val').textContent = App.formatCurrency(salesMonth);
  if (document.getElementById('sales-year-val')) document.getElementById('sales-year-val').textContent = App.formatCurrency(salesYear);

  // Profit / Loss Dynamic Coloring & Labels
  const profitTodayTitleEl = document.getElementById('profit-today-title');
  const profitTodayValEl = document.getElementById('profit-today-val');
  const profitIconBox = document.getElementById('profit-icon-box');

  if (profitTodayValEl) {
    profitTodayValEl.textContent = App.formatCurrency(profitToday);
    if (profitToday < 0) {
      profitTodayValEl.className = 'text-danger font-bold';
      if (profitTodayTitleEl) profitTodayTitleEl.innerHTML = 'صافي خسائر اليوم <span style="font-size: 0.75rem; color: #dc2626;">(عجز مصاريف)</span>';
      if (profitIconBox) profitIconBox.className = 'summary-card-icon icon-rose';
    } else {
      profitTodayValEl.className = 'text-success font-bold';
      if (profitTodayTitleEl) profitTodayTitleEl.textContent = 'أرباح اليوم الصافية';
      if (profitIconBox) profitIconBox.className = 'summary-card-icon icon-blue';
    }
  }

  const profitMonthValEl = document.getElementById('profit-month-val');
  if (profitMonthValEl) {
    profitMonthValEl.textContent = App.formatCurrency(profitMonth);
    profitMonthValEl.className = profitMonth < 0 ? 'text-danger font-bold' : 'text-success font-bold';
  }

  const profitYearValEl = document.getElementById('profit-year-val');
  if (profitYearValEl) {
    profitYearValEl.textContent = App.formatCurrency(profitYear);
    profitYearValEl.className = profitYear < 0 ? 'text-danger font-bold' : 'text-success font-bold';
  }

  // Render Comprehensive Cash, Debts & Supplier Dues
  if (document.getElementById('cash-liquidity')) document.getElementById('cash-liquidity').textContent = App.formatCurrency(cashLiquidity);
  if (document.getElementById('total-debts')) document.getElementById('total-debts').textContent = App.formatCurrency(totalDebts);
  if (document.getElementById('supplier-dues-val')) document.getElementById('supplier-dues-val').textContent = App.formatCurrency(supplierDues);
  
  const netFinEl = document.getElementById('net-financial-balance');
  if (netFinEl) {
    netFinEl.textContent = App.formatCurrency(netFinancial);
    netFinEl.className = netFinancial < 0 ? 'text-danger font-bold' : 'text-success font-bold';
  }

  // Check low stock products
  const lowStockProds = products.filter(p => p.stock < 150);
  const lowStockBanner = document.getElementById('low-stock-banner');
  if (lowStockBanner) {
    if (lowStockProds.length > 0) {
      lowStockBanner.style.display = 'flex';
      lowStockBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-triangle-exclamation text-warning" style="font-size: 1.25rem;"></i>
          <span>تنبيه مخزون: يوجد <strong>${lowStockProds.length} أصناف مكرونة</strong> اقترب رصيدها من النفاد بالمخزن (${lowStockProds.map(p => p.name + ': ' + p.stock + ' شكارة').join(' | ')})</span>
        </div>
        <a href="inventory.html" class="btn btn-warning btn-sm">توريد مخزون جديد 📦</a>
      `;
    } else {
      lowStockBanner.style.display = 'none';
    }
  }

  renderDashboardBarChart(currentSales, currentCOGS + currentExp, currentNetProfit);
  renderSalesDonutChart(filteredInvoices, products);
  renderProductProfitabilityTable('product-profit-tbody', filteredInvoices);
  loadRecentInvoicesTable(invoices);
}

// Render Itemized Product Sales & Profitability Table
function renderProductProfitabilityTable(containerId = 'product-profit-tbody', invoicesList = null) {
  const tbody = document.getElementById(containerId);
  if (!tbody) return;

  const products = (typeof App !== 'undefined' && App.db && App.db.products) ? App.db.products : [];
  const invoices = invoicesList || ((typeof App !== 'undefined' && App.db && App.db.invoices) ? App.db.invoices : []);

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-4">لا توجد أصناف مكرونة مضافة بالمخزن حالياً</td></tr>`;
    return;
  }

  // Aggregate stats per product
  const productStats = {};
  products.forEach(p => {
    productStats[p.id] = {
      id: p.id,
      name: p.name,
      unit: p.unit || 'شكارة',
      costPrice: p.costPrice || 0,
      price: p.sellPrice || p.price || 0,
      sacksSold: 0,
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      profitMargin: 0
    };
  });

  invoices.forEach(inv => {
    if (inv.status === 'مرتجعة بالكامل') return;
    (inv.items || []).forEach(item => {
      const activeQty = Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
      if (activeQty <= 0) return;

      const pId = item.id;
      const targetStat = productStats[pId] || Object.values(productStats).find(ps => ps.name === item.name);
      if (targetStat) {
        const itemSellingPrice = item.price || targetStat.price || 0;
        const itemCostPrice = targetStat.costPrice || (itemSellingPrice * 0.8);
        const itemRev = activeQty * itemSellingPrice;
        const itemCst = activeQty * itemCostPrice;

        targetStat.sacksSold += activeQty;
        targetStat.totalRevenue += itemRev;
        targetStat.totalCost += itemCst;
        if (item.price) targetStat.price = item.price;
      }
    });
  });

  // Calculate net profit and margin
  const rows = Object.values(productStats).map(stat => {
    stat.netProfit = stat.totalRevenue - stat.totalCost;
    stat.profitMargin = stat.totalRevenue > 0 ? ((stat.netProfit / stat.totalRevenue) * 100).toFixed(1) : 0;
    return stat;
  });

  tbody.innerHTML = rows.map(stat => `
    <tr>
      <td><strong>${stat.name}</strong> <span class="badge badge-secondary" style="font-size: 0.75rem; margin-right: 4px;">${stat.unit}</span></td>
      <td style="text-align: center;"><span class="text-muted font-bold">${App.formatCurrency(stat.costPrice)}</span></td>
      <td style="text-align: center;"><strong class="text-primary-color">${App.formatCurrency(stat.price)}</strong></td>
      <td style="text-align: center;"><strong class="text-dark">${stat.sacksSold} شكارة</strong></td>
      <td style="text-align: center;"><strong class="text-success">${App.formatCurrency(stat.totalRevenue)}</strong></td>
      <td style="text-align: center;"><strong class="text-warning">${App.formatCurrency(stat.totalCost)}</strong></td>
      <td style="text-align: left;">
        <strong class="${stat.netProfit >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 1rem;">
          ${stat.netProfit >= 0 ? '+' : ''}${App.formatCurrency(stat.netProfit)}
        </strong>
      </td>
      <td style="text-align: center;">
        <span class="badge ${stat.profitMargin >= 25 ? 'badge-success' : (stat.profitMargin > 0 ? 'badge-warning' : 'badge-secondary')}">
          ${stat.profitMargin}%
        </span>
      </td>
    </tr>
  `).join('');
}

// Render Recent Invoices sorted descending with Status badges and full actions
function loadRecentInvoicesTable(invList = null) {
  const tbody = document.getElementById('recent-invoices-tbody');
  if (!tbody) return;

  const allInvoices = (typeof App !== 'undefined' && App.db && App.db.invoices && App.db.invoices.length > 0)
    ? App.db.invoices 
    : (invList || []);

  if (!allInvoices || allInvoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-4">لا توجد فواتير مبيعات مسجلة بالنظام حالياً</td></tr>`;
    return;
  }

  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = !currentUser || currentUser.id === 'USR-1' || (currentUser.username === 'admin') || currentUser.role === 'مدير عام';

  // Strictly sort descending by date/id and take latest 10 invoices
  const sorted = [...allInvoices].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 10);

  tbody.innerHTML = sorted.map(inv => {
    const totalSacks = (inv.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
    const returnedSacks = (inv.items || []).reduce((sum, item) => sum + (item.returnedQty || 0), 0);
    const activeSacks = Math.max(0, totalSacks - returnedSacks);
    const sacksDisplay = returnedSacks > 0 
      ? `<strong>${activeSacks} شكارة</strong> <span style="font-size: 0.72rem; color: #dc2626; display: block;">(مرتجع: ${returnedSacks})</span>`
      : `<strong>${activeSacks} شكارة</strong>`;

    return `
    <tr>
      <td><strong class="clickable-invoice" onclick="previewInvoice('${inv.id}')" title="اضغط لمعاينة الفاتورة">${inv.id} ↗</strong></td>
      <td><strong>${inv.customerName}</strong></td>
      <td>${App.formatTimestamp(inv.date)}</td>
      <td style="text-align: center;">${sacksDisplay}</td>
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
    `;
  }).join('');
}

function renderDashboardBarChart(sales, expenses, profit) {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;

  if (window.myBarChart) window.myBarChart.destroy();

  const isLoss = profit < 0;
  const profitLabel = isLoss ? 'صافي الخسائر (عجز مصاريف)' : 'صافي الأرباح الفعلية';
  const profitColor = isLoss ? '#dc2626' : '#2563eb';

  window.myBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['إجمالي المبيعات', 'التكاليف والمصروفات', profitLabel],
      datasets: [{
        label: 'المبلغ بالجنيه المصري (EGP)',
        data: [sales, expenses, profit],
        backgroundColor: ['#059669', '#e11d48', profitColor],
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          textDirection: 'rtl',
          titleFont: { family: 'Cairo' },
          bodyFont: { family: 'Cairo' }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Cairo' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Cairo' } } }
      }
    }
  });
}

function renderSalesDonutChart(invoices, products) {
  const ctx = document.getElementById('salesDonutChart');
  if (!ctx) return;

  if (window.myDonutChart) window.myDonutChart.destroy();

  const sackSalesByProduct = {};
  products.forEach(p => sackSalesByProduct[p.name] = 0);

  invoices.forEach(inv => {
    inv.items.forEach(item => {
      if (sackSalesByProduct[item.name] !== undefined) sackSalesByProduct[item.name] += item.qty;
      else sackSalesByProduct[item.name] = item.qty;
    });
  });

  window.myDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(sackSalesByProduct),
      datasets: [{
        data: Object.values(sackSalesByProduct),
        backgroundColor: ['#059669', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#0891b2'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 } } } },
      cutout: '70%'
    }
  });
}
