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

## ☁️ Google Apps Script (Almacenamiento y Reportes por Correo)

Para habilitar la persistencia en la nube y los reportes diarios automáticos por correo electrónico, crea un nuevo script de **Google Apps Script** en tu Google Drive y pega el siguiente código:

```javascript
function doGet(e) {
  var fileId = getOrCreateDbFile();
  var file = DriveApp.getFileById(fileId);
  var jsonContent = file.getAs("application/json").getDataAsString();
  return ContentService.createTextOutput(jsonContent).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    
    // Si la acción es enviar el reporte diario por correo
    if (data.action === "send_daily_report") {
      sendDailyReportEmail(data);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Reporte enviado por email con éxito" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // De lo contrario, es una sincronización de base de datos
    var fileId = getOrCreateDbFile();
    var file = DriveApp.getFileById(fileId);
    file.setContent(rawData);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateDbFile() {
  var fileName = "velocity_db.json";
  var files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next().getId();
  } else {
    var newFile = DriveApp.createFile(fileName, JSON.stringify({
      supervisors: [],
      technicians: [],
      napOverrides: {},
      trackedNaps: [],
      settings: {}
    }), "application/json");
    return newFile.getId();
  }
}

function sendDailyReportEmail(data) {
  var recipient = data.recipientEmail;
  var date = data.date;
  var total = data.totalTrackedNaps;
  var pending = data.pendingNapsCount;
  var criticals = data.criticalNaps || [];
  
  var htmlBody = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;'>" +
                 "<h2 style='color: #0059bb; margin-top: 0;'>🚀 Velocity Tracker - Reporte Diario (" + date + ")</h2>" +
                 "<p>A continuación se presenta el resumen de las operaciones de campo del día:</p>" +
                 "<table style='width: 100%; border-collapse: collapse; margin-bottom: 20px;'>" +
                 "<tr><td style='padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;'>Total NAPs Monitoreadas:</td><td style='padding: 8px; border-bottom: 1px solid #ddd;'>" + total + "</td></tr>" +
                 "<tr><td style='padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;'>Alertas Activas (Sin Resolver):</td><td style='padding: 8px; border-bottom: 1px solid #ddd; color: #dc2626;'>" + pending + "</td></tr>" +
                 "</table>";
  
  if (criticals.length > 0) {
    htmlBody += "<h3 style='color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 5px;'>⚠️ Niveles Críticos de Señal Detectados (<= -23 dBm)</h3>" +
                "<div style='overflow-x: auto;'><table style='width: 100%; border-collapse: collapse; font-size: 13px;'>" +
                "<tr style='background-color: #f8fafc;'><th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>NAP</th><th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Zona</th><th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Técnico</th><th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Señal</th><th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Estado</th></tr>";
    
    for (var i = 0; i < criticals.length; i++) {
      var n = criticals[i];
      htmlBody += "<tr>" +
                  "<td style='padding: 8px; border: 1px solid #ddd;'>" + n.name + "</td>" +
                  "<td style='padding: 8px; border: 1px solid #ddd;'>" + n.zone + "</td>" +
                  "<td style='padding: 8px; border: 1px solid #ddd;'>" + n.techName + "</td>" +
                  "<td style='padding: 8px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;'>" + n.levels + "</td>" +
                  "<td style='padding: 8px; border: 1px solid #ddd;'>" + (n.resolved || 'Abierto') + "</td>" +
                  "</tr>";
    }
    htmlBody += "</table></div>";
  } else {
    htmlBody += "<p style='color: #059669; font-weight: bold;'>✅ No se detectaron niveles críticos de señal hoy. ¡Excelente trabajo!</p>";
  }
  
  htmlBody += "<br><p style='font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px;'>Este correo fue generado automáticamente por el ecosistema de Velocity Tracker Pro.</p></div>";
  
  MailApp.sendEmail({
    to: recipient,
    subject: "Velocity Daily Report - " + date,
    htmlBody: htmlBody
  });
}
```

**Despliegue de Apps Script**:
1. Haz clic en **Nueva implementacion** (New Deployment).
2. Selecciona Tipo: **Aplicacion Web** (Web App).
3. Configura:
   - *Ejecutar como*: **Tú (Tu correo electrónico)**.
   - *Quién tiene acceso*: **Cualquiera** (Anyone).
4. Copia la URL de Web App resultante y pégala en la pestaña **Configuración** de Velocity.

