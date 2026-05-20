const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== SCANNING FOR ORDER FEEDBACKS IN DATA ===");
    try {
        let page = 1;
        let found = 0;
        while (page <= 5) {
            const res = await fetch(`${BASE_URL}/order/orders?per_page=100&page=${page}`, {
                headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
            });
            const json = await res.json();
            const orders = json.data || [];
            if (orders.length === 0) break;
            
            for (const o of orders) {
                if (o.feedbacks && o.feedbacks.length > 0) {
                    console.log(`\nEncontrado feedbacks en Orden ID ${o.id} (Seq: ${o.sequential_id}):`);
                    console.log(JSON.stringify(o.feedbacks, null, 2));
                    found++;
                }
            }
            page++;
        }
        console.log(`\nTotal órdenes revisadas con feedbacks poblados: ${found}`);
    } catch (e) {
        console.error(e);
    }
}

test();
