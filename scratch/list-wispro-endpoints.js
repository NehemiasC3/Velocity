const fetch = require('node-fetch');
require('dotenv').config();

const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
const apiKey = process.env.WISPRO_API_KEY;

async function test() {
    const endpoints = [
        '/naps?per_page=5',
        '/sale_desk/prospects?per_page=5',
        '/prospects?per_page=5',
        '/installation_orders?per_page=5',
        '/contracts?per_page=5',
        '/clients?per_page=5'
    ];
    
    for (const ep of endpoints) {
        console.log(`\n--- Listing ${ep} ---`);
        const r = await fetch(`${baseUrl}${ep}`, { headers: { 'Authorization': apiKey } });
        console.log(`Status: ${r.status}`);
        if (r.status === 200) {
            const json = await r.json();
            const items = json.data || [];
            console.log(`Found ${items.length} items`);
            if (items.length > 0) {
                const item = items[0];
                console.log(`First item ID: ${item.id}, Name: ${item.name || item.client_name}`);
                console.log(`Full keys: ${Object.keys(item).join(', ')}`);
            }
        }
    }
}

test();
