const fetch = require('node-fetch');
require('dotenv').config();

const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
const apiKey = process.env.WISPRO_API_KEY;

async function test() {
    console.log("Finding a contract with a nap_id...");
    const r = await fetch(`${baseUrl}/contracts?per_page=100`, { headers: { 'Authorization': apiKey } });
    if (r.status === 200) {
        const json = await r.json();
        const items = json.data || json;
        const withNap = items.find(i => i.nap_id);
        if (withNap) {
            console.log(`Found contract ${withNap.id} with nap_id ${withNap.nap_id}`);
            const napId = withNap.nap_id;
            
            // Now test filtering by this real napId
            const ep = `/contracts?nap_id=${napId}`;
            console.log(`Testing filter: ${ep}`);
            const r2 = await fetch(`${baseUrl}${ep}`, { headers: { 'Authorization': apiKey } });
            const j2 = await r2.json();
            const res = j2.data || j2;
            console.log(`Results: ${res.length}`);
            if (res.length > 0) {
                const mismatched = res.filter(i => i.nap_id !== napId);
                console.log(`Mismatched: ${mismatched.length}`);
            }
        } else {
            console.log("No contracts with nap_id found in the first 100.");
        }
    }
}

test();
