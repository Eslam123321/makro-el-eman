/* ==========================================================================
   مصنع الإيمان للمكرونة - HR & Attendance Enterprise System
   Section 1: Employees & Payroll Ledger
   Section 2: Daily Attendance, Clock-In/Out & Automatic Absence Deduction
   Advanced Filtered Statement of Account
   ========================================================================== */

let currentAttFilter = 'all';
let currentAttSearch = '';
let currentEmpSearch = '';
let selectedReportEmpId = null;
let selectedReportPeriod = 'current_month';
let selectedReportCustomStart = '';
let selectedReportCustomEnd = '';

document.addEventListener('DOMContentLoaded', () => {
  renderAppLayout('hr');
  renderPageSummaryCards('hr', 'hr-summary-cards-container');
  syncAttendanceRecordsOnLoad();
  initAttendanceFilterSelects();
  
  // Set date badge in attendance header
  const dateBadge = document.getElementById('daily-att-date-badge');
  if (dateBadge) {
    const todayFormatted = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
    dateBadge.innerHTML = `<i class="fa-regular fa-calendar-days ml-1"></i> صحيفة يوم: ${todayFormatted}`;
  }

  loadEmployeesTable();
  loadDailyAttendanceTable();

  // Handle URL Search query from Quick Search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('#employees-ledger-section .search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterEmployeesTable(searchQuery);
    }
  }
});

// Initialize / Sync attendance records
function syncAttendanceRecordsOnLoad() {
  if (!App.db.attendanceLog) App.db.attendanceLog = [];

  // Sync each employee's absence count dynamically
  (App.db.employees || []).forEach(emp => {
    const absenceCount = App.db.attendanceLog.filter(a => a.empId === emp.id && a.type === 'غياب').length;
    emp.absences = absenceCount;
  });

  App.save();
}

function initAttendanceFilterSelects() {
  const recEmpSelect = document.getElementById('rec-att-emp-select');
  const employees = App.db.employees || [];

  if (recEmpSelect) {
    recEmpSelect.innerHTML = employees.map(e => `<option value="${e.id}">${e.name} (${e.jobTitle})</option>`).join('');
  }
}

// Net Salary Calculator: (Base - Advances - Deductions - (Absences * (Base / 30)))
function calculateNetSalary(emp) {
  const base = emp.baseSalary || 0;
  const dailyRate = Math.round(base / 30);
  const absenceDeduction = Math.round((emp.absences || 0) * dailyRate);
  const advances = emp.advances || 0;
  const deductions = emp.deductions || 0;
  const net = Math.max(0, base - advances - deductions - absenceDeduction);
  return { net, absenceDeduction, dailyRate, advances, deductions };
}

// Get today's attendance entry for an employee
function getTodayAttendanceRecord(empId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (App.db.attendanceLog || []).find(a => a.empId === empId && a.date === todayStr);
}

// Filter Section 1 (Employees Table)
function filterEmployeesTable(query) {
  currentEmpSearch = (query || '').trim().toLowerCase();
  loadEmployeesTable();
}

