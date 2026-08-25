/**
 * db.js — "Base de datos" muy simple para la maqueta local de Heal Tracker.
 *
 * Guarda todo en un archivo JSON (data/db.json) en disco.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('El archivo db.json está corrupto, se reinicia vacío.', e);
    return { users: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- Contraseñas ---------------- */
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

/* ---------------- Usuarios ---------------- */
function getUserByEmail(email) {
  const db = readDB();
  return db.users.find(u => u.email === email.toLowerCase().trim()) || null;
}

function getUserById(id) {
  const db = readDB();
  return db.users.find(u => u.id === id) || null;
}

function getUserByToken(token) {
  const db = readDB();
  return db.users.find(u => u.token === token) || null;
}

function createUser(payload) {
  const db = readDB();
  const email = payload.email.toLowerCase().trim();
  if (db.users.some(u => u.email === email)) {
    throw new Error('EMAIL_EXISTS');
  }
  const { salt, hash } = hashPassword(payload.password);
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordSalt: salt,
    passwordHash: hash,
    token: crypto.randomBytes(24).toString('hex'),
    fullName: payload.fullName,
    phone: payload.phone,
    nss: payload.nss || '',
    bloodType: payload.bloodType || 'No lo sé',
    allergies: payload.allergies || 'Ninguna registrada',
    history: payload.history || 'Ninguno registrado',
    emergency: payload.emergency || { name: '', relation: '', phone: '' },
    appointments: [],
    meds: [],
    water: { count: 0, goal: 8, intervalMinutes: 60, lastReset: todayISO() },
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDB(db);
  return user;
}

function updateUser(id, changes) {
  const db = readDB();
  const user = db.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, changes);
  saveDB(db);
  return user;
}

function regenerateToken(id) {
  const db = readDB();
  const user = db.users.find(u => u.id === id);
  if (!user) return null;
  user.token = crypto.randomBytes(24).toString('hex');
  saveDB(db);
  return user.token;
}

/* ---------------- Citas médicas ---------------- */
function addAppointment(userId, appt) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  const isPast = new Date(appt.date + 'T' + appt.time) < new Date();
  const record = {
    id: crypto.randomUUID(),
    specialty: appt.specialty,
    doctor: appt.doctor || '',
    date: appt.date,
    time: appt.time,
    place: appt.place || '',
    notes: appt.notes || '',
    status: isPast ? 'past' : 'upcoming'
  };
  user.appointments.push(record);
  saveDB(db);
  return record;
}

function deleteAppointment(userId, apptId) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return false;

  const initialLength = user.appointments.length;
  user.appointments = user.appointments.filter(a => a.id !== apptId);

  if (user.appointments.length === initialLength) {
    return false;
  }

  saveDB(db);
  return true;
}

/* ---------------- Medicamentos ---------------- */
function addMedication(userId, med) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  const record = {
    id: crypto.randomUUID(),
    name: med.name,
    dose: med.dose || '',
    time: med.time,
    frequency: med.frequency || 'daily',
    takenToday: false
  };
  user.meds.push(record);
  saveDB(db);
  return record;
}

function markMedTaken(userId, medId, taken) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  const med = user.meds.find(m => m.id === medId);
  if (!med) return null;
  med.takenToday = !!taken;
  saveDB(db);
  return med;
}

function deleteMedication(userId, medId) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return false;

  const initialLength = user.meds.length;
  user.meds = user.meds.filter(m => m.id !== medId);

  if (user.meds.length === initialLength) {
    return false;
  }

  saveDB(db);
  return true;
}

/* ---------------- Hidratación ---------------- */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function getWaterResetIfNeeded(userId) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  if (user.water.lastReset !== todayISO()) {
    user.water.count = 0;
    user.water.lastReset = todayISO();
    user.meds.forEach(m => { m.takenToday = false; });
    saveDB(db);
  }
  return user.water;
}

function addWaterGlass(userId) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  if (user.water.count < user.water.goal) user.water.count++;
  saveDB(db);
  return user.water;
}

function setWaterInterval(userId, minutes) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  user.water.intervalMinutes = minutes;
  saveDB(db);
  return user.water;
}

module.exports = {
  getUserByEmail,
  getUserById,
  getUserByToken,
  createUser,
  updateUser,
  regenerateToken,
  verifyPassword,
  addAppointment,
  deleteAppointment,
  addMedication,
  deleteMedication,
  markMedTaken,
  getWaterResetIfNeeded,
  addWaterGlass,
  setWaterInterval
};