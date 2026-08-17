/* ==========================================================================
   مصنع الإيمان للمكرونة - Users, Authentication & Permissions Matrix
   Pure JavaScript (ES6+) - Enterprise RBAC (Role-Based Access Control)
   Developed by Speed Up (https://speed-up.tech/)
   ========================================================================== */

let currentUsersSearch = '';

document.addEventListener('DOMContentLoaded', () => {
  // Repair legacy user records if any were corrupted with duplicate admin username
  if (App.db && App.db.users) {
    App.db.users.forEach(u => {
      if (u.id === 'USR-2' && u.username === 'admin') u.username = 'sales';
      if (u.id === 'USR-3' && u.username === 'admin') u.username = 'inventory';
      if (u.id === 'USR-4' && u.username === 'admin') u.username = 'accountant';
    });
    App.save();
  }

  renderAppLayout('users');
  loadUsersTable();

  // Handle URL Search query if any
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.value = searchQuery;
      filterUsersTable(searchQuery);
    }
  }
});

// Role Presets for quick permission assignment
function handleRolePresetChange(role) {
  const checkboxes = document.querySelectorAll('input[name="new-perm"]');
  const roleMap = {
    'مسؤول مبيعات': ['dashboard', 'sales', 'customers'],
    'أمين مخزن': ['dashboard', 'inventory', 'reports'],
    'محاسب مالي': ['dashboard', 'sales', 'expenses', 'reports', 'suppliers'],
    'مشرف موارد بشرية': ['dashboard', 'hr', 'expenses'],
    'مدير عام': ['dashboard', 'sales', 'inventory', 'suppliers', 'customers', 'hr', 'expenses', 'reports', 'users', 'notifications']
  };

  const allowed = roleMap[role];
  if (!allowed) return;

  checkboxes.forEach(cb => {
    cb.checked = allowed.includes(cb.value);
  });
}

function toggleAllPermissions(prefix, checkAll) {
  const checkboxes = document.querySelectorAll(`input[name="${prefix}-perm"]`);
  checkboxes.forEach(cb => cb.checked = checkAll);
}

// Filter Users
function filterUsersTable(query) {
  currentUsersSearch = (query || '').trim().toLowerCase();
  loadUsersTable();
}

