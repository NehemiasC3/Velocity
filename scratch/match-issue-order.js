const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== MATCHING ISSUES AND ORDERS ===");
    try {
        const issuesRes = await fetch(`${BASE_URL}/help_desk/issues?per_page=100`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const issues = (await issuesRes.json()).data || [];

        const ordersRes = await fetch(`${BASE_URL}/order/orders?per_page=100`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const orders = (await ordersRes.json()).data || [];

        console.log(`Issues fetched: ${issues.length}, Orders fetched: ${orders.length}`);

        let matches = 0;
        for (const issue of issues) {
            // Find orders for the same client
            const sameClientOrders = orders.filter(o => o.client_id === issue.client_id || o.orderable_id === issue.client_id);
            if (sameClientOrders.length > 0) {
                console.log(`\nMatch found for Client ID: ${issue.client_id}`);
                console.log(` - Issue: ID=${issue.id} title="${issue.title}" state=${issue.state} created_at=${issue.created_at}`);
                for (const o of sameClientOrders) {
                    console.log(` - Order: ID=${o.id} kind=${o.kind} state=${o.state} created_at=${o.created_at}`);
                    if (o.feedbacks && o.feedbacks.length > 0) {
                        console.log(`   - Feedbacks:`, o.feedbacks.map(f => f.body));
                    }
                }
                matches++;
            }
        }
        console.log(`\nTotal client matches: ${matches}`);
    } catch (e) {
        console.error(e);
    }
}

test();
