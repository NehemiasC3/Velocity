const fs = require('fs');
const path = require('path');

let token = '';
try {
    const env = fs.readFileSync('/opt/velocity/.env', 'utf8');
    const tokenMatch = env.match(/WISPRO_API_TOKEN=(.+)/);
    if (tokenMatch) token = tokenMatch[1].trim();
} catch (e) {}

async function run() {
    try {
        const res = await fetch('https://www.cloud.wispro.co/api/v1/employees?per_page=100', {
            headers: { Authorization: token, Accept: 'application/json' }
        });
        const json = await res.json();
        const list = json.data || [];
        console.log(`\n=== EMPLEADOS DEVUELTOS POR WISPRO API (Total: ${list.length}) ===`);
        list.forEach(e => {
            console.log(`PublicID: ${e.public_id || '--'} | UUID: ${e.id} | Name: "${e.name}" | Email: ${e.email || '--'} | Phone: ${e.phone_mobile || e.phone || '--'}`);
        });
    } catch (err) {
        console.error('Error al conectar con Wispro API:', err.message);
    }
}

run();
