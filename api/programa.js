// api/programa.js
// Función serverless — lee cualquier tablero de Monday y devuelve JSON normalizado
// El token vive en Vercel Environment Variables, nunca en el código

export default async function handler(req, res) {
  // CORS: permite que la app del estudiante llame a esta función
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const boardId = req.query.id;
  if (!boardId) {
    return res.status(400).json({ error: 'Falta el parámetro ?id=BOARD_ID' });
  }

  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token de Monday no configurado en Vercel' });
  }

  // Query GraphQL que trae el board completo con todos sus ítems y columnas
  const query = `
    query GetBoard($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        description
        items_page(limit: 100) {
          items {
            id
            name
            column_values {
              id
              text
              value
              column {
                title
                type
              }
            }
          }
        }
      }
    }
  `;

  try {
    const mondayRes = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({
        query,
        variables: { boardId: [boardId] }
      })
    });

    if (!mondayRes.ok) {
      throw new Error(`Monday API respondió ${mondayRes.status}`);
    }

    const data = await mondayRes.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'Error en Monday API');
    }

    const board = data?.data?.boards?.[0];
    if (!board) {
      return res.status(404).json({ error: `Tablero ${boardId} no encontrado` });
    }

    // Normalizar: convertir los ítems de Monday al formato que usa la app
    const sesiones = board.items_page.items
      .filter(item => item.name && item.name.toLowerCase().includes('clase'))
      .map(item => normalizeItem(item))
      .filter(Boolean)
      .sort((a, b) => a.numero - b.numero);

    return res.status(200).json({
      programa: board.name,
      descripcion: board.description || '',
      totalSesiones: sesiones.length,
      sesiones
    });

  } catch (err) {
    console.error('Error llamando a Monday:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── NORMALIZACIÓN ──────────────────────────────────────────────────────────────
// Convierte un ítem de Monday al objeto que necesita la app.
// Mapea por el TÍTULO de columna (column.title), no por el ID interno,
// así si reorganizas columnas en Monday sigue funcionando.

function normalizeItem(item) {
  // Construir mapa título → valor
  const cols = {};
  for (const col of item.column_values) {
    const title = col.column?.title?.toLowerCase().trim() || '';
    cols[title] = {
      text: col.text || '',
      value: col.value ? safeJson(col.value) : null
    };
  }

  // Extraer número de sesión del nombre ("Clase 3 - ..." → 3)
  const numMatch = item.name.match(/\d+/);
  const numero = numMatch ? parseInt(numMatch[0]) : 999;

  // Fecha: busca columna que contenga "fecha" y "clase"
  const fechaKey = findKey(cols, ['fecha de la clase', 'fecha clase', 'fecha']);
  const fechaRaw = cols[fechaKey]?.value?.date || cols[fechaKey]?.text || '';
  const fecha = fechaRaw ? parseDate(fechaRaw) : null;

  // Horarios por país
  const horaCL_start  = findText(cols, ['hora inicio de la clase', 'hora inicio cl', 'hora inicio']);
  const horaCL_end    = findText(cols, ['hora término de la clase', 'hora término cl', 'hora termino']);
  const horaMX_start  = findText(cols, ['hora inicio de la clase mx', 'hora inicio mx']);
  const horaMX_end    = findText(cols, ['hora de término de la clase mx', 'hora término mx', 'hora termino mx']);
  const horaCO_start  = findText(cols, ['hora inicio de la clase co', 'hora inicio co']);
  const horaCO_end    = findText(cols, ['hora de término de la clase co', 'hora término co', 'hora termino co']);

  // Módulo
  const moduloKey = findKey(cols, ['módulo', 'modulo']);
  const moduloRaw = cols[moduloKey]?.text || '';
  const moduloNum = parseInt(moduloRaw.replace(/\D/g, '')) || 1;
  const moduloNombre = findText(cols, ['nombre clase', 'nombre de la clase', 'titulo', 'título']);

  // Docentes
  const docenteKey = findKey(cols, ['docente(s)', 'docentes (llenar)', 'docentes', 'docente']);
  const docentesRaw = cols[docenteKey]?.text || '';
  const docentes = docentesRaw
    .split(/[,;]/)
    .map(d => d.trim())
    .filter(Boolean);

  // Contenido
  const contenidoKey = findKey(cols, ['contenido de la clase', 'contenido', 'contenidos']);
  const contenidoRaw = cols[contenidoKey]?.text || '';
  const contenidos = contenidoRaw
    .split(/[-•\n]/)
    .map(c => c.replace(/^[\s-]+/, '').trim())
    .filter(c => c.length > 3);

  // Evaluación
  const evalKey     = findKey(cols, ['aplica evaluación (completar primero que la fecha de apertura)', 'aplica evaluación', 'evaluacion', 'evaluación']);
  const evalAplica  = cols[evalKey]?.text?.toLowerCase() !== 'no aplica' &&
                      cols[evalKey]?.text?.toLowerCase() !== '' &&
                      cols[evalKey]?.text !== null;
  const evalOpenKey = findKey(cols, ['fecha apertura evaluación', 'fecha apertura evaluacion', 'fecha apertura']);
  const evalCloseKey= findKey(cols, ['fecha cierre evaluación', 'fecha cierre evaluacion', 'fecha cierre']);
  const evalOpen    = cols[evalOpenKey]?.value?.date  || cols[evalOpenKey]?.text  || null;
  const evalClose   = cols[evalCloseKey]?.value?.date || cols[evalCloseKey]?.text || null;

  // Zoom
  const zoomKey = findKey(cols, ['link zoom', 'zoom', 'enlace zoom']);
  const zoom    = cols[zoomKey]?.text || '';
  const idKey   = findKey(cols, ['id reunión', 'id reunion', 'id reunión zoom']);
  const zoomId  = cols[idKey]?.text || '';

  return {
    id: item.id,
    numero,
    nombre: item.name,
    titulo: moduloNombre || item.name,
    modulo: { numero: moduloNum, nombre: moduloNombre || `Módulo ${moduloNum}` },
    fecha,        // ISO string YYYY-MM-DD o null
    horarios: {
      CL: { inicio: horaCL_start || '18:00', fin: horaCL_end || '22:00' },
      MX: { inicio: horaMX_start || '16:00', fin: horaMX_end || '20:00' },
      CO: { inicio: horaCO_start || '17:00', fin: horaCO_end || '21:00' }
    },
    docentes,
    contenidos,
    evaluacion: {
      aplica: evalAplica,
      apertura: evalOpen,
      cierre:   evalClose
    },
    zoom: { url: zoom, id: zoomId }
  };
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

function findKey(cols, candidates) {
  for (const c of candidates) {
    if (cols[c] !== undefined) return c;
  }
  // fuzzy: busca si alguna clave contiene el primer candidato
  const first = candidates[0];
  return Object.keys(cols).find(k => k.includes(first.split(' ')[0])) || candidates[0];
}

function findText(cols, candidates) {
  const key = findKey(cols, candidates);
  return cols[key]?.text || '';
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

function parseDate(raw) {
  // Monday devuelve "YYYY-MM-DD" en date columns, o texto libre
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Intenta parsear número serial de Excel si viene como texto
  const num = parseFloat(raw);
  if (!isNaN(num) && num > 40000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  return raw || null;
}
