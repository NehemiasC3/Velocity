# 📦 Módulo de Inventario & Búsqueda Instantánea ISP (Wispro API)

Módulo de nivel de producción de inventario y búsqueda difusa (fuzzy search) con 0ms de latencia para ISP integrado con la API de Wispro Cloud, desarrollado en **TypeScript**, **Node.js (Express)**, **React 18**, **Tailwind CSS** y **Fuse.js**.

---

## 🏛️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                       REACT FRONTEND                        │
│                                                             │
│   useInventorySearch (Hook) ──> Fuse.js (useMemo Index)    │
│            │                                  │             │
│   (Fetch Inicial 1 sola vez)             (0ms Query)        │
│            ▼                                  ▼             │
│    /api/v1/inventory               UI Tabla & Badges Status │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP GET
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND (TS)                      │
│                                                             │
│  InventoryController ──> In-Memory Cache (TTL: 5 min)       │
│                               │                             │
│                         (Cache Miss)                        │
│                               ▼                             │
│                     WisproService (Class)                   │
│                               │                             │
│          Paginación Dinámica (while per_page=100)           │
│                               │                             │
│                   Mapeo y Saneamiento de Datos              │
└───────────────────────────────┬─────────────────────────────┘
                                │ Axios HTTPS
                                ▼
                 ┌─────────────────────────────┐
                 │    WISPRO CLOUD REST API    │
                 │   https://www.cloud.wispro  │
                 └─────────────────────────────┘
```

---

## 📁 Estructura del Código

```
Velocity/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── inventoryController.ts   # Controlador Express para GET /api/v1/inventory
│   │   ├── routes/
│   │   │   └── inventoryRoutes.ts       # Router Express modular
│   │   ├── services/
│   │   │   └── WisproService.ts         # Paginador dinámico, caché TTL 5m y mapeador
│   │   ├── types/
│   │   │   ├── inventory.ts             # Interface de InventoryItem y respuesta
│   │   │   └── wispro.ts                # Modelos de API cruda de Wispro y paginación
│   │   ├── app.ts                       # Configuración de Express con CORS y Middlewares
│   │   └── server.ts                    # Entrypoint y graceful shutdown
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── InventorySearch.tsx      # Componente UI React + Tailwind (Dark Theme)
│   │   ├── hooks/
│   │   │   └── useInventorySearch.ts    # Custom Hook con Fuse.js y useMemo
│   │   ├── types/
│   │   │   └── inventory.ts             # Tipos compartidos en Frontend
│   │   ├── App.tsx                      # Layout y Header de navegación
│   │   ├── main.tsx                     # Entrypoint React
│   │   └── index.css                    # Directivas Tailwind y estilos de scrollbar
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── server.js                            # Soporte integrado en el backend existente
```

---

## 🚀 Puesta en Marcha y Validación

### 1. Requisitos Previos
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Configuración de Variables de Entorno
Crea o actualiza tu archivo `.env` en la raíz o en `backend/.env`:

```env
PORT=3000
WISPRO_API_URL=https://www.cloud.wispro.co/api/v1
WISPRO_API_TOKEN=tu_api_token_de_wispro_aqui
```

---

### 3. Backend (TypeScript / Express)

#### Instalación:
```bash
cd backend
npm install
```

#### Verificación de Tipos TypeScript (`noImplicitAny` estricto):
```bash
npm run typecheck
```

#### Compilación de Producción:
```bash
npm run build
```

#### Ejecución en Desarrollo:
```bash
npm run dev
```

#### Ejecución en Producción:
```bash
npm start
```

---

### 4. Frontend (React / Vite / Tailwind / Fuse.js)

#### Instalación:
```bash
cd frontend
npm install
```

#### Verificación de Tipos TypeScript:
```bash
npm run typecheck
```

#### Ejecución en Desarrollo (Vite HMR):
```bash
npm run dev
```
Abre en tu navegador: `http://localhost:5173`

#### Compilación de Producción:
```bash
npm run build
```

---

## 🔍 Características Técnicas Clave

1. **Paginación Asíncrona Resiliente**:
   - `WisproService` inicia consultando la página 1 (`per_page=100`) para leer `meta.pagination.total_pages`.
   - Ejecuta un bucle dinámico por lotes (`BATCH_SIZE = 5`) para descargar hasta ~6,000 registros en segundos sin bloquear el Event Loop ni saturar los límites de peticiones de Wispro.

2. **Caché en Memoria con TTL (5 minutos)**:
   - Almacena el dataset saneado en memoria RAM.
   - Si una petición entrante ocurre mientras hay otra sincronización en progreso, reutiliza la misma promesa (`Thundering Herd prevention`).
   - Endpoint manual de purga: `POST /api/v1/inventory/cache/clear` o flag query `GET /api/v1/inventory?force=true`.

3. **Mapeo Limpio de Datos**:
   - Transforma respuestas complejas/nulas a la estructura requerida:
     ```typescript
     {
       id: string;
       client_name: string;
       ip: string;
       mac: string;
       serial_number: string;
       model: string;
       status: 'active' | 'disabled' | 'pending' | 'suspended' | 'unknown';
       address: string;
     }
     ```

4. **Búsqueda Difusa Instantánea en Cliente con Fuse.js**:
   - Carga el catálogo una sola vez en el montaje del componente (`useEffect`).
   - Inicializa el índice de Fuse.js dentro de `useMemo`.
   - Búsqueda tolerante a erratas (`threshold: 0.3`) sobre `client_name`, `ip`, `mac`, `serial_number` y `model`.
   - **Latencia: 0ms** al escribir en el campo de búsqueda.

5. **UI Profesional Dark Mode**:
   - Diseñado con Tailwind CSS, paleta de colores slate/indigo/emerald.
   - Badges contextuales de estado con microanimaciones de pulso para dispositivos activos.
   - Tipografía monospaciada (`font-mono`) para IPs, MACs y Números de Serie con botones de copiado rápido al portapapeles.
   - Paginación fluida en tabla y atajos de teclado (`Ctrl + K` / `Cmd + K` para buscar).
