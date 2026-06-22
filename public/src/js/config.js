// Velocity - Configuración de la Aplicación
// ⚠️ NOTA: Restaurando estructura completa para compatibilidad con supervisor.js

const VELOCITY_CONFIG = {
    // Seguridad: El token ahora se maneja en el servidor.
    // El cliente usa un token de sesión temporal devuelto en el login.
    base:   "", // No necesario con el proxy local
    proxy:  "/api/wispro/", 

    // Estructura requerida por supervisor.js
    server:   '', 
    pollMs:   30 * 1000, // Reducido a 30s para mayor frescura


    errorLog: [],
    cacheTTL: {
        static: 1000 * 60 * 60 * 24, // 24h
        orders: 1000 * 60 * 5,       // 5m
        issues: 1000 * 60 * 5        // 5m
    },

    // Rutas de sincronización con el servidor local
    get apiBase() { return "/api/sync"; },
    get wisproProxy() { return "/api/wispro"; },
    get heartbeatPath() { return "/api/heartbeat"; },
    
    // Versión del Ecosistema
    version: "3.2.0-PRO"
};
