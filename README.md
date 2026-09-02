# ⚡ VELOCITY | ISP Operations Suite (v2.1)

Sistema integral de gestión técnica, supervisión de órdenes, diagnóstico TR-069 y búsqueda instantánea de inventario para Proveedores de Servicios de Internet (ISP) integrado con **Wispro Cloud API** y **GenieACS**.

---

## 🏛️ Arquitectura Desacoplada y Moderna

El proyecto ha sido refactorizado desde una estructura monolítica a una arquitectura desacoplada, modular y estrictamente tipada en **TypeScript**:

```
velocity/
├── backend/                  # API REST en Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/      # authController, syncController, wisproProxyController, inventoryController
│   │   ├── services/         # DbService, AuthService, SyncService, WisproService, ReportService
│   │   ├── middlewares/      # authMiddleware (JWT), rateLimitMiddleware, errorMiddleware
│   │   ├── routes/           # authRoutes, syncRoutes, wisproRoutes, inventoryRoutes, index.ts
│   │   ├── types/            # Tipos de DB, Sesión, Sincronización e Inventario
│   │   ├── app.ts            # Configuración de Express, CORS y Helmet
│   │   └── server.ts         # Entrypoint del servidor y tareas programadas
│   ├── Dockerfile            # Imagen de producción multi-stage
│   ├── package.json
│   └── tsconfig.json         # TypeScript estricto (noImplicitAny: true)
│
├── frontend/                 # Cliente React 18 + Vite + Tailwind CSS + TypeScript
│   ├── src/
│   │   ├── components/       # InventorySearch (0ms Fuse.js), Navigation, SystemOverview, AuthModal
│   │   ├── hooks/            # useInventorySearch, useAuth
│   │   ├── types/            # Tipos de cliente, inventario y autenticación
│   │   ├── App.tsx           # Layout principal y navegación por pestañas
│   │   ├── main.tsx          # Entrypoint React
│   │   └── index.css         # Directivas Tailwind y estilos de diseño
│   ├── Dockerfile            # Imagen multi-stage con Nginx reverse proxy
│   ├── nginx.conf            # Configuración de servidor web y proxy para /api/
│   ├── package.json
│   ├── tailwind.config.js    # Paleta de colores Dark Mode profesional
│   ├── tsconfig.json
│   └── vite.config.ts        # Configuración de Vite con proxy para desarrollo
│
├── data/                     # Persistencia de base de datos local (db.json)
├── docker-compose.yml        # Orquestación de producción (Backend + Frontend + GenieACS)
└── .github/workflows/        # CI/CD automatizado con GitHub Actions y SSH Deploy
```

---

## 🚀 Puesta en Marcha Local

### 1. Requisitos Previos
- Node.js >= 18.0.0
- Docker y Docker Compose (opcional para ejecución en contenedores)

### 2. Configuración de Variables de Entorno
Copia o edita el archivo `.env` en la raíz del proyecto:

```env
PORT=3000
WISPRO_API_URL=https://www.cloud.wispro.co/api/v1
WISPRO_API_TOKEN=tu-token-de-wispro-aqui
JWT_SECRET=tu-clave-secreta-jwt-2026
API_SECRET=velocidad-secreta-2024
```

### 3. Desarrollo Local (Hot Reloading)

#### Opción A: Levantar Backend y Frontend por separado

**Backend (API en `http://localhost:3000`):**
```bash
cd backend
npm install
npm run dev
```

**Frontend (React en `http://localhost:5173`):**
```bash
cd frontend
npm install
npm run dev
```

#### Opción B: Comandos desde la raíz
```bash
# Instalar dependencias
npm --prefix backend install
npm --prefix frontend install

# Iniciar servicios
npm run dev:backend
npm run dev:frontend
```

---

## 🐳 Despliegue con Docker Compose

Para levantar todo el ecosistema en tu servidor VPS de producción con un solo comando:

```bash
docker compose up -d --build
```

Esto desplegará de forma orquestada:
- **`velocity-frontend`**: Servidor Nginx en el puerto `80` sirviendo la SPA de React y redirigiendo `/api/` internamente.
- **`velocity-backend`**: API REST en Node.js + Express en el puerto `3000` con persistencia en el volumen `./data`.
- **`genieacs-cwmp`**: Servidor TR-069 CWMP en el puerto `7547`.
- **`genieacs-nbi`**: API Northbound Interface en el puerto `7557`.
- **`genieacs-ui`**: Panel de control GenieACS en el puerto `3001`.
- **`genieacs-mongo`** & **`genieacs-redis`**: Bases de datos dedicadas para ACS.

---

## 🔍 Características Principales

1. **Búsqueda Instantánea de Inventario (0ms)**:
   - Motor de búsqueda difusa (*fuzzy search*) en cliente con `Fuse.js` (`threshold: 0.3`).
   - Carga inicial en segundo plano desde el backend con paginación asíncrona inteligente sobre miles de registros.
   - Caché en memoria RAM con TTL de 5 minutos en el backend.
2. **Autenticación Segura & JWT**:
   - Contraseñas protegidas mediante hash `bcryptjs`.
   - Generación y verificación de tokens `jsonwebtoken` para supervisores y técnicos.
3. **Persistencia Atómica & Nube**:
   - Escrituras atómicas con `write-file-atomic` para evitar corrupción de archivos en apagados intempestivos.
   - Sincronización bidireccional automática con Google Drive / Google Sheets.
4. **CI/CD Totalmente Automatizado**:
   - Verificación de tipos TypeScript estricta y build de Docker en cada push a `main`.
   - Despliegue continuo por SSH a tu servidor VPS mediante GitHub Actions.
