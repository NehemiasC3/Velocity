const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== INSPECTING ORDER ===");
    try {
        const ordersRes = await fetch(`${BASE_URL}/order/orders?per_page=1`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const orders = await ordersRes.json();
        const order = orders.data[0];
        
        if (order) {
            console.log("Order Keys:", Object.keys(order));
            console.log("Order details:", JSON.stringify(order, null, 2));
            
            // Try fetching specific order resource
            const singleRes = await fetch(`${BASE_URL}/order/orders/${order.id}`, {
                headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
            });
            const singleData = await singleRes.json();
            console.log("\nSingle Order keys:", Object.keys(singleData));
            console.log("Single Order details:", JSON.stringify(singleData, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

test();
