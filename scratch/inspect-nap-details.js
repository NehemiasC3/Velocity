const fetch = require('node-fetch');
require('dotenv').config();

const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
const apiKey = process.env.WISPRO_API_KEY;

async function test() {
    const napId = '02f932df-e860-4553-bd4b-244b6255327c'; // PK-50
    const endpoints = [
        `/naps/${napId}`,
        `/contracts?nap_id=${napId}`,
        `/installation_orders?nap_id=${napId}`
    ];
    
    for (const ep of endpoints) {
        console.log(`\n--- Inspecting ${ep} ---`);
        const r = await fetch(`${baseUrl}${ep}`, { headers: { 'Authorization': apiKey } });
        console.log(`Status: ${r.status}`);
        if (r.status === 200) {
            const json = await r.json();
            console.log(`Data keys: ${Object.keys(json.data || json).join(', ')}`);
            const items = json.data || [];
            if (Array.isArray(items)) {
                console.log(`Found ${items.length} items`);
                if (items.length > 0) {
                    console.log(`First item ID: ${items[0].id}`);
                    // List client names if possible
                    if (items[0].client_id) {
                        console.log(`Has client_id: ${items[0].client_id}`);
                    }
                }
            } else {
                console.log(`Single object. Name: ${items.name}, Contracts Count: ${items.contracts_count}`);
            }
        }
    }
}

test();
