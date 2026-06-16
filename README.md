# ADIPA · App de Planificación de Clases

Sistema dinámico que lee cualquier tablero de Monday.com y genera
una URL de planificación para estudiantes, sin tocar código.

---

## Estructura del proyecto

```
adipa-app/
├── api/
│   └── programa.js      ← Función serverless (lee Monday, devuelve JSON)
├── public/
│   └── index.html       ← App del estudiante (consume la API)
├── vercel.json          ← Configuración de rutas en Vercel
└── README.md
```

---

## Despliegue en Vercel (10 minutos)

### 1. Sube el código a GitHub

1. Ve a https://github.com/new y crea un repositorio llamado `adipa-app`
2. En tu computador, abre la terminal en la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/adipa-app.git
git push -u origin main
```

### 2. Conecta Vercel con GitHub

1. Ve a https://vercel.com → Sign up con tu cuenta de GitHub (gratis)
2. Clic en **Add New Project**
3. Importa el repositorio `adipa-app`
4. En la pantalla de configuración, **no cambies nada**, solo clic en **Deploy**

### 3. Agrega el token de Monday (paso crítico)

1. En tu proyecto de Vercel → **Settings** → **Environment Variables**
2. Agrega esta variable:
   - **Name:** `MONDAY_API_TOKEN`
   - **Value:** tu token de Monday (perfil → Developer → My Access Tokens)
   - **Environment:** Production, Preview y Development
3. Clic en **Save**
4. Ve a **Deployments** → clic en los tres puntos del último deploy → **Redeploy**

### 4. ¡Listo! Tu URL base está funcionando

Vercel te da una URL como `adipa-app.vercel.app`.

---

## URLs por programa

Cada programa se accede con su board_id de Monday:

```
https://adipa-app.vercel.app/?id=18396859731   ← Trauma Psicológico
https://adipa-app.vercel.app/?id=OTRO_BOARD_ID ← Cualquier otro programa
```

El board_id está en la URL de Monday cuando abres el tablero:
`https://adipa.monday.com/boards/18396859731`
                                  ↑ ese número

### Para crear un nuevo programa:
1. Crea un tablero en Monday usando la plantilla estándar (ver abajo)
2. Copia el board_id de la URL
3. Comparte el enlace `?id=BOARD_ID` a los estudiantes

**No necesitas tocar código ni redesplegar.**

---

## Plantilla de tablero Monday

Para que la API funcione correctamente, cada tablero debe tener
estas columnas (con estos nombres exactos):

| Columna                          | Tipo      | Ejemplo                        |
|----------------------------------|-----------|--------------------------------|
| Name                             | Texto     | Clase 1 - Nombre del programa  |
| Fecha de la Clase                | Fecha     | 2026-05-05                     |
| Nombre Clase                     | Texto     | Aspectos psicológicos del trauma|
| Módulo                           | Texto     | Módulo 1                       |
| Contenido de la Clase            | Texto largo| - Punto 1\n- Punto 2          |
| Docentes (LLENAR)                | Texto     | Dr. Juan Pérez, Ps. María López|
| Hora Inicio de la Clase          | Hora      | 18:00                          |
| Hora Término de la Clase         | Hora      | 22:00                          |
| Hora Inicio de la Clase MX       | Hora      | 16:00                          |
| Hora de Término de la Clase MX   | Hora      | 20:00                          |
| Hora Inicio de la Clase CO       | Hora      | 17:00                          |
| Hora de Término de la Clase CO   | Hora      | 21:00                          |
| Aplica evaluación                | Texto     | Sí / No Aplica                 |
| Fecha Apertura Evaluación        | Fecha     | 2026-05-15                     |
| Fecha Cierre Evaluación          | Fecha     | 2026-06-15                     |
| Link Zoom                        | Texto     | https://zoom.us/j/...          |
| ID Reunión                       | Texto     | 844 2612 8595                  |

💡 Tip: duplica el tablero de Trauma en Monday y edita los datos.
   Así ya tienes la estructura correcta.

---

## Dominio propio (opcional)

Si quieres usar `clases.adipa.cl` en vez de `adipa-app.vercel.app`:

1. En Vercel → proyecto → **Settings** → **Domains**
2. Agrega `clases.adipa.cl`
3. En tu DNS (donde manejes adipa.cl), agrega un registro CNAME:
   - Host: `clases`
   - Value: `cname.vercel-dns.com`

---

## API directa (para integraciones futuras)

La función también es consumible directamente:

```
GET https://adipa-app.vercel.app/api/programa?id=18396859731
```

Devuelve JSON con toda la planificación normalizada.
Útil para conectar con otros sistemas, apps móviles, etc.