// Render Section 1: Employees List & Payroll Table
function loadEmployeesTable() {
  const tbody = document.getElementById('employees-list-tbody');
  if (!tbody) return;

  const employees = App.db.employees || [];
  let filtered = employees;

  if (currentEmpSearch) {
    filtered = employees.filter(e => 
      (e.name || '').toLowerCase().includes(currentEmpSearch) ||
      (e.jobTitle || '').toLowerCase().includes(currentEmpSearch) ||
      (e.id || '').toLowerCase().includes(currentEmpSearch) ||
      (e.phone && e.phone.toLowerCase().includes(currentEmpSearch))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted p-6">لا يوجد موظفين مسجلين مطابقين للبحث</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const { net, absenceDeduction } = calculateNetSalary(emp);
    const phoneDisplay = emp.phone ? `<div class="text-xs text-primary-color font-bold mt-1"><i class="fa-solid fa-phone text-xs"></i> ${emp.phone}</div>` : '';
    const hireDateDisplay = emp.hireDate || '2024-01-15';
    const payDayDisplay = emp.payDay || (emp.payDate ? emp.payDate.split('-')[2] : '30');

    return `
      <tr>
        <td>
          <strong class="badge badge-blue font-bold">${emp.id}</strong>
          ${phoneDisplay}
        </td>
        <td>
          <strong class="text-base text-slate-800">${emp.name}</strong>
          <div class="text-xs text-muted">${emp.jobTitle}</div>
        </td>
        <td>
          <span class="badge badge-purple text-xs font-bold"><i class="fa-solid fa-calendar-check ml-1"></i> ${hireDateDisplay}</span>
        </td>
        <td>
          <span class="badge badge-amber text-xs font-bold"><i class="fa-solid fa-clock ml-1"></i> يوم ${payDayDisplay} من الشهر</span>
        </td>
        <td><strong class="text-slate-800">${App.formatCurrency(emp.baseSalary)}</strong></td>
        <td><strong class="${(emp.advances || 0) > 0 ? 'text-warning font-bold' : 'text-slate-600'}">${App.formatCurrency(emp.advances || 0)}</strong></td>
        <td><strong class="${(emp.deductions || 0) > 0 ? 'text-danger font-bold' : 'text-slate-600'}">${App.formatCurrency(emp.deductions || 0)}</strong></td>
        <td>
          <span class="badge badge-danger text-xs font-bold">${emp.absences || 0} أيام (-${App.formatCurrency(absenceDeduction)})</span>
        </td>
        <td>
          <strong class="text-success text-base font-bold" style="font-size: 1.15rem; color: #059669;">${App.formatCurrency(net)}</strong>
        </td>
        <td>
          <div class="flex gap-2 flex-wrap">
            <button class="btn btn-secondary btn-sm" onclick="openEmployeeStatementModal('${emp.id}')" title="كشف الحساب وسجل الحضور"><i class="fa-solid fa-file-lines text-primary-color"></i> كشف الحساب 📄</button>
            <button class="btn btn-secondary btn-sm" onclick="openAddAdvanceModal('${emp.id}')" title="صرف سلفة"><i class="fa-solid fa-hand-holding-hand text-warning"></i> سلفة</button>
            <button class="btn btn-primary btn-sm" onclick="disburseSalary('${emp.id}')" title="صرف الراتب"><i class="fa-solid fa-money-check-dollar"></i> صرف الراتب 💰</button>
            <button class="btn btn-secondary btn-sm" onclick="openDeductionModal('${emp.id}')" title="خصم مالي إداري"><i class="fa-solid fa-minus text-danger"></i> خصم</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.id}')" title="حذف الموظف نهائياً"><i class="fa-solid fa-trash"></i> حذف</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Employee (Super Admin Only)
function deleteEmployee(empId) {
  const currentUser = typeof App !== 'undefined' && typeof App.getCurrentUser === 'function' ? App.getCurrentUser() : null;
  const isSuperAdmin = currentUser && (currentUser.id === 'USR-1' || (currentUser.username === 'admin' && currentUser.role === 'مدير عام'));
  if (!isSuperAdmin) {
    App.showToast('عفواً، صلاحية حذف الموظفين مقتصرة على حساب المدير العام فقط!', 'danger');
    return;
  }

  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  App.showConfirmModal({
    title: 'حذف الموظف نهائياً',
    message: `تحذير: هل أنت متأكد من رغبتك في حذف الموظف (${emp.name}) - (${emp.jobTitle})؟ سيتم مسح بياناته وسجل حضوره نهائياً من قاعدة البيانات والسحابة.`,
    icon: 'fa-solid fa-user-slash',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف الموظف 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      const empName = emp.name;
      App.db.employees = (App.db.employees || []).filter(e => e.id !== empId);
      App.db.attendanceLog = (App.db.attendanceLog || []).filter(a => a.empId !== empId);

      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف موظف من النظام 🗑️', `تم حذف الموظف (${empName}) وسجل حضوره نهائياً من السيستم`, 'danger');
      }

      App.save();
      loadEmployeesTable();
      loadDailyAttendanceTable();
      if (typeof renderPageSummaryCards === 'function') renderPageSummaryCards('hr', 'hr-summary-cards-container');
      App.showToast(`تم حذف الموظف (${empName}) نهائياً من النظام والسحابة 🗑️`, 'danger');
    }
  });
}

// Filter Section 2 (Attendance Table)
function filterAttendanceTable(query) {
  currentAttSearch = (query || '').trim().toLowerCase();
  loadDailyAttendanceTable();
}

function setAttendanceFilter(filterKey, buttonEl) {
  currentAttFilter = filterKey;

  const tabs = document.querySelectorAll('#att-filter-tabs .att-tab');
  tabs.forEach(t => {
    t.classList.remove('btn-primary', 'active');
    t.classList.add('btn-secondary');
  });

  if (buttonEl) {
    buttonEl.classList.remove('btn-secondary');
    buttonEl.classList.add('btn-primary', 'active');
  }

  loadDailyAttendanceTable();
}

// Render Section 2: Daily Attendance Table
function loadDailyAttendanceTable() {
  const tbody = document.getElementById('daily-attendance-tbody');
  if (!tbody) return;

  const employees = App.db.employees || [];

  // Calculate Tab Counts
  let countAll = employees.length;
  let countPresent = 0;
  let countAbsent = 0;
  let countUnrecorded = 0;

  employees.forEach(emp => {
    const todayRec = getTodayAttendanceRecord(emp.id);
    if (todayRec && (todayRec.type === 'حاضر' || todayRec.type === 'انصراف')) {
      countPresent++;
    } else if (todayRec && todayRec.type === 'غياب') {
      countAbsent++;
    } else {
      countUnrecorded++;
    }
  });

  if (document.getElementById('att-count-all')) document.getElementById('att-count-all').textContent = countAll;
  if (document.getElementById('att-count-present')) document.getElementById('att-count-present').textContent = countPresent;
  if (document.getElementById('att-count-absent')) document.getElementById('att-count-absent').textContent = countAbsent;
  if (document.getElementById('att-count-unrecorded')) document.getElementById('att-count-unrecorded').textContent = countUnrecorded;

  // Filter list
  let filtered = employees.filter(emp => {
    const todayRec = getTodayAttendanceRecord(emp.id);

    if (currentAttFilter === 'present') {
      if (!todayRec || (todayRec.type !== 'حاضر' && todayRec.type !== 'انصراف')) return false;
    } else if (currentAttFilter === 'absent') {
      if (!todayRec || todayRec.type !== 'غياب') return false;
    } else if (currentAttFilter === 'unrecorded') {
      if (todayRec && (todayRec.type === 'حاضر' || todayRec.type === 'انصراف' || todayRec.type === 'غياب')) return false;
    }

    if (currentAttSearch) {
      const matchName = (emp.name || '').toLowerCase().includes(currentAttSearch);
      const matchJob = (emp.jobTitle || '').toLowerCase().includes(currentAttSearch);
      const matchPhone = (emp.phone || '').toLowerCase().includes(currentAttSearch);
      const matchId = (emp.id || '').toLowerCase().includes(currentAttSearch);
      if (!matchName && !matchJob && !matchPhone && !matchId) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد موظفين مسجلين مطابقين للتصفية المحددة</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const { dailyRate } = calculateNetSalary(emp);
    const todayRec = getTodayAttendanceRecord(emp.id);
    const isPresent = todayRec && (todayRec.type === 'حاضر' || todayRec.type === 'انصراف');
    const isDeparted = todayRec && todayRec.type === 'انصراف';
    const isAbsent = todayRec && todayRec.type === 'غياب';

    let statusBadge = `<span class="badge badge-gray text-xs"><i class="fa-regular fa-clock ml-1"></i> لم يسجل اليوم</span>`;
    let timeInDisplay = '-';
    let timeOutDisplay = '-';
    let deductionCell = `<span class="text-xs text-muted">لا يوجد خصم غياب</span>`;

    if (todayRec) {
      if (todayRec.type === 'حاضر') {
        statusBadge = `<span class="badge badge-success text-xs font-bold"><i class="fa-solid fa-circle-check ml-1"></i> حاضر بالمصنع</span>`;
        timeInDisplay = `<strong class="text-success font-bold">${todayRec.timeIn || '08:30 ص'}</strong>`;
        timeOutDisplay = todayRec.timeOut && todayRec.timeOut !== '-' ? `<strong class="text-blue font-bold">${todayRec.timeOut}</strong>` : '<span class="text-xs text-muted">قيد العمل</span>';
      } else if (todayRec.type === 'انصراف') {
        statusBadge = `<span class="badge badge-blue text-xs font-bold"><i class="fa-solid fa-flag-checkered ml-1"></i> تم الانصراف</span>`;
        timeInDisplay = `<strong class="text-success">${todayRec.timeIn || '08:30 ص'}</strong>`;
        timeOutDisplay = `<strong class="text-primary-color font-bold">${todayRec.timeOut || '05:00 م'}</strong>`;
      } else if (todayRec.type === 'غياب') {
        statusBadge = `<span class="badge badge-danger text-xs font-bold"><i class="fa-solid fa-circle-xmark ml-1"></i> غائب اليوم</span>`;
        timeInDisplay = `<span class="text-xs text-danger">غائب</span>`;
        timeOutDisplay = `<span class="text-xs text-danger">غائب</span>`;
        deductionCell = `
          <div>
            <strong class="text-danger font-bold block mb-1">-${App.formatCurrency(dailyRate)} (خصم يوم)</strong>
            <button class="btn btn-xs btn-warning font-bold" onclick="cancelTodayAbsence('${emp.id}')" title="تعديل وإلغاء الغياب واسترجاع الخصم">
              <i class="fa-solid fa-rotate-left"></i> تعديل / إلغاء الغياب
            </button>
          </div>
        `;
      }
    }

    return `
      <tr>
        <td>
          <strong>${emp.name}</strong>
          <div class="text-xs text-muted">${emp.jobTitle} | كود: <span class="text-primary-color font-bold">${emp.id}</span></div>
        </td>
        <td>
          <span class="text-xs font-bold text-slate-700">${emp.phone || 'غير مسجل'}</span>
        </td>
        <td>${statusBadge}</td>
        <td>${timeInDisplay}</td>
        <td>${timeOutDisplay}</td>
        <td>
          <div class="flex gap-2 flex-wrap items-center">
            <button class="btn btn-sm ${isPresent ? 'btn-primary' : 'btn-secondary'}" ${isAbsent ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="recordAttendanceAction('${emp.id}', 'حاضر')" title="تسجيل حضور الموظف">
              <i class="fa-solid fa-check text-xs"></i> تسجيل حضور
            </button>
            <button class="btn btn-sm ${isDeparted ? 'btn-primary' : 'btn-secondary'}" ${isAbsent ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="recordAttendanceAction('${emp.id}', 'انصراف')" title="تسجيل وقت انصراف الموظف">
              <i class="fa-solid fa-door-open text-xs"></i> تسجيل انصراف
            </button>
            <button class="btn btn-sm ${isAbsent ? 'btn-danger' : 'btn-secondary'}" style="${isAbsent ? 'background: #dc2626; color: #ffffff;' : ''}" onclick="recordAttendanceAction('${emp.id}', 'غياب')" title="تسجيل غياب الموظف">
              <i class="fa-solid fa-xmark text-xs"></i> تسجيل غياب
            </button>
          </div>
        </td>
        <td>${deductionCell}</td>
      </tr>
    `;
  }).join('');
}

// Attendance Actions
function recordAttendanceAction(empId, status) {
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  if (!App.db.attendanceLog) App.db.attendanceLog = [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(new Date());
  const timeNow = new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date());

  let todayRec = App.db.attendanceLog.find(a => a.empId === emp.id && a.date === todayStr);

  if (!todayRec) {
    todayRec = {
      id: `ATT-${Date.now()}`,
      empId: emp.id,
      empName: emp.name,
      date: todayStr,
      dayName: dayName,
      type: status,
      timeIn: status === 'حاضر' ? timeNow : '-',
      timeOut: status === 'انصراف' ? timeNow : '-',
      notes: status === 'غياب' ? 'خصم غياب مسجل تلقائياً' : 'تسجيل حضور مباشر'
    };
    App.db.attendanceLog.unshift(todayRec);
  } else {
    if (status === 'حاضر') {
      todayRec.type = 'حاضر';
      todayRec.timeIn = timeNow;
      if (todayRec.timeOut === '-') todayRec.timeOut = '-';
      todayRec.notes = 'تسجيل حضور وتواجد';
    } else if (status === 'انصراف') {
      todayRec.type = 'انصراف';
      todayRec.timeOut = timeNow;
      if (!todayRec.timeIn || todayRec.timeIn === '-') todayRec.timeIn = '08:30 ص';
      todayRec.notes = 'تسجيل انصراف الموظف';
    } else if (status === 'غياب') {
      todayRec.type = 'غياب';
      todayRec.timeIn = '-';
      todayRec.timeOut = '-';
      todayRec.notes = 'خصم غياب مسجل تلقائياً';
    }
  }

  // Recalculate employee total absences dynamically
  emp.absences = App.db.attendanceLog.filter(a => a.empId === emp.id && a.type === 'غياب').length;

  App.save();
  loadEmployeesTable();
  loadDailyAttendanceTable();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');

  const { dailyRate } = calculateNetSalary(emp);

  if (status === 'حاضر') {
    App.showToast(`تم تسجيل حضور الموظف (${emp.name}) الساعة (${timeNow}) 🟢`, 'success');
  } else if (status === 'انصراف') {
    App.showToast(`تم تسجيل انصراف الموظف (${emp.name}) الساعة (${timeNow}) دون التأثير على الحضور 🏁`, 'info');
  } else if (status === 'غياب') {
    App.showToast(`تم تسجيل غياب الموظف (${emp.name}) وخصم أجر اليوم (${App.formatCurrency(dailyRate)}) من الراتب 🔴`, 'danger');
  }
}

// Cancel / Edit Today Absence (استرجاع الغياب وتصحيح الخطأ)
function cancelTodayAbsence(empId) {
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Remove today's absence record
  App.db.attendanceLog = (App.db.attendanceLog || []).filter(a => !(a.empId === emp.id && a.date === todayStr && a.type === 'غياب'));

  // Recalculate absences
  emp.absences = App.db.attendanceLog.filter(a => a.empId === emp.id && a.type === 'غياب').length;

  App.save();
  loadEmployeesTable();
  loadDailyAttendanceTable();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');

  App.showToast(`تم إلغاء الغياب للموظف (${emp.name})، واسترجاع الخصم وإعادة فتح الحضور والانصراف بنجاح! 🔄✨`, 'success');
}

// Open Advance Loan Modal
function openAddAdvanceModal(empId) {
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  document.getElementById('adv-emp-id').value = emp.id;
  document.getElementById('adv-emp-title').textContent = `الموظف: ${emp.name} | السلف الحالية: ${App.formatCurrency(emp.advances || 0)}`;
  document.getElementById('adv-amount').value = '';

  openModal('add-advance-modal');
}

function processEmployeeAdvance() {
  const empId = document.getElementById('adv-emp-id').value;
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  const amount = parseFloat(document.getElementById('adv-amount').value) || 0;
  if (amount <= 0) {
    App.showToast('رجاء ادخل قيمة السلفة المطلوبة', 'warning');
    return;
  }

  emp.advances = (emp.advances || 0) + amount;
  if (!emp.advancesList) emp.advancesList = [];
  emp.advancesList.unshift({
    id: `ADV-${Date.now().toString().slice(-4)}`,
    amount: amount,
    date: App.getNowISO(),
    notes: 'صرف سلفة نقدية على حساب الراتب'
  });

  // Deduct from cash treasury
  App.db.treasury = Math.max(0, App.db.treasury - amount);

  App.save();
  loadEmployeesTable();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');
  closeModal('add-advance-modal');
  App.showToast(`تم صرف سلفة بقيمة (${App.formatCurrency(amount)}) للموظف (${emp.name}) من الخزينة 💸`, 'success');
}

// Open Deduction Modal
function openDeductionModal(empId) {
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  document.getElementById('ded-emp-id').value = emp.id;
  document.getElementById('ded-emp-title').textContent = `الموظف: ${emp.name} (${emp.jobTitle}) - الراتب: ${App.formatCurrency(emp.baseSalary)}`;
  document.getElementById('ded-amount').value = '';
  document.getElementById('ded-reason').value = '';

  openModal('deduction-modal');
}

function processFinancialDeduction() {
  const empId = document.getElementById('ded-emp-id').value;
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  const amount = parseFloat(document.getElementById('ded-amount').value) || 0;
  const reason = document.getElementById('ded-reason').value.trim();

  if (amount <= 0) {
    App.showToast('رجاء ادخل قيمة الخصم المالي', 'warning');
    return;
  }

  emp.deductions = (emp.deductions || 0) + amount;
  if (!emp.deductionsList) emp.deductionsList = [];
  emp.deductionsList.unshift({
    id: `DED-${Date.now().toString().slice(-4)}`,
    amount: amount,
    reason: reason || 'خصم مالي إداري مباشر',
    date: App.getNowISO()
  });

  App.save();
  loadEmployeesTable();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');
  closeModal('deduction-modal');
  App.showToast(`تم تطبيق خصم مالي بقيمة (${App.formatCurrency(amount)}) على الموظف (${emp.name}) 💰`, 'warning');
}

// Disburse Monthly Salary
function disburseSalary(empId) {
  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  const { net, absenceDeduction, advances, deductions } = calculateNetSalary(emp);
  if (net <= 0) {
    App.showToast('عفواً، صافي الراتب المستحق هو صفر بعد خصم السلف والجزاءات والغياب', 'warning');
    return;
  }

  App.showConfirmModal({
    title: 'صرف وتسوية الراتب الشهري',
    message: `هل أنت متأكد من تسوية وصرف صافي راتب الموظف (${emp.name}) بقيمة (${App.formatCurrency(net)})؟ سيتم صرفه من الخزينة وتصفير السلف والخصومات وبدء دورة شهرية جديدة.`,
    icon: 'fa-solid fa-money-bill-transfer',
    iconBg: '#dcfce7',
    iconColor: '#059669',
    confirmText: 'تأكيد الصرف والتسوية 💵',
    confirmBtnClass: 'btn-success',
    onConfirm: () => {
      // Deduct net payout from Treasury
      App.db.treasury = Math.max(0, App.db.treasury - net);

      if (!App.db.expenses) App.db.expenses = [];
      App.db.expenses.unshift({
        id: `EXP-${String(App.db.expenses.length + 101)}`,
        title: `صرف راتب شهري - ${emp.name}`,
        category: 'رواتب وأجور',
        amount: net,
        date: App.getNowISO(),
        notes: `صافي الراتب بعد خصم (${App.formatCurrency(advances)}) سلف و (${App.formatCurrency(deductions)}) جزاءات و (${App.formatCurrency(absenceDeduction)}) غياب`
      });

      emp.advances = 0;
      emp.deductions = 0;
      emp.absences = 0;

      App.save();
      loadEmployeesTable();
      renderPageSummaryCards('hr', 'hr-summary-cards-container');
      App.showToast(`تم صرف وتسوية راتب الموظف (${emp.name}) بقيمة (${App.formatCurrency(net)}) بنجاح! 💵✨`, 'success');
    }
  });
}

function toggleCustomJobInput(val) {
  const customInput = document.getElementById('emp-job-custom');
  if (!customInput) return;
  if (val === 'أخرى') {
    customInput.style.display = 'block';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    customInput.value = '';
  }
}

// Add New Employee Form
function saveNewEmployee() {
  const name = document.getElementById('emp-name').value.trim();
  const phone = document.getElementById('emp-phone') ? document.getElementById('emp-phone').value.trim() : '';
  const jobSelect = document.getElementById('emp-job-select');
  const jobCustom = document.getElementById('emp-job-custom');
  let job = 'مشرف خط إنتاج';

  if (jobSelect) {
    if (jobSelect.value === 'أخرى') {
      job = (jobCustom && jobCustom.value.trim()) ? jobCustom.value.trim() : 'موظف مصنع';
    } else {
      job = jobSelect.value;
    }
  } else if (document.getElementById('emp-job')) {
    job = document.getElementById('emp-job').value.trim() || 'عامل مصنع';
  }

  const salary = parseFloat(document.getElementById('emp-salary').value) || 0;
  const hireDate = document.getElementById('emp-hire-date') && document.getElementById('emp-hire-date').value ? document.getElementById('emp-hire-date').value : new Date().toISOString().split('T')[0];
  const payDay = document.getElementById('emp-pay-day') && document.getElementById('emp-pay-day').value ? parseInt(document.getElementById('emp-pay-day').value) : 30;

  if (!name || salary <= 0) {
    App.showToast('رجاء ادخل اسم الموظف والراتب الأساسي', 'warning');
    return;
  }

  const newEmp = {
    id: `EMP-${App.db.employees.length + 1}`,
    name: name,
    phone: phone,
    jobTitle: job || 'عامل مصنع',
    baseSalary: salary,
    hireDate: hireDate,
    payDay: Math.min(31, Math.max(1, payDay || 30)),
    advances: 0,
    deductions: 0,
    absences: 0,
    status: 'نشط'
  };

  App.db.employees.push(newEmp);
  App.save();
  loadEmployeesTable();
  loadDailyAttendanceTable();
  initAttendanceFilterSelects();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');

  // Reset inputs
  document.getElementById('emp-name').value = '';
  if (document.getElementById('emp-phone')) document.getElementById('emp-phone').value = '';
  if (jobSelect) jobSelect.value = 'مشرف خط إنتاج';
  if (jobCustom) {
    jobCustom.value = '';
    jobCustom.style.display = 'none';
  }
  document.getElementById('emp-salary').value = '';
  if (document.getElementById('emp-hire-date')) document.getElementById('emp-hire-date').value = '';
  if (document.getElementById('emp-pay-day')) document.getElementById('emp-pay-day').value = '';

  App.showToast(`تم تسجيل الموظف الجديد (${newEmp.name}) بنجاح بالسجل 👔✨`, 'success');
}

// Record Date-Specific Absence Modal
function openRecordAbsenceModal(empId = null) {
  initAttendanceFilterSelects();
  const recEmpSelect = document.getElementById('rec-att-emp-select');
  if (empId && recEmpSelect) {
    recEmpSelect.value = empId;
  }
  const dateInput = document.getElementById('rec-att-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  openModal('record-absence-modal');
}

function saveDateSpecificAbsence() {
  const empId = document.getElementById('rec-att-emp-select').value;
  const dateStr = document.getElementById('rec-att-date').value;
  const type = document.getElementById('rec-att-type').value;
  const notes = document.getElementById('rec-att-notes').value.trim();

  if (!empId || !dateStr) {
    App.showToast('رجاء اختر الموظف والتاريخ', 'warning');
    return;
  }

  const emp = (App.db.employees || []).find(e => e.id === empId);
  if (!emp) return;

  if (!App.db.attendanceLog) App.db.attendanceLog = [];

  const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(new Date(dateStr));

  App.db.attendanceLog.unshift({
    id: `ATT-${Date.now()}`,
    empId: emp.id,
    empName: emp.name,
    date: dateStr,
    dayName: dayName,
    type: type,
    timeIn: type === 'حضور' ? '08:30 ص' : '-',
    timeOut: type === 'حضور' ? '05:00 م' : '-',
    notes: notes || (type === 'غياب' ? 'خصم غياب مسجل بتاريخ محدد' : 'تسجيل إداري')
  });

  emp.absences = App.db.attendanceLog.filter(a => a.empId === emp.id && a.type === 'غياب').length;

  App.save();
  loadEmployeesTable();
  loadDailyAttendanceTable();
  renderPageSummaryCards('hr', 'hr-summary-cards-container');
  closeModal('record-absence-modal');
  App.showToast(`تم تسجيل (${type}) للموظف (${emp.name}) بتاريخ (${dateStr}) وتحديث الراتب 📅`, 'success');
}

// ADVANCED FILTERED EMPLOYEE STATEMENT MODAL
function openEmployeeStatementModal(empId) {
  selectedReportEmpId = empId;
  selectedReportPeriod = 'current_month';
  renderEmployeeStatementContent();
  openModal('emp-statement-modal');
}

function handleStatementPeriodChange(periodVal) {
  selectedReportPeriod = periodVal;
  const customGroup = document.getElementById('statement-custom-date-container');
  if (customGroup) {
    customGroup.style.display = periodVal === 'custom' ? 'flex' : 'none';
  }
  renderEmployeeStatementContent();
}

function handleStatementCustomDateChange() {
  const startIn = document.getElementById('stmt-start-date');
  const endIn = document.getElementById('stmt-end-date');
  if (startIn && endIn) {
    selectedReportCustomStart = startIn.value;
    selectedReportCustomEnd = endIn.value;
    renderEmployeeStatementContent();
  }
}

function renderEmployeeStatementContent() {
  const emp = (App.db.employees || []).find(e => e.id === selectedReportEmpId);
  const container = document.getElementById('emp-statement-modal-body');
  if (!emp || !container) return;

  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
  const hireDateDisplay = emp.hireDate || '2024-01-15';
  const payDayDisplay = emp.payDay || (emp.payDate ? emp.payDate.split('-')[2] : '30');
  const dailyRate = Math.round((emp.baseSalary || 0) / 30);

  // Filter attendance log by period
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  let periodLabel = 'الشهر الحالي';
  let filteredLogs = (App.db.attendanceLog || []).filter(a => a.empId === emp.id);

  if (selectedReportPeriod === 'current_month') {
    periodLabel = `شهر ${new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(now)}`;
    filteredLogs = filteredLogs.filter(a => a.date && a.date.startsWith(`${currentYear}-${currentMonth}`));
  } else if (selectedReportPeriod.startsWith('month_')) {
    const mNum = selectedReportPeriod.replace('month_', '');
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    periodLabel = `شهر ${monthNames[parseInt(mNum) - 1]} ${currentYear}`;
    filteredLogs = filteredLogs.filter(a => a.date && a.date.startsWith(`${currentYear}-${mNum}`));
  } else if (selectedReportPeriod === 'year') {
    periodLabel = `سنة ${currentYear} كاملة`;
    filteredLogs = filteredLogs.filter(a => a.date && a.date.startsWith(`${currentYear}`));
  } else if (selectedReportPeriod === 'custom' && selectedReportCustomStart && selectedReportCustomEnd) {
    periodLabel = `من تاريخ ${selectedReportCustomStart} إلى ${selectedReportCustomEnd}`;
    filteredLogs = filteredLogs.filter(a => a.date >= selectedReportCustomStart && a.date <= selectedReportCustomEnd);
  } else if (selectedReportPeriod === 'all') {
    periodLabel = 'كافة السجلات المسجلة منذ التعيين';
  }

  // Count metrics for selected period
  const periodAbsences = filteredLogs.filter(a => a.type === 'غياب').length;
  const periodPresents = filteredLogs.filter(a => a.type === 'حاضر' || a.type === 'انصراف').length;
  const periodAbsenceDeduction = periodAbsences * dailyRate;
  const periodNet = Math.max(0, (emp.baseSalary || 0) - (emp.advances || 0) - periodAbsenceDeduction);

  container.innerHTML = `
    <!-- Top Filter Controls Bar (No-Print) -->
    <div class="no-print bg-slate-50 p-3 rounded-lg border mb-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-700"><i class="fa-solid fa-filter text-primary-color ml-1"></i> اختر الفترة الزمنية للتقرير:</label>
          <select id="statement-period-select" class="form-control text-xs" style="width: auto; padding: 4px 10px;" onchange="handleStatementPeriodChange(this.value)">
            <option value="current_month" ${selectedReportPeriod === 'current_month' ? 'selected' : ''}>الشهر الحالي (${new Intl.DateTimeFormat('ar-EG', { month: 'short' }).format(now)}) 🗓️</option>
            <option value="month_01" ${selectedReportPeriod === 'month_01' ? 'selected' : ''}>شهر يناير (1) ❄️</option>
            <option value="month_02" ${selectedReportPeriod === 'month_02' ? 'selected' : ''}>شهر فبراير (2) 📅</option>
            <option value="month_03" ${selectedReportPeriod === 'month_03' ? 'selected' : ''}>شهر مارس (3) 🌸</option>
            <option value="month_04" ${selectedReportPeriod === 'month_04' ? 'selected' : ''}>شهر أبريل (4) 🌿</option>
            <option value="month_05" ${selectedReportPeriod === 'month_05' ? 'selected' : ''}>شهر مايو (5) ☀️</option>
            <option value="month_06" ${selectedReportPeriod === 'month_06' ? 'selected' : ''}>شهر يونيو (6) ☀️</option>
            <option value="month_07" ${selectedReportPeriod === 'month_07' ? 'selected' : ''}>شهر يوليو (7) 🏖️</option>
            <option value="month_08" ${selectedReportPeriod === 'month_08' ? 'selected' : ''}>شهر أغسطس (8) 🌾</option>
            <option value="month_09" ${selectedReportPeriod === 'month_09' ? 'selected' : ''}>شهر سبتمبر (9) 🍂</option>
            <option value="month_10" ${selectedReportPeriod === 'month_10' ? 'selected' : ''}>شهر أكتوبر (10) 🍁</option>
            <option value="month_11" ${selectedReportPeriod === 'month_11' ? 'selected' : ''}>شهر نوفمبر (11) 🌧️</option>
            <option value="month_12" ${selectedReportPeriod === 'month_12' ? 'selected' : ''}>شهر ديسمبر (12) ❄️</option>
            <option value="year" ${selectedReportPeriod === 'year' ? 'selected' : ''}>السنة كاملة (${currentYear}) 📊</option>
            <option value="custom" ${selectedReportPeriod === 'custom' ? 'selected' : ''}>فترة مخصصة (من - إلى) 📆</option>
            <option value="all" ${selectedReportPeriod === 'all' ? 'selected' : ''}>كافة الأوقات والتواريخ 📈</option>
          </select>
        </div>

        <div id="statement-custom-date-container" class="flex items-center gap-2" style="display: ${selectedReportPeriod === 'custom' ? 'flex' : 'none'};">
          <input type="date" id="stmt-start-date" value="${selectedReportCustomStart || new Date().toISOString().slice(0, 10)}" class="form-control text-xs" style="padding: 4px;" onchange="handleStatementCustomDateChange()">
          <span class="text-xs text-muted">إلى</span>
          <input type="date" id="stmt-end-date" value="${selectedReportCustomEnd || new Date().toISOString().slice(0, 10)}" class="form-control text-xs" style="padding: 4px;" onchange="handleStatementCustomDateChange()">
        </div>
      </div>
    </div>

    <!-- Printable Statement Layout -->
    <div id="printable-emp-statement-content" style="font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl; text-align: right; color: #1e293b; background: #ffffff;">
      
      <!-- Statement Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${logoSrc}" alt="شعار مصنع الإيمان" style="height: 60px; width: 60px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; font-weight: 700; font-size: 1.4rem; margin: 0 0 2px 0;">مصنع الإيمان للمكرونة</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 2px 0;">إدارة شؤون العاملين والموارد البشرية</p>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">كشف حساب وتصفية مستحقات الموظف المعتمد</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="font-weight: 700; color: #1e293b; margin: 0 0 2px 0; font-size: 1.15rem;">كشف حساب تفصيلي</h3>
          <p style="font-size: 0.85rem; font-weight: 700; color: #059669; margin: 0 0 2px 0;">نطاق التقرير: ${periodLabel}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">تاريخ التحرير: ${App.getFormattedCurrentDate()}</p>
        </div>
      </div>

      <!-- Employee Info Bar -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div>
          <span style="font-size: 0.75rem; color: #64748b; display: block;">بيانات الموظف:</span>
          <strong style="font-size: 1.1rem; color: #0f172a;">${emp.name}</strong>
          <span style="font-size: 0.8rem; color: #64748b; margin-right: 10px;">| الوظيفة: <strong style="color: #059669;">${emp.jobTitle}</strong></span>
          <span style="font-size: 0.8rem; color: #64748b; margin-right: 10px;">| الهاتف: <strong>${emp.phone || '-'}</strong></span>
        </div>
        <div style="text-align: left;">
          <span style="font-size: 0.75rem; color: #64748b; display: block;">مواعيد التعيين والقبض:</span>
          <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; margin-left: 4px;">📅 تعيين: ${hireDateDisplay}</span>
          <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">⏰ قبض: يوم ${payDayDisplay} شهرياً</span>
        </div>
      </div>

      <!-- Financial Calculation Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #64748b; font-weight: bold; display: block;">الراتب الأساسي</span>
          <strong style="font-size: 1.1rem; color: #1e293b; display: block; margin: 2px 0;">${App.formatCurrency(emp.baseSalary)}</strong>
          <span style="font-size: 0.7rem; color: #94a3b8;">(${App.formatCurrency(dailyRate)}/يوم)</span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #b45309; font-weight: bold; display: block;">السلف النقدية</span>
          <strong style="font-size: 1.1rem; color: #d97706; display: block; margin: 2px 0;">-${App.formatCurrency(emp.advances || 0)}</strong>
          <span style="font-size: 0.7rem; color: #b45309;">سلفيات معلقة</span>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #b91c1c; font-weight: bold; display: block;">الجزاءات والخصومات</span>
          <strong style="font-size: 1.1rem; color: #dc2626; display: block; margin: 2px 0;">-${App.formatCurrency(emp.deductions || 0)}</strong>
          <span style="font-size: 0.7rem; color: #b91c1c;">خصم إداري مباشر</span>
        </div>

        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #be123c; font-weight: bold; display: block;">خصم أيام الغياب</span>
          <strong style="font-size: 1.1rem; color: #e11d48; display: block; margin: 2px 0;">-${App.formatCurrency(periodAbsenceDeduction)}</strong>
          <span style="font-size: 0.7rem; color: #be123c;">عدد (${periodAbsences}) أيام غياب</span>
        </div>

        <div style="background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 0.75rem; color: #047857; font-weight: bold; display: block;">صافي المستحق</span>
          <strong style="font-size: 1.25rem; color: #059669; display: block; margin: 2px 0;">${App.formatCurrency(Math.max(0, (emp.baseSalary || 0) - (emp.advances || 0) - (emp.deductions || 0) - periodAbsenceDeduction))}</strong>
          <span style="font-size: 0.7rem; color: #047857; font-weight: bold;">جاهز للصرف والتسوية</span>
        </div>
      </div>

      <!-- Detailed Attendance & Absence Log Table -->
      <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; border-bottom: 2px solid #059669; display: inline-block; padding-bottom: 2px;">
        <i class="fa-solid fa-calendar-days ml-1"></i> سجل الحضور والانصراف والغياب بالفترة المحددة (${periodLabel})
      </h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0; font-size: 0.8rem;">
        <thead style="background: #f1f5f9;">
          <tr>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">التاريخ</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">اليوم</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">حالة التسجيل</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">وقت الحضور</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">وقت الانصراف</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">البيان والملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${filteredLogs.length > 0 ? filteredLogs.map(a => `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${a.date}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;"><span style="background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${a.dayName || '-'}</span></td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                <span style="background: ${a.type === 'حاضر' ? '#dcfce7' : (a.type === 'غياب' ? '#fee2e2' : '#e0f2fe')}; color: ${a.type === 'حاضر' ? '#15803d' : (a.type === 'غياب' ? '#b91c1c' : '#0369a1')}; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                  ${a.type}
                </span>
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${a.timeIn || '-'}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${a.timeOut || '-'}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">${a.notes || '-'}</td>
            </tr>
          `).join('') : `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #94a3b8;">لا توجد حركات مسجلة للموظف في هذه الفترة المحددة</td></tr>`}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 14px;">
        <div style="border: 2px solid #059669; padding: 6px 12px; border-radius: 8px; color: #059669; text-align: center; background: rgba(5, 150, 105, 0.04);">
          <img src="${logoSrc}" alt="شعار" style="height: 24px; display: block; margin: 0 auto 2px auto;">
          <strong style="font-size: 0.8rem; display: block;">مصنع الإيمان للمكرونة</strong>
          <span style="font-size: 0.7rem; font-weight: 700;">معتمد رسمياً 🌾</span>
        </div>
        <div style="font-size: 0.8rem; color: #475569; text-align: left; line-height: 1.7;">
          <p style="margin: 0;">توقيع واستلام الموظف: ________________________</p>
          <p style="margin: 0;">اعتماد الحسابات والإدارة: ________________________</p>
        </div>
      </div>

    </div>
  `;
}

// Master Payroll Ledger Printable Document
function printMasterPayrollReport() {
  const employees = App.db.employees || [];
  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';
  const todayStr = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  let totalBase = 0;
  let totalAdvances = 0;
  let totalDeductions = 0;
  let totalAbsencesDeduction = 0;
  let totalNet = 0;

  const rows = employees.map((emp, index) => {
    const { net, absenceDeduction, advances, deductions } = calculateNetSalary(emp);
    totalBase += (emp.baseSalary || 0);
    totalAdvances += advances;
    totalDeductions += deductions;
    totalAbsencesDeduction += absenceDeduction;
    totalNet += net;

    const hireDate = emp.hireDate || '2024-01-15';
    const payDay = emp.payDay || 30;

    return `
      <tr>
        <td style="text-align: center; font-weight: bold;">${index + 1}</td>
        <td style="text-align: center;"><span class="badge-code">${emp.id}</span></td>
        <td><strong>${emp.name}</strong></td>
        <td>${emp.jobTitle}</td>
        <td style="direction: ltr; text-align: center;">${emp.phone || '-'}</td>
        <td style="text-align: center; white-space: nowrap;">${hireDate}</td>
        <td style="text-align: center; white-space: nowrap;">يوم ${payDay}</td>
        <td style="text-align: right; font-weight: bold;">${App.formatCurrency(emp.baseSalary)}</td>
        <td style="text-align: right; color: #d97706; font-weight: bold;">${advances > 0 ? '-' + App.formatCurrency(advances) : '0 ج.م'}</td>
        <td style="text-align: right; color: #dc2626; font-weight: bold;">${deductions > 0 ? '-' + App.formatCurrency(deductions) : '0 ج.م'}</td>
        <td style="text-align: right; color: #be123c; font-weight: bold;">${absenceDeduction > 0 ? '-' + App.formatCurrency(absenceDeduction) : '0 ج.م'}</td>
        <td style="text-align: right; color: #059669; font-weight: 800; font-size: 13px; background: #ecfdf5;">${App.formatCurrency(net)}</td>
        <td style="text-align: center; min-width: 90px; color: #94a3b8; font-size: 10px;">________________</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>مسير وكشف حساب الرواتب والأجور - مصنع الإيمان</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: 'Cairo', sans-serif; padding: 15px; direction: rtl; color: #0f172a; margin: 0; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
        .logo-box { display: flex; align-items: center; gap: 14px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 15px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; background: #f8fafc; }
        .kpi-card.highlight { background: #ecfdf5; border-color: #a7f3d0; }
        .kpi-card span { font-size: 10px; color: #64748b; display: block; font-weight: 700; margin-bottom: 2px; }
        .kpi-card strong { font-size: 13px; color: #0f172a; display: block; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; }
        th, td { border: 1px solid #94a3b8; padding: 6px 7px; text-align: right; }
        th { background: #f1f5f9; font-weight: 800; color: #1e293b; text-align: center; }
        .badge-code { background: #e0e7ff; color: #3730a3; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 10px; }
        .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: 25px; border-top: 2px solid #cbd5e1; padding-top: 15px; }
        .sig-item { text-align: center; width: 22%; }
        .sig-item p { font-size: 11px; font-weight: bold; margin: 0 0 25px 0; color: #334155; }
        .sig-line { border-bottom: 1px dashed #94a3b8; width: 100%; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-box">
          <img src="${logoSrc}" style="height: 55px; width: 55px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; margin: 0; font-size: 1.3rem;">مصنع الإيمان للمكرونة 🌾</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">إدارة الموارد البشرية وشؤون العاملين | مسير الأجور الشهري المعتمد</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">كشف مسير الرواتب المعتمد</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">تاريخ الإصدار: <strong>${todayStr}</strong></p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span>إجمالي الموظفين</span>
          <strong>${employees.length} موظف</strong>
        </div>
        <div class="kpi-card">
          <span>إجمالي الرواتب الأساسية</span>
          <strong>${App.formatCurrency(totalBase)}</strong>
        </div>
        <div class="kpi-card">
          <span>إجمالي السلف النقدية</span>
          <strong style="color: #d97706;">-${App.formatCurrency(totalAdvances)}</strong>
        </div>
        <div class="kpi-card">
          <span>إجمالي الجزاءات</span>
          <strong style="color: #dc2626;">-${App.formatCurrency(totalDeductions)}</strong>
        </div>
        <div class="kpi-card">
          <span>خصم أيام الغياب</span>
          <strong style="color: #be123c;">-${App.formatCurrency(totalAbsencesDeduction)}</strong>
        </div>
        <div class="kpi-card highlight">
          <span style="color: #047857;">صافي الرواتب المستحقة</span>
          <strong style="color: #059669; font-size: 14px;">${App.formatCurrency(totalNet)}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th style="width: 60px;">الكود</th>
            <th>اسم الموظف</th>
            <th>الوظيفة / القسم</th>
            <th style="width: 85px;">الهاتف</th>
            <th style="width: 75px;">التعيين</th>
            <th style="width: 65px;">القبض</th>
            <th>الأساسي</th>
            <th>السلف (-)</th>
            <th>الجزاءات (-)</th>
            <th>الغياب (-)</th>
            <th>صافي القبض</th>
            <th>توقيع الاستلام</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="footer-signatures">
        <div class="sig-item">
          <p>إعداد / مسؤول HR</p>
          <div class="sig-line"></div>
        </div>
        <div class="sig-item">
          <p>مراجعة رئيس الحسابات</p>
          <div class="sig-line"></div>
        </div>
        <div class="sig-item">
          <p>اعتماد المدير العام</p>
          <div class="sig-line"></div>
        </div>
        <div class="sig-item" style="border: 2px solid #059669; border-radius: 8px; padding: 6px; background: rgba(5, 150, 105, 0.05);">
          <span style="font-size: 10px; font-weight: bold; color: #059669; display: block;">خاتم مصنع الإيمان</span>
          <span style="font-size: 9px; color: #64748b;">معتمد رسمياً 🌾</span>
        </div>
      </div>

      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Daily Attendance Report Printable Document
function printDailyAttendanceReport() {
  const employees = App.db.employees || [];
  const logs = App.db.attendanceLog || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayFormatted = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  const logoSrc = (typeof APP_INVOICE_LOGO !== 'undefined' && APP_INVOICE_LOGO) ? APP_INVOICE_LOGO : 'image/logo.png';

  let presentCount = 0;
  let absentCount = 0;
  let unrecordedCount = 0;

  const rows = employees.map((emp, index) => {
    const rec = logs.find(a => a.empId === emp.id && a.date === todayStr);
    let statusText = 'لم يسجل اليوم ⚪';
    let statusBg = '#f1f5f9';
    let statusColor = '#64748b';
    let timeIn = '-';
    let timeOut = '-';
    let notes = '-';

    if (rec) {
      if (rec.type === 'حاضر') {
        statusText = 'حاضر 🟢';
        statusBg = '#dcfce7';
        statusColor = '#15803d';
        presentCount++;
      } else if (rec.type === 'غياب') {
        statusText = 'غائب 🔴';
        statusBg = '#fee2e2';
        statusColor = '#b91c1c';
        absentCount++;
      }
      timeIn = rec.timeIn || '-';
      timeOut = rec.timeOut || '-';
      notes = rec.notes || '-';
    } else {
      unrecordedCount++;
    }

    return `
      <tr>
        <td style="text-align: center; font-weight: bold;">${index + 1}</td>
        <td style="text-align: center;"><span class="badge-code">${emp.id}</span></td>
        <td><strong>${emp.name}</strong></td>
        <td>${emp.jobTitle}</td>
        <td style="direction: ltr; text-align: center;">${emp.phone || '-'}</td>
        <td style="text-align: center;"><span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;">${statusText}</span></td>
        <td style="text-align: center;">${timeIn}</td>
        <td style="text-align: center;">${timeOut}</td>
        <td>${notes}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>صحيفة الحضور والانصراف اليومية - مصنع الإيمان</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Cairo', sans-serif; padding: 15px; direction: rtl; color: #0f172a; margin: 0; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
        .logo-box { display: flex; align-items: center; gap: 14px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; background: #f8fafc; }
        .kpi-card span { font-size: 11px; color: #64748b; display: block; font-weight: 700; }
        .kpi-card strong { font-size: 14px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; }
        th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; }
        th { background: #f1f5f9; font-weight: 800; color: #1e293b; text-align: center; }
        .badge-code { background: #e0e7ff; color: #3730a3; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 10px; }
        .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: 25px; border-top: 2px solid #cbd5e1; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-box">
          <img src="${logoSrc}" style="height: 55px; width: 55px; object-fit: contain;">
          <div>
            <h2 style="color: #059669; margin: 0; font-size: 1.3rem;">مصنع الإيمان للمكرونة 🌾</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">صحيفة الحضور والانصراف والغياب اليومي للعمال والموظفين</p>
          </div>
        </div>
        <div style="text-align: left;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">صحيفة يومية</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #059669; font-weight: bold;">${todayFormatted}</p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span>إجمالي القوة</span>
          <strong>${employees.length} موظف</strong>
        </div>
        <div class="kpi-card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <span style="color: #15803d;">حاضرون اليوم</span>
          <strong style="color: #15803d;">${presentCount}</strong>
        </div>
        <div class="kpi-card" style="background: #fef2f2; border-color: #fecaca;">
          <span style="color: #b91c1c;">غائبون اليوم</span>
          <strong style="color: #b91c1c;">${absentCount}</strong>
        </div>
        <div class="kpi-card">
          <span>لم يسجل بعد</span>
          <strong>${unrecordedCount}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th style="width: 60px;">الكود</th>
            <th>اسم الموظف</th>
            <th>الوظيفة</th>
            <th style="width: 90px;">الهاتف</th>
            <th style="width: 85px;">الحالة اليومية</th>
            <th style="width: 75px;">وقت الحضور</th>
            <th style="width: 75px;">وقت الانصراف</th>
            <th>البيان والملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="footer-signatures">
        <div>مسؤول الحضور: ____________________</div>
        <div>المشرف العام: ____________________</div>
        <div>اعتماد الإدارة: ____________________</div>
      </div>

      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
