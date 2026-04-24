const fetch = require('node-fetch');
require('dotenv').config();

const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
const apiKey = process.env.WISPRO_API_KEY;

async function test() {
    // 1. Get some orders to find IDs
    const res = await fetch(`${baseUrl}/order/orders?per_page=5`, {
        headers: { 'Authorization': apiKey }
    });
    const { data: orders } = await res.json();
    
    for (const o of orders) {
        console.log(`\n--- Order ${o.sequential_id} (${o.kind}) ---`);
        console.log(`Orderable ID: ${o.orderable_id}, Type: ${o.orderable_type}`);
        
        const cid = o.orderable_id;
        const endpoints = [`/contracts/${cid}`, `/installation_orders/${cid}`, `/prospects/${cid}`, `/clients/${cid}`, `/sale_desk/prospects/${cid}`];
        
        for (const ep of endpoints) {
            const r = await fetch(`${baseUrl}${ep}`, { headers: { 'Authorization': apiKey } });
            console.log(`Endpoint ${ep} -> Status: ${r.status}`);
            if (r.status === 200) {
                const json = await r.json();
                console.log(`   Body: ${JSON.stringify(json)}`);
                const d = json.data || json;
                console.log(`   Keys: ${Object.keys(d).join(', ')}`);
                console.log(`   Name: ${d.name}, Client Name: ${d.client_name}, Public ID: ${d.public_id}`);
                if (d.client) console.log(`   Client Object Keys: ${Object.keys(d.client).join(', ')}`);
            }
        }
    }
}

test();
