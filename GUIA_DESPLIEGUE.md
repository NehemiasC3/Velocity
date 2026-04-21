# 📂 Guía de Despliegue - Velocity v2.0 (Linux)

Esta guía es para el administrador de sistemas encargado de alojar **Velocity** en el servidor local de la empresa.

## 🚀 Requisitos del Servidor
- **Node.js** (v18.0.0 o superior)
- **NPM** (incluido con Node.js)
- Acceso a internet (para hablar con la API de Wispro)

## 🛠️ Instalación Paso a Paso

1. **Preparar el entorno**:
   Asegúrate de copiar todos los archivos del proyecto al servidor.
   ```bash
   cd /ruta/hacia/velocity
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configuración de Variables (`.env`)**:
   El archivo `.env` ya incluye el Token de Wispro y la URL base. Para cambiarlo:
   ```bash
   nano .env
   ```

4. **Iniciar el servidor**:
   Para pruebas iniciales:
   ```bash
   npm start
   ```
   Para producción (recomendado usar PM2 para que el servidor no se caiga):
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name velocity
   pm2 save
   pm2 startup
   ```

## 🌐 Acceso a la Aplicación
El servidor corre por defecto en el **puerto 3000**.
- **Panel Supervisor**: `http://IP-DEL-SERVIDOR:3000/pages/supervisor.html`
- **Panel Técnico**: `http://IP-DEL-SERVIDOR:3000/pages/technician.html`

## 🚂 Despliegue en Railway (Producción)

Railway es la opción recomendada para este ecosistema por su facilidad para manejar Node.js y persistencia.

1.  **Variables de Entorno**:
    En el panel de **Variables** de Railway, añade:
    - `WISPRO_API_KEY`: Tu token de Wispro Cloud.
    - `API_SECRET`: Una clave segura para proteger tus endpoints (ej: `velocity-2024-secure`).
    - `DATA_DIR`: `/data` (Ruta donde se montará el volumen).

2.  **Persistencia de Usuarios (CRÍTICO)**:
    Si no haces esto, tus usuarios y técnicos se borrarán en cada redeploy:
    - Ve a **Settings** -> **Volumes**.
    - Haz clic en **Add Volume**.
    - Configura el **Mount Path** como: `/data`.

3.  **Seguridad de Acceso**:
    - El servidor Node.js actúa como **Proxy Seguro**. El Token de Wispro nunca se expone al cliente.
    - Los datos de sincronización se guardan en el volumen montado.
- Los datos de sincronización se guardan en el volumen de datos definido. Asegúrate de que el servidor tenga permisos de escritura en esa carpeta.

## 📡 Sincronización Real
El sistema ahora usa un motor de **Heartbeats**. Los técnicos reportan su estado cada 30 segundos. Si un técnico cierra la pestaña, el supervisor lo verá como "Desconectado" tras 2 minutos de inactividad.
