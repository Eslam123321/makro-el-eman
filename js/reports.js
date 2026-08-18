/* ==========================================================================
   مصنع الإيمان للمكرونة - Auditing & Financial Reports & Fleet Script
   Pure JavaScript (ES6+) - Inventory Valuation Audit & Fleet Logistics
   Developed by Eng/Eslam Saad & Ahmed Waleed
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('reports');
  generateFinancialAuditReport('monthly');
  loadDeliveryTrucksTable();

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('#delivery-fleet-section input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterTrucks(searchQuery);
    }
  }
});

function generateFinancialAuditReport(period = 'monthly') {
  const invoices = App.db.invoices || [];
  const expenses = App.db.expenses || [];
  const products = App.db.products || [];

  let totalSales = 0;
  let totalSacksSold = 0;
  let totalCOGS = 0;

  invoices.forEach(inv => {
    if (inv.status === 'مرتجعة بالكامل') return;
    totalSales += (inv.grandTotal || 0);
    (inv.items || []).forEach(item => {
      const activeQty = Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
      totalSacksSold += activeQty;
      const prd = products.find(p => p.id === item.id || p.name === item.name);
      const cost = prd ? prd.costPrice : (item.price * 0.8);
      totalCOGS += (cost * activeQty);
    });
  });

  const totalExpenses = expenses.reduce((a, b) => a + (b.amount || 0), 0);
  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  // Render values safely
  const elSold = document.getElementById('rep-sacks-sold');
  if (elSold) elSold.textContent = `${totalSacksSold} شكارة`;

  const elRev = document.getElementById('rep-total-revenue');
  if (elRev) elRev.textContent = App.formatCurrency(totalSales);

  const elCogs = document.getElementById('rep-cogs');
  if (elCogs) elCogs.textContent = App.formatCurrency(totalCOGS);

  const elExp = document.getElementById('rep-expenses');
  if (elExp) elExp.textContent = App.formatCurrency(totalExpenses);

  const elProfit = document.getElementById('rep-net-profit');
  if (elProfit) elProfit.textContent = App.formatCurrency(netProfit);

  // Render Master Inventory & Profit Audit Table
  renderAuditTable(products, invoices);
}

// Master Unified Inventory & Profit Audit Table
function renderAuditTable(productsData = null, invoicesData = null) {
  const tbody = document.getElementById('inventory-audit-tbody');
  if (!tbody) return;

  const products = productsData || App.db.products || [];
  const invoices = invoicesData || App.db.invoices || [];

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-6">لا يوجد أصناف مسجلة بالمخزن</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    let sacksSold = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let resolvedSellPrice = p.sellPrice || p.price || 0;

    invoices.forEach(inv => {
      if (inv.status === 'مرتجعة بالكامل') return;
      (inv.items || []).forEach(item => {
        if (item.id === p.id || item.name === p.name) {
          const activeQty = Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
          if (activeQty > 0) {
            const itemPrice = item.price || p.sellPrice || p.price || 0;
            const itemCost = p.costPrice || (itemPrice * 0.8);
            sacksSold += activeQty;
            totalRevenue += (activeQty * itemPrice);
            totalCost += (activeQty * itemCost);
            if (item.price) resolvedSellPrice = item.price;
          }
        }
      });
    });

    const netProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return `
      <tr>
        <td><strong>${p.name}</strong> <span class="badge badge-secondary" style="font-size: 0.75rem; margin-right: 4px;">${p.unit || 'شكارة'}</span></td>
        <td style="text-align: center;"><strong class="${p.stock < 150 ? 'text-danger' : 'text-primary-color'}">${p.stock} شكارة</strong></td>
        <td style="text-align: center;"><strong class="text-dark">${sacksSold} شكارة</strong></td>
        <td style="text-align: center;"><span class="text-muted font-bold">${App.formatCurrency(p.costPrice || 0)}</span></td>
        <td style="text-align: center;"><strong class="text-primary-color">${App.formatCurrency(resolvedSellPrice)}</strong></td>
        <td style="text-align: center;"><strong class="text-success">${App.formatCurrency(totalRevenue)}</strong></td>
        <td style="text-align: center;"><strong class="text-warning">${App.formatCurrency(totalCost)}</strong></td>
        <td style="text-align: left;">
          <strong class="${netProfit >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 1rem;">
            ${netProfit >= 0 ? '+' : ''}${App.formatCurrency(netProfit)}
          </strong>
        </td>
        <td style="text-align: center;">
          <span class="badge ${margin >= 25 ? 'badge-success' : (margin > 0 ? 'badge-warning' : 'badge-secondary')}">
            ${margin}%
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAudit(query) {
  const q = (query || '').trim().toLowerCase();
  const filteredProducts = (App.db.products || []).filter(p => 
    p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
  );
  renderAuditTable(filteredProducts, App.db.invoices || []);
}

// ==========================================
// Delivery Fleet (Trucks & Drivers Management)
// ==========================================

function loadDeliveryTrucksTable(trucksData = null) {
  const tbody = document.getElementById('delivery-trucks-tbody');
  if (!tbody) return;

  const trucks = trucksData || App.db.deliveryTrucks || [];

  if (trucks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد سيارات وسائقين مسجلين بالأسطول حتى الآن</td></tr>`;
    return;
  }

  tbody.innerHTML = trucks.map(t => {
    let badgeClass = 'badge-blue';
    if (t.status.includes('طريق')) badgeClass = 'badge-warning';
    if (t.status.includes('جاهز')) badgeClass = 'badge-success';
    if (t.status.includes('صيانة')) badgeClass = 'badge-danger';

    // Find driver salary from employees
    const emp = (App.db.employees || []).find(e => e.name === t.driverName || (e.truckPlate && e.truckPlate === t.plateNumber));
    const salary = emp ? emp.baseSalary : (t.salary || 7500);

    return `
      <tr>
        <td><strong class="badge badge-purple font-bold">${t.id}</strong></td>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem; background: linear-gradient(135deg, #059669, #10b981); color: #fff;">
              <i class="fa-solid fa-user-gear text-xs"></i>
            </div>
            <div>
              <strong class="text-sm block">${t.driverName}</strong>
              <span class="text-xs text-muted">سائق أسطول معتمد</span>
            </div>
          </div>
        </td>
        <td><span class="badge badge-purple font-bold" style="font-size: 0.85rem;"><i class="fa-solid fa-truck ml-1"></i> ${t.plateNumber}</span></td>
        <td><strong class="text-success font-bold" style="font-size: 0.95rem;">${App.formatCurrency(salary)}</strong></td>
        <td><strong>${t.phone || 'غير مسجل'}</strong></td>
        <td><span class="badge ${badgeClass}">${t.status}</span></td>
        <td>
          <div class="flex gap-2 flex-wrap items-center">
            <button class="btn btn-secondary btn-xs" onclick="openTruckStatementModal('${t.id}')" title="عرض كشف حساب السائق والسيارة">
              <i class="fa-solid fa-file-invoice-dollar text-primary-color ml-1"></i> كشف الحساب 📄
            </button>
            <button class="btn btn-secondary btn-xs" onclick="openEditTruckModal('${t.id}')" title="تعديل بيانات السيارة والسائق والراتب">
              <i class="fa-solid fa-pen-to-square ml-1"></i> تعديل
            </button>
            <button class="btn btn-danger btn-xs" onclick="deleteTruck('${t.id}')" title="حذف السيارة من الأسطول">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTrucks(query) {
  const q = (query || '').trim().toLowerCase();
  const filtered = (App.db.deliveryTrucks || []).filter(t => 
    (t.driverName || '').toLowerCase().includes(q) ||
    (t.plateNumber || '').toLowerCase().includes(q) ||
    (t.phone || '').includes(q) ||
    (t.id || '').toLowerCase().includes(q)
  );
  loadDeliveryTrucksTable(filtered);
}

function saveNewTruck() {
  const driver = document.getElementById('trk-driver').value.trim();
  const plate = document.getElementById('trk-plate').value.trim();
  const salaryInput = document.getElementById('trk-salary');
  const salary = salaryInput ? (parseFloat(salaryInput.value) || 7500) : 7500;
  const payDayInput = document.getElementById('trk-pay-day');
  const payDay = payDayInput ? (parseInt(payDayInput.value) || 1) : 1;
  const phone = document.getElementById('trk-phone').value.trim();
  const status = document.getElementById('trk-status').value;

  if (!driver || !plate || !phone) {
    App.showToast('رجاء ادخل اسم السائق ونمرة العربية ورقم الموبايل', 'warning');
    return;
  }

  const newTruck = {
    id: `TRK-${String((App.db.deliveryTrucks || []).length + 101)}`,
    driverName: driver,
    plateNumber: plate,
    salary: salary,
    payDay: payDay,
    phone: phone,
    status: status
  };

  if (!App.db.deliveryTrucks) App.db.deliveryTrucks = [];
  App.db.deliveryTrucks.push(newTruck);

  // Auto Sync Driver to Factory Employees & HR & Attendance Records
  if (!App.db.employees) App.db.employees = [];
  let existingEmp = App.db.employees.find(e => e.name === driver || (e.truckPlate && e.truckPlate === plate));
  if (!existingEmp) {
    const newDriverEmp = {
      id: `EMP-${App.db.employees.length + 1}`,
      name: driver,
      phone: phone,
      jobTitle: `سائق توزيع (${plate})`,
      baseSalary: salary,
      hireDate: new Date().toISOString().slice(0, 10),
      payDay: payDay,
      advances: 0,
      absences: 0,
      netSalary: salary,
      status: 'نشط',
      truckPlate: plate
    };
    App.db.employees.push(newDriverEmp);
  } else {
    existingEmp.baseSalary = salary;
    existingEmp.payDay = payDay;
    existingEmp.truckPlate = plate;
    existingEmp.phone = phone;
  }

  if (typeof App.logActivity === 'function') {
    App.logActivity('تسجيل سيارة وسائق وراتب 🚚', `تم تسجيل السيارة (${plate}) والسائق (${driver}) براتب (${App.formatCurrency(salary)}) وإضافته فوراً لسجل الموظفين والرواتب والحضور`, 'info');
  }

  App.save();
  loadDeliveryTrucksTable();

  // Reset form inputs
  document.getElementById('trk-driver').value = '';
  document.getElementById('trk-plate').value = '';
  document.getElementById('trk-phone').value = '';

  App.showToast(`تم تسجيل سيارة التوصيل والسائق (${newTruck.driverName}) براتب (${App.formatCurrency(salary)}) وتثبيته بسجل الموظفين والرواتب بنجاح! 🚚✨`, 'success');
}

function openEditTruckModal(trkId) {
  const trk = (App.db.deliveryTrucks || []).find(t => t.id === trkId);
  if (!trk) return;

  const emp = (App.db.employees || []).find(e => e.name === trk.driverName || (e.truckPlate && e.truckPlate === trk.plateNumber));
  const currentSalary = emp ? emp.baseSalary : (trk.salary || 7500);
  const currentPayDay = emp ? (emp.payDay || 1) : (trk.payDay || 1);

  document.getElementById('edit-trk-id').value = trk.id;
  document.getElementById('edit-trk-driver').value = trk.driverName || '';
  document.getElementById('edit-trk-plate').value = trk.plateNumber || '';
  if (document.getElementById('edit-trk-salary')) document.getElementById('edit-trk-salary').value = currentSalary;
  if (document.getElementById('edit-trk-pay-day')) document.getElementById('edit-trk-pay-day').value = currentPayDay;
  document.getElementById('edit-trk-phone').value = trk.phone || '';
  document.getElementById('edit-trk-status').value = trk.status || 'جاهزة بالمصنع';

  openModal('edit-truck-modal');
}

function updateTruck() {
  const trkId = document.getElementById('edit-trk-id').value;
  const trk = (App.db.deliveryTrucks || []).find(t => t.id === trkId);
  if (!trk) return;

  const driver = document.getElementById('edit-trk-driver').value.trim();
  const plate = document.getElementById('edit-trk-plate').value.trim();
  const salaryInput = document.getElementById('edit-trk-salary');
  const salary = salaryInput ? (parseFloat(salaryInput.value) || 7500) : 7500;
  const payDayInput = document.getElementById('edit-trk-pay-day');
  const payDay = payDayInput ? (parseInt(payDayInput.value) || 1) : 1;
  const phone = document.getElementById('edit-trk-phone').value.trim();
  const status = document.getElementById('edit-trk-status').value;

  if (!driver || !plate || !phone) {
    App.showToast('رجاء ادخل بيانات السائق واللوحة والموبايل', 'warning');
    return;
  }

  const oldDriverName = trk.driverName;
  trk.driverName = driver;
  trk.plateNumber = plate;
  trk.salary = salary;
  trk.payDay = payDay;
  trk.phone = phone;
  trk.status = status;

  // Sync to employees
  const emp = (App.db.employees || []).find(e => e.name === oldDriverName || (e.truckPlate && e.truckPlate === trk.plateNumber));
  if (emp) {
    emp.name = driver;
    emp.phone = phone;
    emp.baseSalary = salary;
    emp.payDay = payDay;
    emp.truckPlate = plate;
    emp.jobTitle = `سائق توزيع (${plate})`;
  } else {
    App.db.employees.push({
      id: `EMP-${App.db.employees.length + 1}`,
      name: driver,
      phone: phone,
      jobTitle: `سائق توزيع (${plate})`,
      baseSalary: salary,
      hireDate: new Date().toISOString().slice(0, 10),
      payDay: payDay,
      advances: 0,
      absences: 0,
      netSalary: salary,
      status: 'نشط',
      truckPlate: plate
    });
  }

  if (typeof App.logActivity === 'function') {
    App.logActivity('تعديل سيارة وسائق وراتب ✏️', `تم تحديث بيانات السيارة (${plate}) والسائق (${driver}) والراتب (${App.formatCurrency(salary)}) وتثبيتها بجدول الموظفين`, 'warning');
  }

  App.save();
  loadDeliveryTrucksTable();
  closeModal('edit-truck-modal');
  App.showToast(`تم تحديث بيانات السيارة والسائق والراتب (${App.formatCurrency(salary)}) بنجاح 🚛`, 'success');
}

function deleteTruck(trkId) {
  const trk = (App.db.deliveryTrucks || []).find(t => t.id === trkId);
  if (!trk) return;

  App.showConfirmModal({
    title: 'حذف سيارة من الأسطول',
    message: `هل أنت متأكد تماماً من رغبتك في حذف سيارة التوصيل (${trk.plateNumber}) والسائق (${trk.driverName}) من أسطول التوزيع؟`,
    icon: 'fa-solid fa-truck-moving',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف السيارة 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      App.db.deliveryTrucks = (App.db.deliveryTrucks || []).filter(t => t.id !== trkId);

      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف سيارة من الأسطول 🗑️', `تم حذف السيارة (${trk.plateNumber}) والسائق (${trk.driverName}) من أسطول التوصيل`, 'danger');
      }

      App.save();
      loadDeliveryTrucksTable();
      App.showToast('تم حذف السيارة من أسطول التوصيل بنجاح 🗑️', 'danger');
    }
  });
}

// Driver & Vehicle Statement of Account Modal (كشف حساب السائق والسيارة المعتمد مثل الموظفين)
let activeTruckStatementId = null;

function openTruckStatementModal(trkId) {
  activeTruckStatementId = trkId;
  const trk = (App.db.deliveryTrucks || []).find(t => t.id === trkId);
  if (!trk) return;

  renderTruckStatementContent(trkId, 'current_month');
  openModal('truck-statement-modal');
}

function renderTruckStatementContent(trkId, periodVal = 'current_month') {
  const trk = (App.db.deliveryTrucks || []).find(t => t.id === trkId);
  if (!trk) return;

  const container = document.getElementById('truck-statement-body');
  if (!container) return;

  // Find or create matching employee record for driver
  let emp = (App.db.employees || []).find(e => e.name === trk.driverName || e.truckPlate === trk.plateNumber);
  if (!emp) {
    emp = {
      id: `EMP-${(App.db.employees || []).length + 1}`,
      name: trk.driverName,
      phone: trk.phone,
      jobTitle: `سائق توزيع (${trk.plateNumber})`,
      baseSalary: 7500,
      hireDate: '2025-01-10',
      payDay: 1,
      advances: 0,
      absences: 0,
      netSalary: 7500,
      status: 'نشط',
      truckPlate: trk.plateNumber
    };
    App.db.employees.push(emp);
    App.save();
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  let periodLabel = 'كشف الحساب الشامل';
  let dateFilterFn = (dStr) => true;

  if (periodVal === 'current_month') {
    periodLabel = `شهر ${new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(now)}`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}-${currentMonth}`);
  } else if (periodVal.startsWith('month_')) {
    const mNum = periodVal.replace('month_', '');
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    periodLabel = `شهر ${monthNames[parseInt(mNum) - 1]} لسنة ${currentYear}`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}-${mNum}`);
  } else if (periodVal === 'year') {
    periodLabel = `سنة ${currentYear} كاملة`;
    dateFilterFn = (d) => d && d.startsWith(`${currentYear}`);
  } else if (periodVal === 'all') {
    periodLabel = 'كافة السجلات الشاملة';
    dateFilterFn = (d) => true;
  }

  // Filter attendance logs for driver
  const allLogs = App.db.attendanceLog || [];
  const empLogs = allLogs.filter(a => a.empId === emp.id && dateFilterFn(a.date));
  const absencesCount = empLogs.filter(a => a.type === 'غياب').length;
  const presentCount = empLogs.filter(a => a.type === 'حاضر' || a.type === 'انصراف').length;

  const dailyRate = Math.round(emp.baseSalary / 30);
  const absenceDeduction = absencesCount * dailyRate;
  const netPayable = Math.max(0, emp.baseSalary - (emp.advances || 0) - absenceDeduction);

  // Filter fuel & transport expenses related to this truck or driver
  const truckExpenses = (App.db.expenses || []).filter(e => 
    (e.title.includes(trk.driverName) || e.title.includes(trk.plateNumber) || e.category === 'نقل وشحن' || (e.notes && e.notes.includes(trk.plateNumber))) && dateFilterFn(e.date)
  );
  const totalTruckExp = truckExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  container.innerHTML = `
    <div id="printable-truck-statement" style="font-family: 'Cairo', 'Tajawal', sans-serif !important; direction: rtl; text-align: right; color: #1e293b; background: #ffffff; padding: 10px;">
      
      <!-- Filter Bar (No-Print) -->
      <div class="no-print bg-slate-50 p-3 rounded-xl border mb-4 flex justify-between items-center flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-700"><i class="fa-solid fa-calendar-days text-primary-color ml-1"></i> فترة كشف الحساب:</label>
          <select class="form-control text-xs" style="width: 220px;" onchange="renderTruckStatementContent('${trk.id}', this.value)">
            <option value="current_month" ${periodVal === 'current_month' ? 'selected' : ''}>الشهر الحالي 🗓️</option>
            <option value="month_01" ${periodVal === 'month_01' ? 'selected' : ''}>شهر يناير (1) ❄️</option>
            <option value="month_02" ${periodVal === 'month_02' ? 'selected' : ''}>شهر فبراير (2) 📅</option>
            <option value="month_03" ${periodVal === 'month_03' ? 'selected' : ''}>شهر مارس (3) 🌸</option>
            <option value="month_04" ${periodVal === 'month_04' ? 'selected' : ''}>شهر أبريل (4) 🌿</option>
            <option value="month_05" ${periodVal === 'month_05' ? 'selected' : ''}>شهر مايو (5) ☀️</option>
            <option value="month_06" ${periodVal === 'month_06' ? 'selected' : ''}>شهر يونيو (6) ☀️</option>
            <option value="month_07" ${periodVal === 'month_07' ? 'selected' : ''}>شهر يوليو (7) 🏖️</option>
            <option value="month_08" ${periodVal === 'month_08' ? 'selected' : ''}>شهر أغسطس (8) 🌾</option>
            <option value="month_09" ${periodVal === 'month_09' ? 'selected' : ''}>شهر سبتمبر (9) 🍂</option>
            <option value="month_10" ${periodVal === 'month_10' ? 'selected' : ''}>شهر أكتوبر (10) 🍁</option>
            <option value="month_11" ${periodVal === 'month_11' ? 'selected' : ''}>شهر نوفمبر (11) 🌧️</option>
            <option value="month_12" ${periodVal === 'month_12' ? 'selected' : ''}>شهر ديسمبر (12) ❄️</option>
            <option value="year" ${periodVal === 'year' ? 'selected' : ''}>السنة الحالية كاملة 📊</option>
            <option value="all" ${periodVal === 'all' ? 'selected' : ''}>كافة السجلات الشاملة 📦</option>
          </select>
        </div>
        <span class="badge badge-emerald text-xs font-bold">سائق معتمد بالأسطول 🚛</span>
      </div>

      <!-- Report Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 58px; width: 58px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; font-weight: 800; font-size: 1.35rem; margin: 0 0 2px 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 2px 0;">كشف حساب السائق والسيارة المعتمد (الرواتب، الحضور، ومصروفات التشغيل)</p>
            <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">نظام إدارة الأسطول واللوجستيات والموارد البشرية</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="font-weight: 700; color: #1e293b; margin: 0 0 2px 0; font-size: 1.1rem;">كشف حساب السائق: ${emp.name}</h3>
          <p style="font-size: 0.8rem; color: #059669; font-weight: 700; margin: 0 0 2px 0;">السيارة: ${trk.plateNumber} | كود: ${emp.id}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">الفترة: ${periodLabel}</p>
        </div>
      </div>

      <!-- Financial & HR Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #64748b; font-weight: bold; display: block;">الراتب الأساسي</span>
          <strong style="font-size: 1.05rem; color: #059669; display: block; margin-top: 2px;">${App.formatCurrency(emp.baseSalary)}</strong>
          <span style="font-size: 0.65rem; color: #94a3b8;">استحقاق يوم ${emp.payDay || 1} شهرياً</span>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #1e40af; font-weight: bold; display: block;">أيام الحضور والغياب</span>
          <strong style="font-size: 1.05rem; color: #1d4ed8; display: block; margin-top: 2px;">${presentCount} حضور | ${absencesCount} غياب</strong>
          <span style="font-size: 0.65rem; color: #dc2626;">خصم غياب: -${App.formatCurrency(absenceDeduction)}</span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #92400e; font-weight: bold; display: block;">إجمالي السلفيات</span>
          <strong style="font-size: 1.05rem; color: #b45309; display: block; margin-top: 2px;">${App.formatCurrency(emp.advances || 0)}</strong>
          <span style="font-size: 0.65rem; color: #92400e;">سلف مسحوبة</span>
        </div>

        <div style="background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #065f46; font-weight: bold; display: block;">صافي الراتب المستحق</span>
          <strong style="font-size: 1.15rem; color: #047857; display: block; margin-top: 2px;">${App.formatCurrency(netPayable)}</strong>
          <span style="font-size: 0.65rem; color: #065f46;">جاهز للصرف</span>
        </div>

        <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #9d174d; font-weight: bold; display: block;">مصروفات السولار والصيانة</span>
          <strong style="font-size: 1.05rem; color: #be185d; display: block; margin-top: 2px;">${App.formatCurrency(totalTruckExp)}</strong>
          <span style="font-size: 0.65rem; color: #9d174d;">${truckExpenses.length} حركة مسجلة</span>
        </div>
      </div>

      <!-- Attendance Table -->
      <h4 style="font-size: 0.9rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; border-bottom: 2px solid #059669; display: inline-block; padding-bottom: 2px;">
        <i class="fa-solid fa-user-clock ml-1"></i> سجل الحضور والغياب لسائق التوزيع
      </h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #e2e8f0; font-size: 0.78rem;">
        <thead style="background: #f1f5f9;">
          <tr>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">التاريخ</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">اليوم</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">حالة التسجيل</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">وقت الحضور</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">وقت الانصراف</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${empLogs.length > 0 ? empLogs.map(l => `
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${l.date}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0;">${l.dayName || '-'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">
                <span style="padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; ${l.type === 'حاضر' || l.type === 'انصراف' ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
                  ${l.type === 'حاضر' ? 'حاضر 🟢' : (l.type === 'انصراف' ? 'انصراف 🏁' : 'غياب 🔴')}
                </span>
              </td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">${l.timeIn || '-'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">${l.timeOut || '-'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #64748b;">${l.notes || '-'}</td>
            </tr>
          `).join('') : `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #94a3b8;">لا توجد سجلات حضور مسجلة للسائق في هذه الفترة</td></tr>`}
        </tbody>
      </table>

      <!-- Fuel & Maintenance Expenses Table -->
      <h4 style="font-size: 0.9rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; border-bottom: 2px solid #3b82f6; display: inline-block; padding-bottom: 2px;">
        <i class="fa-solid fa-gas-pump ml-1"></i> مصروفات السولار والصيانة والشحن الخاصة بالسيارة (${trk.plateNumber})
      </h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #e2e8f0; font-size: 0.78rem;">
        <thead style="background: #f1f5f9;">
          <tr>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">كود الحركة</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">البيان والتفاصيل</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">الفئة</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">التاريخ والوقت</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: left;">المبلغ المنصرف</th>
          </tr>
        </thead>
        <tbody>
          ${truckExpenses.length > 0 ? truckExpenses.map(e => `
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${e.id}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0;"><strong>${e.title}</strong> ${e.notes ? `<span style="color: #64748b; font-size: 0.7rem;">(${e.notes})</span>` : ''}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${e.category}</span></td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">${App.formatTimestamp(e.date)}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #dc2626;">${App.formatCurrency(e.amount)}</td>
            </tr>
          `).join('') : `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #94a3b8;">لا توجد مصروفات أو سولار مسجلة للسيارة في هذه الفترة</td></tr>`}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 12px; font-size: 0.8rem; color: #475569;">
        <div>
          <p style="margin: 0 0 4px 0;">توقيع السائق بالاستلام: ________________________</p>
          <p style="margin: 0;">أمين المخازن والأسطول: ________________________</p>
        </div>
        <div style="border: 2px solid #059669; padding: 6px 12px; border-radius: 8px; color: #059669; text-align: center; background: rgba(5, 150, 105, 0.04);">
          <img src="${logoSrc}" alt="شعار" style="height: 22px; display: block; margin: 0 auto 2px auto;">
          <strong style="font-size: 0.75rem; display: block;">مصنع الإيمان للمكرونة</strong>
          <span style="font-size: 0.65rem; font-weight: 700;">كشف حساب سائق معتمد 🌾</span>
        </div>
        <div style="text-align: left;">
          <p style="margin: 0 0 4px 0;">مدير الموارد البشرية (HR): ________________________</p>
          <p style="margin: 0;">المدير المالي والرقابة: ________________________</p>
        </div>
      </div>

    </div>
  `;
}

function printTruckStatement() {
  const content = document.getElementById('printable-truck-statement');
  if (!content) return;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب السائق والسيارة - مصنع الإيمان للمكرونة</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
        <style>
          body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; color: #1e293b; padding: 1.5rem; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${content.outerHTML}
      </body>
    </html>
  `);
  printWin.document.close();
  setTimeout(() => {
    printWin.print();
  }, 400);
}

function printFinancialAuditReport() {
  const periodSelect = document.getElementById('rep-audit-period');
  if (periodSelect) periodSelect.value = 'current_month';

  const todayIso = new Date().toISOString().slice(0, 10);
  const singleDateIn = document.getElementById('rep-single-date');
  const startIn = document.getElementById('rep-start-date');
  const endIn = document.getElementById('rep-end-date');

  if (singleDateIn) singleDateIn.value = todayIso;
  if (startIn) startIn.value = todayIso;
  if (endIn) endIn.value = todayIso;

  handleAuditReportPeriodChange('current_month');
  openModal('reports-print-modal');
}

function handleAuditReportPeriodChange(periodVal) {
  const singleGroup = document.getElementById('rep-single-day-group');
  const startGroup = document.getElementById('rep-custom-start-group');
  const endGroup = document.getElementById('rep-custom-end-group');

  if (singleGroup) singleGroup.style.display = periodVal === 'day_specific' ? 'block' : 'none';
  if (startGroup) startGroup.style.display = periodVal === 'custom' ? 'block' : 'none';
  if (endGroup) endGroup.style.display = periodVal === 'custom' ? 'block' : 'none';

  renderFinancialAuditReportContent();
}

function renderFinancialAuditReportContent() {
  const container = document.getElementById('reports-printable-body');
  if (!container) return;

  const periodVal = document.getElementById('rep-audit-period') ? document.getElementById('rep-audit-period').value : 'current_month';
  const singleDateVal = document.getElementById('rep-single-date') ? document.getElementById('rep-single-date').value : '';
  const startDateVal = document.getElementById('rep-start-date') ? document.getElementById('rep-start-date').value : '';
  const endDateVal = document.getElementById('rep-end-date') ? document.getElementById('rep-end-date').value : '';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayIso = now.toISOString().slice(0, 10);

  let periodLabel = 'الجرد الشامل للمخزن';
  let dateFilterFn = (dStr) => true;

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
    periodLabel = `فترة الجرد: من (${startDateVal}) إلى (${endDateVal})`;
    dateFilterFn = (d) => d && d.slice(0, 10) >= startDateVal && d.slice(0, 10) <= endDateVal;
  } else if (periodVal === 'all') {
    periodLabel = 'الجرد الشامل لكافة الأصناف بالمخزن';
    dateFilterFn = (d) => true;
  }

  const products = App.db.products || [];
  const invoices = (App.db.invoices || []).filter(inv => dateFilterFn(inv.date));
  const expenses = (App.db.expenses || []).filter(exp => dateFilterFn(exp.date));

  let totalSales = 0;
  let totalSacksSold = 0;
  let totalCOGS = 0;

  invoices.forEach(inv => {
    if (inv.status === 'مرتجعة بالكامل') return;
    totalSales += (inv.grandTotal || 0);
    (inv.items || []).forEach(item => {
      const activeQty = Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
      totalSacksSold += activeQty;
      const prd = products.find(p => p.id === item.id || p.name === item.name);
      const cost = prd ? prd.costPrice : (item.price * 0.8);
      totalCOGS += (cost * activeQty);
    });
  });

  const totalExp = expenses.reduce((a, b) => a + (b.amount || 0), 0);
  const netProfit = totalSales - totalCOGS - totalExp;
  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  container.innerHTML = `
    <div id="printable-financial-audit" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl; text-align: right; color: #1e293b; background: #ffffff; padding: 10px;">
      
      <!-- Report Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 60px; width: 60px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; font-weight: 700; font-size: 1.4rem; margin: 0 0 2px 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 2px 0;">تقرير جرد المخزون الفعلي والتقييم المالي والربحية</p>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">نظام الرقابة المالية ومتابعة الإنتاج والمبيعات</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="font-weight: 700; color: #1e293b; margin: 0 0 2px 0; font-size: 1.15rem;">تقرير الجرد المالي المعتمد</h3>
          <p style="font-size: 0.85rem; font-weight: 700; color: #059669; margin: 0 0 2px 0;">نطاق التقرير: ${periodLabel}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">تاريخ التحرير: ${App.getFormattedCurrentDate()}</p>
        </div>
      </div>

      <!-- Financial Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #64748b; font-weight: bold; display: block;">الشكاير المباعة بالفترة</span>
          <strong style="font-size: 1.15rem; color: #059669; display: block; margin-top: 2px;">${totalSacksSold} شكارة</strong>
          <span style="font-size: 0.7rem; color: #94a3b8;">(${invoices.length} فاتورة مسجلة)</span>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #1e40af; font-weight: bold; display: block;">إيرادات المبيعات</span>
          <strong style="font-size: 1.15rem; color: #1d4ed8; display: block; margin-top: 2px;">${App.formatCurrency(totalSales)}</strong>
          <span style="font-size: 0.7rem; color: #1e40af;">مبيعات الفترة</span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #92400e; font-weight: bold; display: block;">التكلفة التشغيلية (COGS)</span>
          <strong style="font-size: 1.15rem; color: #b45309; display: block; margin-top: 2px;">${App.formatCurrency(totalCOGS)}</strong>
          <span style="font-size: 0.7rem; color: #92400e;">تكلفة البضاعة المباعة</span>
        </div>

        <div style="background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #065f46; font-weight: bold; display: block;">صافي الربح الفعلي</span>
          <strong style="font-size: 1.25rem; color: #047857; display: block; margin-top: 2px;">${App.formatCurrency(netProfit)}</strong>
          <span style="font-size: 0.7rem; color: #065f46; font-weight: bold;">بعد خصم المصروفات</span>
        </div>
      </div>

      <!-- Inventory Table -->
      <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; border-bottom: 2px solid #059669; display: inline-block; padding-bottom: 2px;">
        <i class="fa-solid fa-boxes-stacked ml-1"></i> جدول الجرد الفعلي للمنتجات بسعر التكلفة
      </h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0; font-size: 0.8rem;">
        <thead style="background: #f1f5f9;">
          <tr>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">كود الصنف</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">اسم المنتج والعبوة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">وحدة التعبئة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">المخزون المتبقي</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">الشكاير المباعة بالفترة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">متوسط التكلفة</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">إجمالي التقييم الفعلي</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            let itemSold = 0;
            invoices.forEach(inv => {
              if (inv.status === 'مرتجعة بالكامل') return;
              (inv.items || []).forEach(item => {
                if (item.id === p.id || item.name === p.name) {
                  itemSold += Math.max(0, (item.qty || 0) - (item.returnedQty || 0));
                }
              });
            });
            return `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${p.id}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>${p.name}</strong></td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${p.unit}</span></td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${p.stock < 150 ? '#dc2626' : '#059669'};">${p.stock} شكارة</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${itemSold > 0 ? `<span style="color: #b45309;">${itemSold} شكارة</span>` : '<span style="color: #94a3b8;">-</span>'}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left;">${App.formatCurrency(p.costPrice)}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #059669;">${App.formatCurrency(p.stock * p.costPrice)}</td>
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
          <span style="font-size: 0.7rem; font-weight: 700;">تقرير جرد مالي معتمد 🌾</span>
        </div>
        <div style="font-size: 0.8rem; color: #475569; text-align: left; line-height: 1.7;">
          <p style="margin: 0;">أمين ومسؤول المخازن: ________________________</p>
          <p style="margin: 0;">مدير الحسابات والرقابة المالية: ________________________</p>
        </div>
      </div>

    </div>
  `;
}
