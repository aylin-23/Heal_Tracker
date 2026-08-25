/**
 * server.js — Backend local (maqueta) de Heal Tracker.
 *
 * Cómo correrlo:
 *   1) npm install
 *   2) npm start
 *   3) Abre http://localhost:3000 en tu navegador
 *
 * Toda la información se guarda en data/db.json, junto a este archivo.
 */

const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- Middleware de autenticación ---------------- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No has iniciado sesión.' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Tu sesión expiró, inicia sesión de nuevo.' });
  req.user = user;
  next();
}

function publicUser(user) {
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

/* ================= AUTENTICACIÓN ================= */

app.post('/api/auth/register', (req, res) => {
  try {
    const { fullName, phone, email, password, nss, bloodType, allergies, history, emergency } = req.body;

    if (!fullName || !phone || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, teléfono, correo o contraseña).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    if (!emergency || !emergency.name || !emergency.phone) {
      return res.status(400).json({ error: 'Falta la información del contacto de emergencia.' });
    }

    const user = db.createUser({ fullName, phone, email, password, nss, bloodType, allergies, history, emergency });
    res.status(201).json({ token: user.token, user: publicUser(user) });
  } catch (e) {
    if (e.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.' });
    }
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Escribe tu correo y contraseña.' });
  }
  const user = db.getUserByEmail(email);
  if (!user || !db.verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  db.getWaterResetIfNeeded(user.id);
  const fresh = db.getUserById(user.id);
  res.json({ token: fresh.token, user: publicUser(fresh) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.regenerateToken(req.user.id);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  db.getWaterResetIfNeeded(req.user.id);
  const fresh = db.getUserById(req.user.id);
  res.json({ user: publicUser(fresh) });
});

app.put('/api/me', requireAuth, (req, res) => {
  const { fullName, phone, nss, bloodType, allergies, history, emergency } = req.body;
  if (!fullName || !phone) {
    return res.status(400).json({ error: 'El nombre y el teléfono son obligatorios.' });
  }
  const updated = db.updateUser(req.user.id, { fullName, phone, nss, bloodType, allergies, history, emergency });
  res.json({ user: publicUser(updated) });
});

/* ================= CITAS MÉDICAS ================= */

app.post('/api/appointments', requireAuth, (req, res) => {
  const { specialty, doctor, date, time, place, notes } = req.body;
  if (!specialty || !date || !time) {
    return res.status(400).json({ error: 'La especialidad, fecha y hora son obligatorias.' });
  }
  const appt = db.addAppointment(req.user.id, { specialty, doctor, date, time, place, notes });
  res.status(201).json({ appointment: appt });
});

app.delete('/api/appointments/:id', requireAuth, (req, res) => {
  const success = db.deleteAppointment(req.user.id, req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Cita no encontrada o no autorizada para eliminar.' });
  }
  res.json({ ok: true, message: 'Cita eliminada correctamente.' });
});

/* ================= MEDICAMENTOS ================= */

app.post('/api/meds', requireAuth, (req, res) => {
  const { name, dose, time, frequency } = req.body;
  if (!name || !time) {
    return res.status(400).json({ error: 'El nombre del medicamento y la hora son obligatorios.' });
  }
  const med = db.addMedication(req.user.id, { name, dose, time, frequency });
  res.status(201).json({ medication: med });
});

app.patch('/api/meds/:id/taken', requireAuth, (req, res) => {
  const med = db.markMedTaken(req.user.id, req.params.id, req.body.taken);
  if (!med) return res.status(404).json({ error: 'Medicamento no encontrado.' });
  res.json({ medication: med });
});

app.delete('/api/meds/:id', requireAuth, (req, res) => {
  const success = db.deleteMedication(req.user.id, req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Medicamento no encontrado o no autorizado para eliminar.' });
  }
  res.json({ ok: true, message: 'Medicamento eliminado correctamente.' });
});

/* ================= HIDRATACIÓN ================= */

app.post('/api/water/add', requireAuth, (req, res) => {
  db.getWaterResetIfNeeded(req.user.id);
  const water = db.addWaterGlass(req.user.id);
  res.json({ water });
});

app.put('/api/water/interval', requireAuth, (req, res) => {
  const minutes = parseInt(req.body.minutes, 10);
  if (!minutes || minutes < 5) return res.status(400).json({ error: 'Intervalo inválido.' });
  const water = db.setWaterInterval(req.user.id, minutes);
  res.json({ water });
});

/* ---------------- Datos de ejemplo ---------------- */
function seedDemoUserIfEmpty() {
  if (db.getUserByEmail('demo@healtracker.mx')) return;
  const demo = db.createUser({
    fullName: 'Ana Torres',
    phone: '55 1122 3344',
    email: 'demo@healtracker.mx',
    password: 'demo1234',
    nss: '',
    bloodType: 'O+',
    allergies: 'Penicilina',
    history: 'Hipertensión controlada',
    emergency: { name: 'Luis Torres', relation: 'Esposo', phone: '55 9988 7766' }
  });
  db.addAppointment(demo.id, { specialty: 'Medicina general', doctor: 'Dr. Ibarra', date: '2026-07-02', time: '10:00', place: 'Clínica Vida Sana', notes: 'Chequeo anual' });
  db.addAppointment(demo.id, { specialty: 'Dentista', doctor: 'Dra. Campos', date: '2026-09-10', time: '16:30', place: 'Consultorio Dental Sonrisas', notes: '' });
  db.addMedication(demo.id, { name: 'Losartán 50mg', dose: '1 tableta', time: '08:00', frequency: 'daily' });
}
seedDemoUserIfEmpty();

app.listen(PORT, () => {
  console.log('');
  console.log('  Heal Tracker (backend local) corriendo en:');
  console.log('  http://localhost:' + PORT);
  console.log('');
});