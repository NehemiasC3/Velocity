/**
 * Script de Sincronización Forzada de Contratos Wispro -> PostgreSQL (Seeding & Conciliación)
 * Uso: node scripts/sync-wispro-contracts.js [--force] [--port=4000]
 */
const http = require('http');

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const portArg = args.find(a => a.startsWith('--port='));
const port = portArg ? portArg.split('=')[1] : (process.env.PORT || '3000');

console.log(`📡 [Velocity Wispro Sync] Solicitando sincronización (Puerto: ${port}, Force: ${force})...`);

const req = http.request({
  hostname: '127.0.0.1',
  port: parseInt(port, 10),
  path: `/api/wispro/sync${force ? '?force=true' : ''}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log(`\n✅ [Respuesta HTTP ${res.statusCode}]:`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`\n⚠️ [Respuesta Raw HTTP ${res.statusCode}]:`, body);
    }
  });
});

req.on('error', (err) => {
  console.error(`\n❌ [Error de Conexión]: ${err.message}`);
});

req.write(JSON.stringify({ forceFullDump: force }));
req.end();
