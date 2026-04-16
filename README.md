# Velocity 🚀
**Un Dashboard moderno e inteligente para Operaciones ISP, diseñado como un ecosistema envolvente para Wispro.**

Velocity es una suite de herramientas web de operaciones diseñada para interactuar con la API de **Wispro Cloud**. Construido para reducir fricciones y mejorar los tiempos de respuesta tanto del equipo en campo (técnicos) y el personal directivo (supervisores). No requiere complejas instalaciones de servidores, ya que utiliza arquitectura orientada al frontend combinada con un poderoso motor de sincronización basado en local-storage y la nube.

---

## 🔥 Funcionalidades Principales

### 1. Panel Global de Supervisor (`supervisor.html`)
Diseñado para monitoreo a alto nivel, resolución de incidentes en tiempo real y asignación de activos.
*   **KPIs en Tiempo Real:** Total de órdenes, completadas, pendientes, técnicas online e ingresos no ubicados (sin NAP asignada).
*   **Gestión de Órdenes:** Visualización de todas las tareas del día mediante etiquetas automáticas filtrables (Ej. Instalación, Visita Técnica, Baja de Servicio) generadas desde Wispro.
*   **Monitor de Status "En Curso":** Permite al supervisor ver el tiempo exacto que lleva un técnico activo (ej. "En curso: 15 min") representado a través de etiquetas vibrantes animadas (pulso).
*   **Tracker de NAPs Manual:** Base de datos independiente para registrar cajas NAP en campo (Ubicación, Coordenadas, Puertos Disponibles) hasta que Wispro madure esta funcionalidad.
*   **Autenticación y Cuentas:** Capacidad de autogenerar cuentas provisorias estandarizadas de todos los técnicos jalados directamente desde la API oficial.

### 2. Panel PWA para Técnicos (`technician.html`)
Diseñado estratégicamente para usarse desde el móvil o tablet bajo el sol.
*   **Flujo Cinético Minimalista:** Cero distracciones. Presenta tarjetas fáciles de leer de órdenes activas y su estatus.
*   **Registro de Tiempos:** El técnico inicia los trabajos permitiéndole a la compañía registrar métricas de resolución.
*   **Latido Online (Heartbeat):** Mientras el técnico tanga el panel de Velocity abierto, su estado es transmitido y visualizado como "En línea" para la agencia.
*   **Validaciones Previas:** Muestra advertencias crudas de validaciones (ej. Si la orden técnica no tiene NAP asignada).

---

## 🏗️ Arquitectura Técnica

### Stack
- **Estructura y Lógica:** 100% Vanilla JavaScript (ES6+), HTML5.
- **Estilos:** Tailwind CSS (via Tailwind Play CDN para portabilidad extrema).
- **Iconografía:** Google Material Symbols (Rounded & Outlined).
- **Base de Datos / Persistencia:** Caché Local (`localStorage` / `sessionStorage`) de HTML5 como fuente primigenia, sincronizada esporádicamente contra la **API REST V1 de Wispro**.

### Gestión de Estados (State-Machine)
Para no saturar a la API corporativa de Wispro de decenas de requests por minuto y para proveer fluidez absoluta a la aplicación central, Velocity emplea de manera robusta estructuras en cache:
*   `Velocity_Sync_State`: Usuarios registrados y perfiles locales de inicio de sesión.
*   `Velocity_Online_Status`: Pulsos cardíacos de los técnicos trabajando.
*   `Velocity_Order_Tracking`: Tiempos cronometrados de cada ticket en curso en campo.
*   `Velocity_NAPs`: JSON completo conteniendo el levantamiento alterno de cajas.

---

## 🛠️ Despliegue (Cómo Instalar)

Ya que Velocity es estrictamente de arquitectura Fron-end (aplicación del lado del cliente) su despliegue es inmediato. Sencillamente sirve el directorio de archivos en cualquier Servidor Web moderno o pasarela FaaS, tales como:
- **GitHub Pages** (Recomendado)
- **Vercel** o **Netlify**
- Cualquier Bucket S3 o Servidor Apache/Nginx base.

**Requisitos Previos:**
Para que pueda funcionar conectándose a Wispro sin que tu navegador lance un error (CORS Error), todas las peticiones cruzan por un proxy público, sin embargo en entornos de alto tráfico empresarial, recomendamos cambiar la variable `proxy` en el código fuente `supervisor.js/technician.js` y desplegar un servicio alterno (Como Cloudflare CORS worker).

---

## 🔒 Autenticación Local por Defecto
Velocity trae consigo un archivo pre-construido lógico. Si la base de datos es reseteada:
- **Usuario:** `nehemias@atg-rappido.com`
- **Contraseña:** `Administrador2024`
- **Rol:** Supervisor Administrador

*Nota: Una vez dentro, se insta urgentemente al supervisor a crear las cuentas individuales de los empleados, o bien, importarlas directamente usando la herramienta "Auto Sync".*

---
> Diseñado en **2024** | Construido para ISPs de élite.
