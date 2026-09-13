/* ==========================================================================
   مصنع الإيمان للمكرونة - Users, Authentication & Permissions Matrix
   Pure JavaScript (ES6+) - Enterprise RBAC (Role-Based Access Control)
   Connected to Google Firebase Authentication & Firestore Realtime Sync
   Developed by Speed Up (https://speed-up.tech/)
   ========================================================================== */

let currentUsersSearch = '';

document.addEventListener('DOMContentLoaded', () => {
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

  if (!App.db) App.db = {};
  if (!App.db.users) App.db.users = [];

  // Ensure Admin user always exists in DB and is active
  let adminRecord = App.db.users.find(u => u.id === 'USR-1' || u.email === 'admin@eleman.com' || (u.username === 'admin' && u.role === 'مدير عام'));
  if (!adminRecord) {
    adminRecord = {
      id: 'USR-1',
      username: 'admin',
      name: 'المدير العام',
      email: 'admin@eleman.com',
      role: 'مدير عام',
      phone: '01000000000',
      status: 'نشط',
      permissions: ['dashboard', 'sales', 'inventory', 'suppliers', 'customers', 'hr', 'expenses', 'reports', 'users', 'notifications'],
      createdAt: '2025-01-01'
    };
    App.db.users.unshift(adminRecord);
    App.save();
  } else if (!adminRecord.role || adminRecord.role !== 'مدير عام') {
    adminRecord.role = 'مدير عام';
    adminRecord.status = 'نشط';
    adminRecord.permissions = ['dashboard', 'sales', 'inventory', 'suppliers', 'customers', 'hr', 'expenses', 'reports', 'users', 'notifications'];
    App.save();
  }

  const users = usersData || App.db.users || [];
  let filtered = users;

  if (currentUsersSearch) {
    filtered = users.filter(u => 
      (u.name || '').toLowerCase().includes(currentUsersSearch) ||
      (u.username || '').toLowerCase().includes(currentUsersSearch) ||
      (u.email || '').toLowerCase().includes(currentUsersSearch) ||
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
    const isMasterAdmin = u.id === 'USR-1' || u.email === 'admin@eleman.com' || (u.username === 'admin' && u.role === 'مدير عام');
    const isActive = u.status === 'نشط';
    const emailDisplay = u.email || (u.username ? `${u.username}@eleman.com` : 'بدون بريد');

    const badgesHTML = (u.permissions || []).map(pKey => {
      const label = permissionLabels[pKey] || pKey;
      return `<span class="badge badge-blue text-xs font-bold" style="margin: 2px 2px 2px 0;">${label}</span>`;
    }).join('');

    return `
      <tr style="${!isActive ? 'opacity: 0.65; background: #fdf2f2;' : ''}">
        <td><strong class="badge badge-purple font-bold">${u.id}</strong></td>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width: 36px; height: 36px; font-size: 0.85rem; background: ${isActive ? 'linear-gradient(135deg, #059669, #10b981)' : '#94a3b8'}; color: #fff;">
              ${(u.name || 'إ').charAt(0)}
            </div>
            <div>
              <strong class="text-sm text-slate-800 block">${u.name}</strong>
              <div class="text-xs text-muted">
                إيميل: <span class="font-bold text-primary-color">${emailDisplay}</span>
              </div>
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
        <td><span class="text-xs text-muted">${u.createdAt || '2026-09-13'}</span></td>
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

// Create New User Account in Firebase Auth & Firestore
async function saveNewUserAccount() {
  const name = document.getElementById('new-user-name').value.trim();
  const emailInput = document.getElementById('new-user-email');
  let email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const role = document.getElementById('new-user-role').value;
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value.trim();

  if (!name || !username || !password) {
    App.showToast('رجاء إدخال الاسم، اسم المستخدم، وكلمة المرور', 'warning');
    return;
  }

  if (password.length < 6) {
    App.showToast('كلمة المرور في فايربيز يجب ألا تقل عن 6 أحرف أو أرقام', 'warning');
    return;
  }

  if (!email) {
    email = `${username.toLowerCase()}@eleman.com`;
  }

  // Check unique username or email
  const users = App.db.users || [];
  const exists = users.some(u => 
    (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
    (u.email && u.email.toLowerCase() === email.toLowerCase())
  );

  if (exists) {
    App.showToast('اسم المستخدم أو البريد الإلكتروني مسجل بالفعل بحساب آخر! يرجى اختيار بيانات مختلفة.', 'danger');
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
    email: email,
    username: username,
    password: password,
    role: role === 'مخصص' ? 'موظف مخصص' : role,
    status: 'نشط',
    createdAt: new Date().toISOString().slice(0, 10),
    permissions: permissions
  };

  App.showToast('جاري إنشاء الحساب والمزامنة مع فايربيز... ⏳', 'info');

  try {
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.auth) {
      await FirebaseSync.createEmployeeInFirebaseAuth(email, password, newUser);
    } else {
      if (!App.db.users) App.db.users = [];
      App.db.users.push(newUser);
      App.save();
    }

    if (typeof App.logActivity === 'function') {
      App.logActivity('إنشاء حساب مستخدم جديد 🛡️', `تم إنشاء حساب للموظف (${newUser.name}) بإيميل (${newUser.email}) ورتبة (${newUser.role})`, 'success');
    }
    loadUsersTable();
    renderPageSummaryCards('users', 'users-summary-cards');

    // Reset form
    document.getElementById('new-user-name').value = '';
    if (emailInput) emailInput.value = '';
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';

    App.showToast(`تم إنشاء وتفعيل حساب المستخدم (${newUser.name}) في فايربيز بنجاح! 🛡️✨`, 'success');
  } catch (err) {
    console.error('Error creating user in Firebase:', err);
    App.showToast(`حدث خطأ أثناء إنشاء الحساب في فايربيز: ${err.message}`, 'danger');
  }
}

// Toggle Active / Disabled Status
function toggleUserStatus(userId) {
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.id === 'USR-1' || user.email === 'admin@eleman.com') {
    App.showToast('لا يمكن تعطيل حساب المدير العام الرئيسي للنظام!', 'warning');
    return;
  }

  const isNowActive = user.status !== 'نشط';
  user.status = isNowActive ? 'نشط' : 'معطل';

  if (typeof App.logActivity === 'function') {
    App.logActivity('تغيير حالة حساب موظف 🔄', `تم ${isNowActive ? 'تفعيل وتنشيط' : 'تعطيل وحظر'} حساب الموظف (${user.name}) وإيميل (${user.email || user.username})`, isNowActive ? 'success' : 'danger');
  }

  App.save(); // Pushes update directly to Firebase Firestore
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
  const emailInput = document.getElementById('edit-user-email');
  if (emailInput) emailInput.value = user.email || (user.username ? `${user.username}@eleman.com` : '');
  document.getElementById('edit-user-role').value = user.role || '';
  document.getElementById('edit-user-username').value = user.username || '';
  document.getElementById('edit-user-password').value = ''; // clean for new password

  // Set permissions
  const checkboxes = document.querySelectorAll('input[name="edit-perm"]');
  checkboxes.forEach(cb => {
    cb.checked = (user.permissions || []).includes(cb.value);
  });

  openModal('edit-user-modal');
}

// Send Password Reset Link to Selected User Email
async function sendPasswordResetToSelectedUser() {
  const emailInput = document.getElementById('edit-user-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email) {
    App.showToast('رجاء إدخال البريد الإلكتروني للمستخدم لإرسال رابط إعادة التعيين', 'warning');
    return;
  }

  App.showToast('جاري إرسال رابط إعادة تعيين كلمة المرور... ✉️', 'info');

  try {
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.sendPasswordResetEmail) {
      await FirebaseSync.sendPasswordResetEmail(email);
      App.showToast(`تم إرسال رابط رسمي لتعيين كلمة المرور إلى (${email}) بنجاح! تفقد بريدك الإلكتروني. ✉️✨`, 'success');
    } else {
      App.showToast('محرك المصادقة غير متاح حالياً', 'danger');
    }
  } catch (err) {
    console.error('sendPasswordResetEmail error:', err);
    App.showToast(`تعذر إرسال الرابط: ${err.message}`, 'danger');
  }
}

// Update User Account in Database & Firebase Auth
async function updateUserAccount() {
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value.trim();
  const emailInput = document.getElementById('edit-user-email');
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const role = document.getElementById('edit-user-role').value.trim();
  const username = document.getElementById('edit-user-username').value.trim();
  const password = document.getElementById('edit-user-password').value.trim();

  if (!name || !username) {
    App.showToast('رجاء إدخال الاسم واسم المستخدم', 'warning');
    return;
  }

  const user = (App.db.users || []).find(u => u.id === id);
  if (!user) return;

  const checkedBoxes = document.querySelectorAll('input[name="edit-perm"]:checked');
  const permissions = Array.from(checkedBoxes).map(cb => cb.value);

  user.name = name;
  if (email) user.email = email;
  user.role = role;
  user.username = username;
  user.permissions = permissions;

  // If new password provided
  if (password) {
    if (password.length < 6) {
      App.showToast('كلمة المرور يجب ألا تقل عن 6 خانات', 'warning');
      return;
    }
    user.password = password;

    const currentUser = App.getCurrentUser();
    // If the admin is updating their own password in Firebase Auth directly
    if (currentUser && (currentUser.id === user.id || (currentUser.email && currentUser.email === user.email))) {
      try {
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.updateCurrentUserPassword) {
          await FirebaseSync.updateCurrentUserPassword(password);
          App.showToast('تم تحديث كلمة المرور في سحابة Firebase Auth بنجاح 🔒', 'success');
        }
      } catch (err) {
        console.warn('Password update direct auth notice:', err);
        App.showToast(`تم حفظ كلمة المرور بقاعدة البيانات (${err.message})`, 'info');
      }
    }
  }

  // If editing currently logged in user, update session
  const currentUser = App.getCurrentUser();
  if (currentUser && currentUser.id === user.id) {
    App.setCurrentUser(user);
  }

  if (typeof App.logActivity === 'function') {
    App.logActivity('تعديل حساب وصلاحيات موظف ✏️', `تم تحديث بيانات وصلاحيات الحساب (${user.name}) وإيميل (${user.email || user.username})`, 'warning');
  }

  App.save(); // Saves and pushes to Firestore
  loadUsersTable();
  renderPageSummaryCards('users', 'users-summary-cards');
  closeModal('edit-user-modal');

  App.showToast(`تم حفظ وتحديث بيانات وباسورد الحساب (${user.name}) بنجاح في السحابة! 💾`, 'success');
}

// Delete User Account (Deleted instantly from Firestore)
function deleteUserAccount(userId) {
  const user = (App.db.users || []).find(u => u.id === userId);
  if (!user) return;

  if (user.id === 'USR-1' || user.email === 'admin@eleman.com') {
    App.showToast('عفواً، لا يمكن حذف حساب المدير العام الرئيسي لحماية النظام!', 'warning');
    return;
  }

  App.showConfirmModal({
    title: 'حذف حساب مستخدم',
    message: `هل أنت متأكد تماماً من رغبتك في حذف حساب المستخدم (${user.name}) نهائياً من قاعدة البيانات وسحابة فايربيز؟ لن يتمكن من تسجيل الدخول إلى النظام بعد الآن.`,
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
        App.logActivity('حذف حساب مستخدم 🗑️', `تم حذف حساب الموظف (${deletedName}) اسم الدخول (${deletedUser}) نهائياً من السيستم والسحابة`, 'danger');
      }

      App.save(); // Saves and sets payload to Firestore makro_db/system_data
      loadUsersTable();
      renderPageSummaryCards('users', 'users-summary-cards');
      App.showToast(`تم حذف حساب المستخدم (${deletedName}) من النظام والسحابة نهائياً 🗑️`, 'danger');
    }
  });
}

// Open Change My Password Modal (Admin Direct)
function openChangeMyPasswordModal() {
  const user = App.getCurrentUser();
  const emailInput = document.getElementById('my-account-email');
  if (emailInput) {
    emailInput.value = (user && user.email) ? user.email : 'admin@eleman.com';
  }
  const p1 = document.getElementById('my-new-password');
  const p2 = document.getElementById('my-new-password-confirm');
  if (p1) p1.value = '';
  if (p2) p2.value = '';
  openModal('change-my-password-modal');
}

// Save Admin New Password in Firebase Auth & Firestore
async function saveMyNewPassword() {
  const p1 = (document.getElementById('my-new-password')?.value || '').trim();
  const p2 = (document.getElementById('my-new-password-confirm')?.value || '').trim();

  if (!p1) {
    App.showToast('يرجى إدخال كلمة المرور الجديدة', 'warning');
    return;
  }
  if (p1.length < 6) {
    App.showToast('يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام', 'warning');
    return;
  }
  if (p1 !== p2) {
    App.showToast('كلمتا المرور غير متطابقتين!', 'warning');
    return;
  }

  const currentUser = App.getCurrentUser();
  const userEmail = (currentUser && currentUser.email) ? currentUser.email : 'admin@eleman.com';

  // 1. Update in Firebase Auth directly if supported
  try {
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.updateCurrentUserPassword) {
      await FirebaseSync.updateCurrentUserPassword(p1);
    }
  } catch (err) {
    console.warn('Direct Firebase Auth update notice:', err);
  }

  // 2. Update user in App.db.users
  const userInDb = (App.db.users || []).find(u => u.id === 'USR-1' || u.email === userEmail || u.username === 'admin');
  if (userInDb) {
    userInDb.password = p1;
  }
  if (currentUser) {
    currentUser.password = p1;
    App.setCurrentUser(currentUser);
  }

  App.save(); // push to firestore

  if (typeof App.logActivity === 'function') {
    App.logActivity('تغيير كلمة مرور الأدمن 🔐', `قام الأدمن بتغيير كلمة المرور الخاصة بحسابه (${userEmail}) بنجاح`, 'success');
  }

  closeModal('change-my-password-modal');
  App.showToast('تم تحديث كلمة المرور بنجاح في سحابة فايربيز والنظام! 🔐✨', 'success');
}