// Load Users Matrix Table
function loadUsersTable(usersData = null) {
  const tbody = document.getElementById('users-list-tbody');
  if (!tbody) return;

  const users = usersData || App.db.users || [];
  let filtered = users;

  if (currentUsersSearch) {
    filtered = users.filter(u => 
      (u.name || '').toLowerCase().includes(currentUsersSearch) ||
      (u.username || '').toLowerCase().includes(currentUsersSearch) ||
      (u.role || '').toLowerCase().includes(currentUsersSearch) ||
      (u.id || '').toLowerCase().includes(currentUsersSearch)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-6">لا يوجد حسابات مسجلة مطابقة للبحث</td></tr>`;
    return;
  }

  const permissionLabels = {
    'dashboard': 'لوحة التحكم',
    'sales': 'المبيعات',
    'inventory': 'المخازن',
    'suppliers': 'الموردين',
    'customers': 'العملاء',
    'hr': 'الموارد البشرية',
    'expenses': 'المصروفات',
    'reports': 'الجرد والتقارير',
    'users': 'المستخدمين',
    'notifications': 'الإشعارات'
  };

  tbody.innerHTML = filtered.map(u => {
    const isMasterAdmin = u.id === 'USR-1';
    const isActive = u.status === 'نشط';

    const badgesHTML = (u.permissions || []).map(pKey => {
      const label = permissionLabels[pKey] || pKey;
      return `<span class="badge badge-blue text-xs font-bold" style="margin: 2px 2px 2px 0;">${label}</span>`;
    }).join('');

    return `
      <tr style="${!isActive ? 'opacity: 0.65; background: #fdf2f2;' : ''}">
        <td><strong class="badge badge-purple font-bold">${u.id}</strong></td>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width: 34px; height: 34px; font-size: 0.85rem; background: ${isActive ? 'linear-gradient(135deg, #059669, #10b981)' : '#94a3b8'}; color: #fff;">
              ${(u.name || 'إ').charAt(0)}
            </div>
            <div>
              <strong class="text-sm text-slate-800 block">${u.name}</strong>
              <div class="text-xs text-muted">اسم الدخول: <span class="font-bold text-primary-color" style="font-size: 0.85rem;">${u.username}</span></div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${isMasterAdmin ? 'badge-amber' : 'badge-gray'} text-xs font-bold">
            ${isMasterAdmin ? '👑 ' : ''}${u.role || 'موظف'}
          </span>
        </td>
        <td>
          <div class="flex flex-wrap gap-1" style="max-width: 320px;">
            ${badgesHTML || '<span class="text-xs text-muted font-bold text-rose-500">لا توجد صلاحيات</span>'}
          </div>
        </td>
        <td><span class="text-xs text-muted">${u.createdAt || '2024-01-01'}</span></td>
        <td>
          <span class="badge ${isActive ? 'badge-success' : 'badge-danger'} text-xs font-bold">
            ${isActive ? 'نشط 🟢' : 'معطل 🔴'}
          </span>
        </td>
        <td>
          <div class="flex gap-2 flex-wrap items-center">
            <button class="btn btn-secondary btn-xs" onclick="openEditUserModal('${u.id}')" title="تعديل الصلاحيات وكلمة المرور">
              <i class="fa-solid fa-pen-to-square ml-1"></i> تعديل
            </button>

            ${!isMasterAdmin ? `
              <button class="btn btn-xs ${isActive ? 'btn-danger' : 'btn-primary'}" onclick="toggleUserStatus('${u.id}')" title="${isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}">
                <i class="fa-solid ${isActive ? 'fa-ban' : 'fa-check'} ml-1"></i> ${isActive ? 'تعطيل' : 'تفعيل'}
              </button>

              <button class="btn btn-danger btn-xs" onclick="deleteUserAccount('${u.id}')" title="حذف الحساب نهائياً من السيستم">
                <i class="fa-solid fa-trash ml-1"></i> حذف
              </button>
            ` : '<span class="text-xs text-muted font-bold">(حساب أساسي)</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Create New User Account
function saveNewUserAccount() {
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value.trim();

  if (!name || !username || !password) {
    App.showToast('رجاء إدخال الاسم، اسم المستخدم، وكلمة المرور', 'warning');
    return;
  }

  // Check unique username
  const users = App.db.users || [];
  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());

  if (exists) {
    App.showToast('اسم المستخدم مسجل بالفعل بحساب آخر! يرجى اختيار اسم مستخدم مختلف.', 'danger');
    return;
  }

  // Read checked permissions
  const checkedBoxes = document.querySelectorAll('input[name="new-perm"]:checked');
  const permissions = Array.from(checkedBoxes).map(cb => cb.value);

  if (permissions.length === 0) {
    App.showToast('رجاء تحديد صلاحية واحدة على الأقل لهذا الحساب', 'warning');
    return;
  }

  const newUser = {
    id: `USR-${Date.now().toString().slice(-4)}`,
    name: name,
    username: username,
    password: password,
    role: role === 'مخصص' ? 'موظف مخصص' : role,
    status: 'نشط',
    createdAt: new Date().toISOString().slice(0, 10),
    permissions: permissions
  };

  App.db.users.push(newUser);
  if (typeof App.logActivity === 'function') {
    App.logActivity('إنشاء حساب مستخدم جديد 🛡️', `تم إنشاء حساب للموظف (${newUser.name}) باسم دخول (${newUser.username}) ورتبة (${newUser.role})`, 'success');
  }
  App.save();
  loadUsersTable();
  renderPageSummaryCards('users', 'users-summary-cards');

  // Reset form
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-username').value = '';
  document.getElementById('new-user-password').value = '';

  App.showToast(`تم إنشاء وتفعيل حساب المستخدم (${newUser.name}) بنجاح! 🛡️✨`, 'success');
}

// Toggle Active / Disabled Status
function toggleUserStatus(userId) {
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.id === 'USR-1') {
    App.showToast('لا يمكن تعطيل حساب المدير العام الرئيسي للنظام!', 'warning');
    return;
  }

  const isNowActive = user.status !== 'نشط';
  user.status = isNowActive ? 'نشط' : 'معطل';

  if (typeof App.logActivity === 'function') {
    App.logActivity('تغيير حالة حساب موظف 🔄', `تم ${isNowActive ? 'تفعيل وتنشيط' : 'تعطيل وحظر'} حساب الموظف (${user.name}) واسم الدخول (${user.username})`, isNowActive ? 'success' : 'danger');
  }

  App.save();
  loadUsersTable();
  renderPageSummaryCards('users', 'users-summary-cards');

  if (isNowActive) {
    App.showToast(`تم تفعيل حساب المستخدم (${user.name}) بنجاح 🟢`, 'success');
  } else {
    App.showToast(`تم تعطيل حساب المستخدم (${user.name}) وحظر دخوله للنظام 🔴`, 'danger');
  }
}

// Edit User Modal Handling
function openEditUserModal(userId) {
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-name').value = user.name || '';
  document.getElementById('edit-user-role').value = user.role || '';
  document.getElementById('edit-user-username').value = user.username || '';
  document.getElementById('edit-user-password').value = user.password || '';

  // Check user permissions
  const checkboxes = document.querySelectorAll('input[name="edit-perm"]');
  checkboxes.forEach(cb => {
    cb.checked = (user.permissions || []).includes(cb.value);
  });

  openModal('edit-user-modal');
}

function updateUserAccount() {
  const userId = document.getElementById('edit-user-id').value;
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  const name = document.getElementById('edit-user-name').value.trim();
  const role = document.getElementById('edit-user-role').value.trim();
  const username = document.getElementById('edit-user-username').value.trim();
  const password = document.getElementById('edit-user-password').value.trim();

  if (!name || !username) {
    App.showToast('رجاء إدخال الاسم واسم المستخدم', 'warning');
    return;
  }

  if (!password) {
    App.showToast('رجاء إدخال كلمة المرور', 'warning');
    return;
  }

  // Check unique username with other accounts
  const isDuplicate = (App.db.users || []).some(u => u.id !== userId && u.username.toLowerCase() === username.toLowerCase());
  if (isDuplicate) {
    App.showToast('اسم المستخدم هذا مستخدم بالفعل من قبل حساب آخر!', 'danger');
    return;
  }

  // Read checked permissions
  const checkedBoxes = document.querySelectorAll('input[name="edit-perm"]:checked');
  const permissions = Array.from(checkedBoxes).map(cb => cb.value);

  user.name = name;
  user.role = role || user.role;
  user.username = username;
  user.password = password;
  user.permissions = permissions;

  // If editing currently logged in user, update session
  const currentUser = App.getCurrentUser();
  if (currentUser && currentUser.id === user.id) {
    App.setCurrentUser(user);
  }

  if (typeof App.logActivity === 'function') {
    App.logActivity('تعديل حساب وصلاحيات موظف ✏️', `تم تحديث بيانات وصلاحيات وكلمة مرور الحساب (${user.name}) اسم الدخول (${user.username})`, 'warning');
  }

  App.save();
  loadUsersTable();
  renderPageSummaryCards('users', 'users-summary-cards');
  closeModal('edit-user-modal');

  App.showToast(`تم حفظ وتحديث بيانات وباسورد الحساب (${user.name}) بنجاح! 💾`, 'success');
}

// Delete User Account
function deleteUserAccount(userId) {
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.id === 'USR-1') {
    App.showToast('عفواً، لا يمكن حذف حساب المدير العام الرئيسي لحماية النظام!', 'warning');
    return;
  }

  App.showConfirmModal({
    title: 'حذف حساب مستخدم',
    message: `هل أنت متأكد تماماً من رغبتك في حذف حساب المستخدم (${user.name}) واسم الدخول (${user.username})؟ لن يتمكن من تسجيل الدخول إلى النظام بعد الآن.`,
    icon: 'fa-solid fa-user-xmark',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    confirmText: 'نعم، حذف الحساب 🗑️',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      const deletedName = user.name;
      const deletedUser = user.username;
      App.db.users = (App.db.users || []).filter(u => u.id !== userId);

      if (typeof App.logActivity === 'function') {
        App.logActivity('حذف حساب مستخدم 🗑️', `تم حذف حساب الموظف (${deletedName}) اسم الدخول (${deletedUser}) نهائياً من السيستم`, 'danger');
      }

      App.save();
      loadUsersTable();
      renderPageSummaryCards('users', 'users-summary-cards');
      App.showToast(`تم حذف حساب المستخدم (${deletedName}) من النظام نهائياً 🗑️`, 'danger');
    }
  });
}
