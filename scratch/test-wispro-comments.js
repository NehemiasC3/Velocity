const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== BUSCANDO REPORTES (MESA DE AYUDA) ===");
    try {
        const issuesRes = await fetch(`${BASE_URL}/help_desk/issues?per_page=5`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const issues = await issuesRes.json();
        console.log(`Encontrados ${issues.data?.length || 0} issues.`);
        
        for (const issue of (issues.data || [])) {
            console.log(`\nIssue ID: ${issue.id}, Public ID: ${issue.public_id}, Title: ${issue.title}, State: ${issue.state}`);
            const commentsEndpoints = [
                `/help_desk/issues/${issue.id}/comments`,
                `/help_desk/issues/${issue.id}/feedbacks`,
                `/help_desk/issues/${issue.id}/issue_feedbacks`
            ];
            for (const ep of commentsEndpoints) {
                const res = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                const text = await res.text();
                console.log(`Endpoint ${ep} status: ${res.status}`);
                console.log(`- Response: ${text.slice(0, 300)}`);
            }
        }
    } catch (e) {
        console.error("Error en test issues:", e);
    }

    console.log("\n=== BUSCANDO ÓRDENES DE TRABAJO (ORDERS) ===");
    try {
        const ordersRes = await fetch(`${BASE_URL}/order/orders?per_page=5`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const orders = await ordersRes.json();
        console.log(`Encontrados ${orders.data?.length || 0} orders.`);
        
        for (const order of (orders.data || [])) {
            console.log(`\nOrder ID: ${order.id}, Sequential ID: ${order.sequential_id}, State: ${order.state}`);
            const orderEndpoints = [
                `/order/orders/${order.id}/feedbacks`,
                `/installation_orders/${order.id}/feedbacks`
            ];
            for (const ep of orderEndpoints) {
                const res = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                const text = await res.text();
                console.log(`Endpoint ${ep} status: ${res.status}`);
                console.log(`- Response: ${text.slice(0, 300)}`);
            }
        }
    } catch (e) {
        console.error("Error en test orders:", e);
    }
}

test();
