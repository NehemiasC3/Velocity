const fetch = require('node-fetch');
require('dotenv').config();

const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
const apiKey = process.env.WISPRO_API_KEY;

async function test() {
    const napId = '02f932df-e860-4553-bd4b-244b6255327c'; // PK-50
    // We'll try different filter formats
    const endpoints = [
        `/contracts?nap_id=${napId}`,
        `/contracts?q[nap_id_eq]=${napId}`,
        `/contracts?filter[nap_id]=${napId}`
    ];
    
    for (const ep of endpoints) {
        console.log(`\n--- Testing ${ep} ---`);
        const r = await fetch(`${baseUrl}${ep}`, { headers: { 'Authorization': apiKey } });
        if (r.status === 200) {
            const json = await r.json();
            const items = json.data || json;
            console.log(`Found ${Array.isArray(items) ? items.length : 'N/A'} items`);
            if (Array.isArray(items) && items.length > 0) {
                // Check if the items actually belong to this nap_id
                const mismatch = items.filter(i => i.nap_id !== napId);
                console.log(`Mismatched items: ${mismatch.length}`);
                if (mismatch.length === 0) {
                    console.log(`SUCCESS! This filter works.`);
                }
            }
        } else {
            console.log(`Status: ${r.status}`);
        }
    }
}

test();
