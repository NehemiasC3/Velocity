const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== CHECKING ISSUE TO ORDER LINK ===");
    try {
        // Fetch last 100 orders
        const ordersRes = await fetch(`${BASE_URL}/order/orders?per_page=100`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const ordersJson = await ordersRes.json();
        const orders = ordersJson.data || [];
        
        console.log(`Buscando link en ${orders.length} órdenes...`);
        let linkedCount = 0;
        for (const o of orders) {
            if (o.ticketable_id) {
                console.log(`Orden ID ${o.id} (Seq: ${o.sequential_id}) -> Ticketable ID: ${o.ticketable_id} (Type: ${o.ticketable_type})`);
                if (o.feedbacks && o.feedbacks.length > 0) {
                    console.log(` - Feedbacks en esta orden: ${o.feedbacks.length}`);
                    console.log(` - Feedbacks:`, JSON.stringify(o.feedbacks.map(f => f.body)));
                }
                linkedCount++;
            }
        }
        console.log(`Total órdenes vinculadas a ticketables: ${linkedCount}`);
    } catch (e) {
        console.error(e);
    }
}

test();
