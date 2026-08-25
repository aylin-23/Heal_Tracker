# Heal Tracker — maqueta con backend local

Esta es la misma app de antes, pero ahora conectada a un backend real que
corre en tu computadora, para que las cuentas, citas, medicamentos y agua
se guarden de verdad (en un archivo, no en la memoria del navegador).

## Cómo correrla

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o más
reciente). Luego:

1. Abre una terminal en esta carpeta (`heal-tracker-backend`).
2. Si es la primera vez, o si borraste la carpeta `node_modules`, instala las
   dependencias:
   ```
   npm install
   ```
   (Ya vienen incluidas en este paquete, así que este paso normalmente no es
   necesario.)
3. Enciende el servidor:
   ```
   npm start
   ```
4. Abre tu navegador en **http://localhost:3000**

Para apagar el servidor, vuelve a la terminal y presiona `Ctrl + C`.

## Cuenta de prueba

- Correo: `demo@healtracker.mx`
- Contraseña: `demo1234`

Ya tiene una cita pasada, una próxima y un medicamento cargados para que
veas cómo se ve la app con información real.

## ¿Dónde se guardan los datos?

En el archivo `data/db.json`, que se crea automáticamente la primera vez
que enciendes el servidor. Puedes abrirlo con cualquier editor de texto
para ver exactamente qué se está guardando — es solo un archivo de texto,
nada oculto. Si borras ese archivo, la app vuelve a empezar de cero (y se
vuelve a crear la cuenta de prueba).

**Nota:** esto es una maqueta pensada para correr en tu propia máquina.
No tiene HTTPS ni las protecciones de seguridad que necesitarías para
publicarla en internet con datos médicos reales — para eso se necesitaría
una base de datos de verdad (Postgres, por ejemplo), cifrado en tránsito
(HTTPS) y un servidor con copias de seguridad. La forma del código ya está
pensada para que ese cambio, más adelante, sea sencillo: solo se
reemplazaría el contenido de `db.js`, sin tocar `server.js` ni el
frontend.

## Estructura del proyecto

```
heal-tracker-backend/
├── server.js        → define las rutas de la API (login, citas, agua, etc.)
├── db.js            → guarda y lee la información (hoy: un archivo JSON)
├── data/db.json      → aquí viven los datos (se crea solo)
├── public/
│   └── index.html   → toda la interfaz (HTML + CSS + JS del navegador)
└── package.json
```

## Endpoints de la API (por si quieres probarlos o conectarlos a otra cosa)

| Método | Ruta                       | Qué hace                                  |
|--------|----------------------------|--------------------------------------------|
| POST   | /api/auth/register         | Crea una cuenta nueva                      |
| POST   | /api/auth/login            | Inicia sesión, devuelve un token           |
| POST   | /api/auth/logout           | Cierra sesión                              |
| GET    | /api/me                    | Devuelve los datos del usuario actual      |
| PUT    | /api/me                    | Actualiza el perfil                        |
| POST   | /api/appointments          | Agenda una cita                            |
| POST   | /api/meds                  | Añade un medicamento                       |
| PATCH  | /api/meds/:id/taken        | Marca un medicamento como tomado           |
| POST   | /api/water/add             | Suma un vaso de agua                       |
| PUT    | /api/water/interval        | Cambia cada cuánto se recuerda tomar agua  |

Todas las rutas (menos registro y login) requieren mandar el token así:
`Authorization: Bearer TU_TOKEN`.
