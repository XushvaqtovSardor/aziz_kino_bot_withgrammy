// Check authentication
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');

// If token in URL, save it
if (urlToken) {
  localStorage.setItem('admin_token', urlToken);
  // Remove token from URL for security
  window.history.replaceState({}, document.title, window.location.pathname);
}

const token = localStorage.getItem('admin_token');
const adminData = JSON.parse(localStorage.getItem('admin_data') || '{}');

if (!token) {
  window.location.href = '/admin/index.html';
}

const API_BASE = '/api/admin';
let currentSection = 'stats';

// API Helper
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Token': token,
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      alert('Avtorizatsiya xatosi! Qaytadan kiring.');
      logout();
      return null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.message || `Xatolik: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch admin info from API if not in localStorage
  if (!adminData.username || !adminData.role) {
    try {
      const adminInfo = await apiRequest('/me');
      if (adminInfo) {
        localStorage.setItem('admin_data', JSON.stringify(adminInfo));
        document.getElementById('adminName').textContent =
          adminInfo.username || adminInfo.telegramId;
        document.getElementById('adminRole').textContent = adminInfo.role;

        // Update role-based visibility
        hideMenuByRole(adminInfo.role);
      }
    } catch (error) {
      console.error('Failed to fetch admin info:', error);
      logout();
      return;
    }
  } else {
    // Set admin info from localStorage
    document.getElementById('adminName').textContent =
      adminData.username || 'Admin';
    document.getElementById('adminRole').textContent =
      adminData.role || 'ADMIN';

    hideMenuByRole(adminData.role);
  }

  // Navigation
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      switchSection(section);
    });
  });

  // Load initial data
  await loadStats();
});

function hideMenuByRole(role) {
  if (role === 'ADMIN') {
    // ADMIN faqat content ko'ra oladi
    const adminsNav = document.querySelector('[data-section="admins"]');
    const channelsNav = document.querySelector('[data-section="channels"]');
    if (adminsNav) adminsNav.style.display = 'none';
    if (channelsNav) channelsNav.style.display = 'none';
  } else if (role === 'MANAGER') {
    // MANAGER admin qo'sha olmaydi
    const adminsNav = document.querySelector('[data-section="admins"]');
    if (adminsNav) adminsNav.style.display = 'none';
  }
}

// Section Management
function switchSection(section) {
  currentSection = section;

  // Update nav
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Update sections
  document.querySelectorAll('.section').forEach((sec) => {
    sec.classList.remove('active');
  });
  document.getElementById(`${section}-section`).classList.add('active');

  // Update title
  const titles = {
    stats: 'Statistika',
    admins: 'Adminlar',
    users: 'Foydalanuvchilar',
    fields: 'Fieldlar',
    channels: 'Kanallar',
    movies: 'Kinolar',
    serials: 'Seriallar',
    payments: "To'lovlar",
  };
  document.getElementById('sectionTitle').textContent = titles[section];

  // Load section data
  loadSectionData(section);
}

async function loadSectionData(section) {
  const loaders = {
    stats: loadStats,
    admins: loadAdmins,
    users: loadUsers,
    fields: loadFields,
    channels: loadChannels,
    movies: loadMovies,
    serials: loadSerials,
    payments: loadPayments,
  };

  const loader = loaders[section];
  if (loader) {
    await loader();
  }
}

function refreshData() {
  loadSectionData(currentSection);
}

// Stats
async function loadStats() {
  try {
    const stats = await apiRequest('/stats');

    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('totalMovies').textContent = stats.totalMovies || 0;
    document.getElementById('totalSerials').textContent =
      stats.totalSerials || 0;
    document.getElementById('pendingPayments').textContent =
      stats.pendingPayments || 0;
  } catch (error) {
    console.error('Stats error:', error);
  }
}

// Admins
async function loadAdmins() {
  const section = document.getElementById('admins-section');

  if (adminData.role !== 'SUPERADMIN') {
    section.innerHTML =
      '<div class="loading">Faqat SuperAdmin ko\'ra oladi</div>';
    return;
  }

  try {
    const admins = await apiRequest('/admins');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Adminlar ro'yxati</h2>
                    <button class="add-btn" onclick="showAddAdminModal()">+ Yangi admin</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Telegram ID</th>
                            <th>Role</th>
                            <th>Qo'shilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${admins
                          .map(
                            (admin) => `
                            <tr>
                                <td>${admin.id}</td>
                                <td>@${admin.username}</td>
                                <td>${admin.telegramId}</td>
                                <td><span class="badge badge-info">${admin.role}</span></td>
                                <td>${new Date(admin.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    ${
                                      admin.role !== 'SUPERADMIN'
                                        ? `
                                        <button class="action-btn btn-delete" onclick="deleteAdmin('${admin.telegramId}')">
                                            🗑️ O'chirish
                                        </button>
                                    `
                                        : ''
                                    }
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

function showAddAdminModal() {
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Yangi admin qo'shish</h2>
        <form id="addAdminForm">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required placeholder="@username">
            </div>
            <div class="form-group">
                <label>Telegram ID</label>
                <input type="text" name="telegramId" required placeholder="123456789">
            </div>
            <div class="form-group">
                <label>Role</label>
                <select name="role" required>
                    <option value="ADMIN">ADMIN - Faqat kontent</option>
                    <option value="MANAGER">MANAGER - Kontent va kanallar</option>
                    <option value="SUPERADMIN">SUPERADMIN - Hammasi</option>
                </select>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addAdminForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        await apiRequest('/admins', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadAdmins();
        alert("Admin qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteAdmin(telegramId) {
  if (!confirm("Adminni o'chirishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/admins/${telegramId}`, { method: 'DELETE' });
    loadAdmins();
    alert("Admin o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Users
async function loadUsers() {
  const section = document.getElementById('users-section');

  try {
    const users = await apiRequest('/users');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Foydalanuvchilar ro'yxati</h2>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Telegram ID</th>
                            <th>Premium</th>
                            <th>Bloklangan</th>
                            <th>Ro'yxatdan o'tgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users
                          .map(
                            (user) => `
                            <tr>
                                <td>${user.id}</td>
                                <td>@${user.username || '-'}</td>
                                <td>${user.telegramId}</td>
                                <td>
                                    ${
                                      user.isPremium
                                        ? `<span class="badge badge-success">Premium</span>`
                                        : `<span class="badge badge-warning">Oddiy</span>`
                                    }
                                </td>
                                <td>
                                    ${
                                      user.isBlocked
                                        ? `<span class="badge badge-danger">Bloklangan</span>`
                                        : `<span class="badge badge-success">Faol</span>`
                                    }
                                </td>
                                <td>${new Date(user.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn ${user.isBlocked ? 'btn-approve' : 'btn-delete'}" 
                                            onclick="toggleBlockUser('${user.telegramId}', ${!user.isBlocked})">
                                        ${user.isBlocked ? '✅ Blokdan chiqarish' : '🚫 Bloklash'}
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

async function toggleBlockUser(telegramId, block) {
  try {
    await apiRequest(`/users/${telegramId}/block`, {
      method: 'PUT',
      body: JSON.stringify({ block }),
    });
    loadUsers();
    alert(
      block ? 'Foydalanuvchi bloklandi!' : 'Foydalanuvchi blokdan chiqarildi!',
    );
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Fields
async function loadFields() {
  const section = document.getElementById('fields-section');

  try {
    const fields = await apiRequest('/fields');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Fieldlar ro'yxati</h2>
                    <button class="add-btn" onclick="showAddFieldModal()">+ Yangi field</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Kanal linki</th>
                            <th>Kinolar</th>
                            <th>Seriallar</th>
                            <th>Yaratilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fields
                          .map(
                            (field) => `
                            <tr>
                                <td>${field.id}</td>
                                <td>${field.name}</td>
                                <td><a href="${field.channelLink || '#'}" target="_blank">${field.channelLink || 'N/A'}</a></td>
                                <td>${field._count?.movies || 0}</td>
                                <td>${field._count?.serials || 0}</td>
                                <td>${new Date(field.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-delete" onclick="deleteField(${field.id})">
                                        🗑️ O'chirish
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

function showAddFieldModal() {
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Yangi field qo'shish</h2>
        <form id="addFieldForm">
            <div class="form-group">
                <label>Field nomi</label>
                <input type="text" name="name" required placeholder="Masalan: Jangovar kinolar">
            </div>
            <div class="form-group">
                <label>Kanal linki</label>
                <input type="text" name="channelLink" required placeholder="https://t.me/jangovarkinolar">
                <small>Bu field uchun maxsus Telegram kanal</small>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addFieldForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        await apiRequest('/fields', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadFields();
        alert("Field qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteField(id) {
  if (
    !confirm(
      "Fieldni o'chirishga ishonchingiz komilmi?\n(Ulangan barcha kinolar ham o'chiriladi!)",
    )
  )
    return;

  try {
    await apiRequest(`/fields/${id}`, { method: 'DELETE' });
    loadFields();
    alert("Field o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Channels
async function loadChannels() {
  const section = document.getElementById('channels-section');

  if (adminData.role === 'ADMIN') {
    section.innerHTML = '<div class="loading">Sizda ruxsat yo\'q</div>';
    return;
  }

  try {
    const [mandatory, database] = await Promise.all([
      apiRequest('/channels/mandatory'),
      apiRequest('/channels/database'),
    ]);

    section.innerHTML = `
            <!-- Mandatory Channels -->
            <div class="data-table" style="margin-bottom: 30px;">
                <div class="table-header">
                    <h2>Majburiy kanallar</h2>
                    <button class="add-btn" onclick="showAddMandatoryChannelModal()">+ Kanal qo'shish</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Kanal linki</th>
                            <th>Channel ID</th>
                            <th>Yaratilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mandatory
                          .map(
                            (channel) => `
                            <tr>
                                <td>${channel.id}</td>
                                <td>${channel.channelName || 'N/A'}</td>
                                <td>${channel.channelLink || 'N/A'}</td>
                                <td>${channel.channelId || 'N/A'}</td>
                                <td>${new Date(channel.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-delete" onclick="deleteMandatoryChannel(${channel.id})">
                                        🗑️ O'chirish
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>

            <!-- Database Channels -->
            <div class="data-table">
                <div class="table-header">
                    <h2>Database kanallar</h2>
                    <button class="add-btn" onclick="showAddDatabaseChannelModal()">+ Database kanal qo'shish</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Channel ID</th>
                            <th>Yaratilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${database
                          .map(
                            (channel) => `
                            <tr>
                                <td>${channel.id}</td>
                                <td>${channel.channelName || 'N/A'}</td>
                                <td>${channel.channelId || 'N/A'}</td>
                                <td>${new Date(channel.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-delete" onclick="deleteDatabaseChannel(${channel.id})">
                                        🗑️ O'chirish
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

function showAddMandatoryChannelModal() {
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Majburiy kanal qo'shish</h2>
        <form id="addMandatoryChannelForm">
            <div class="form-group">
                <label>Kanal nomi</label>
                <input type="text" name="channelName" required placeholder="Masalan: Aziz Kino Rasmiy">
            </div>
            <div class="form-group">
                <label>Kanal linki</label>
                <input type="text" name="channelLink" required placeholder="https://t.me/azizkino">
                <small>Majburiy. Telegram kanal yoki Instagram profil linki</small>
            </div>
            <div class="form-group">
                <label>Channel ID (optional)</label>
                <input type="text" name="channelId" placeholder="@azizkino yoki -1001234567890">
                <small>Agar kiritmasangiz, linkdan avtomatik aniqlanadi</small>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addMandatoryChannelForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        await apiRequest('/channels/mandatory', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadChannels();
        alert("Kanal qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteMandatoryChannel(id) {
  if (!confirm("Kanalni o'chirishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/channels/mandatory/${id}`, { method: 'DELETE' });
    loadChannels();
    alert("Kanal o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

function showAddDatabaseChannelModal() {
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Database kanal qo'shish</h2>
        <form id="addDatabaseChannelForm">
            <div class="form-group">
                <label>Kanal nomi</label>
                <input type="text" name="channelName" required placeholder="Masalan: Movies Database">
            </div>
            <div class="form-group">
                <label>Channel ID</label>
                <input type="text" name="channelId" required placeholder="-1001234567890">
                <small>Bot ushbu kanalda admin bo'lishi kerak</small>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addDatabaseChannelForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        await apiRequest('/channels/database', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadChannels();
        alert("Database kanal qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteDatabaseChannel(id) {
  if (!confirm("Database kanalni o'chirishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/channels/database/${id}`, { method: 'DELETE' });
    loadChannels();
    alert("Database kanal o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Movies
async function loadMovies() {
  const section = document.getElementById('movies-section');

  try {
    const movies = await apiRequest('/movies');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Kinolar ro'yxati</h2>
                    <button class="add-btn" onclick="showAddMovieModal()">+ Kino qo'shish</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Yili</th>
                            <th>Field</th>
                            <th>Ko'rishlar</th>
                            <th>Yaratilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movies
                          .map(
                            (movie) => `
                            <tr>
                                <td>${movie.id}</td>
                                <td>${movie.title}</td>
                                <td>${movie.year}</td>
                                <td>${movie.field?.name || '-'}</td>
                                <td>${movie.views || 0}</td>
                                <td>${new Date(movie.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-delete" onclick="deleteMovie(${movie.id})">
                                        🗑️ O'chirish
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

async function showAddMovieModal() {
  const fields = await apiRequest('/fields');

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Yangi kino qo'shish</h2>
        <form id="addMovieForm">
            <div class="form-group">
                <label>Kino nomi</label>
                <input type="text" name="title" required placeholder="Masalan: Avatar">
            </div>
            <div class="form-group">
                <label>Yili</label>
                <input type="number" name="year" required placeholder="2023">
            </div>
            <div class="form-group">
                <label>Field</label>
                <select name="fieldId" required>
                    <option value="">Tanlang</option>
                    ${fields.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>File ID (Telegram)</label>
                <input type="text" name="fileId" required placeholder="BAADAgADXwAD...">
            </div>
            <div class="form-group">
                <label>Tavsif (ixtiyoriy)</label>
                <textarea name="description" placeholder="Kino haqida ma'lumot"></textarea>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addMovieForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      data.fieldId = parseInt(data.fieldId);
      data.year = parseInt(data.year);

      try {
        await apiRequest('/movies', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadMovies();
        alert("Kino qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteMovie(id) {
  if (!confirm("Kinoni o'chirishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/movies/${id}`, { method: 'DELETE' });
    loadMovies();
    alert("Kino o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Serials
async function loadSerials() {
  const section = document.getElementById('serials-section');

  try {
    const serials = await apiRequest('/serials');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Seriallar ro'yxati</h2>
                    <button class="add-btn" onclick="showAddSerialModal()">+ Serial qo'shish</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Yili</th>
                            <th>Field</th>
                            <th>Qismlar</th>
                            <th>Ko'rishlar</th>
                            <th>Yaratilgan</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${serials
                          .map(
                            (serial) => `
                            <tr>
                                <td>${serial.id}</td>
                                <td>${serial.title}</td>
                                <td>${serial.year}</td>
                                <td>${serial.field?.name || '-'}</td>
                                <td>${serial._count?.episodes || 0}</td>
                                <td>${serial.views || 0}</td>
                                <td>${new Date(serial.createdAt).toLocaleDateString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-delete" onclick="deleteSerial(${serial.id})">
                                        🗑️ O'chirish
                                    </button>
                                </td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

async function showAddSerialModal() {
  const fields = await apiRequest('/fields');

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
        <h2>Yangi serial qo'shish</h2>
        <form id="addSerialForm">
            <div class="form-group">
                <label>Serial nomi</label>
                <input type="text" name="title" required placeholder="Masalan: Game of Thrones">
            </div>
            <div class="form-group">
                <label>Yili</label>
                <input type="number" name="year" required placeholder="2023">
            </div>
            <div class="form-group">
                <label>Field</label>
                <select name="fieldId" required>
                    <option value="">Tanlang</option>
                    ${fields.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Tavsif (ixtiyoriy)</label>
                <textarea name="description" placeholder="Serial haqida ma'lumot"></textarea>
            </div>
            <button type="submit" class="submit-btn">Qo'shish</button>
        </form>
    `;

  document
    .getElementById('addSerialForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      data.fieldId = parseInt(data.fieldId);
      data.year = parseInt(data.year);

      try {
        await apiRequest('/serials', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        closeModal();
        loadSerials();
        alert("Serial qo'shildi!");
      } catch (error) {
        alert('Xatolik: ' + error.message);
      }
    });

  showModal();
}

async function deleteSerial(id) {
  if (!confirm("Serialni o'chirishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/serials/${id}`, { method: 'DELETE' });
    loadSerials();
    alert("Serial o'chirildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Payments
async function loadPayments() {
  const section = document.getElementById('payments-section');

  try {
    const payments = await apiRequest('/payments/pending');

    section.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <h2>Kutilayotgan to'lovlar</h2>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Foydalanuvchi</th>
                            <th>Summa</th>
                            <th>Turi</th>
                            <th>Yuborilgan vaqt</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                          payments.length === 0
                            ? `
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 40px;">
                                    Kutilayotgan to'lovlar yo'q
                                </td>
                            </tr>
                        `
                            : payments
                                .map(
                                  (payment) => `
                            <tr>
                                <td>${payment.id}</td>
                                <td>@${payment.user?.username || payment.user?.telegramId}</td>
                                <td>${payment.amount.toLocaleString()} UZS</td>
                                <td><span class="badge badge-info">${payment.paymentType}</span></td>
                                <td>${new Date(payment.createdAt).toLocaleString('uz-UZ')}</td>
                                <td>
                                    <button class="action-btn btn-approve" onclick="approvePayment(${payment.id})">
                                        ✅ Tasdiqlash
                                    </button>
                                    <button class="action-btn btn-reject" onclick="rejectPayment(${payment.id})">
                                        ❌ Rad etish
                                    </button>
                                </td>
                            </tr>
                        `,
                                )
                                .join('')
                        }
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    section.innerHTML = `<div class="loading">Xatolik: ${error.message}</div>`;
  }
}

async function approvePayment(id) {
  if (!confirm("To'lovni tasdiqlashga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/payments/${id}/approve`, { method: 'PUT' });
    loadPayments();
    alert("To'lov tasdiqlandi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

async function rejectPayment(id) {
  if (!confirm("To'lovni rad etishga ishonchingiz komilmi?")) return;

  try {
    await apiRequest(`/payments/${id}/reject`, { method: 'PUT' });
    loadPayments();
    alert("To'lov rad etildi!");
  } catch (error) {
    alert('Xatolik: ' + error.message);
  }
}

// Modal Management
function showModal() {
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// Logout
function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_data');
  window.location.href = '/admin/index.html';
}
