const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== SCANNIG ORDERS FOR FEEDBACKS ===");
    try {
        // Fetch last 100 orders
        const res = await fetch(`${BASE_URL}/order/orders?per_page=100`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const orders = json.data || [];
        console.log(`Buscando en ${orders.length} órdenes...`);
        
        let foundAny = false;
        for (const o of orders) {
            // Probar ambos endpoints de feedbacks
            const eps = [
                `/order/orders/${o.id}/feedbacks`,
                `/installation_orders/${o.id}/feedbacks`
            ];
            if (o.orderable_id) {
                eps.push(`/installation_orders/${o.orderable_id}/feedbacks`);
                eps.push(`/order/orders/${o.orderable_id}/feedbacks`);
            }
            
            for (const ep of eps) {
                const fRes = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                if (fRes.status === 200) {
                    const text = await fRes.text();
                    try {
                        const data = JSON.parse(text);
                        const list = data.data || data;
                        if (Array.isArray(list) && list.length > 0) {
                            console.log(`[EXITO] Orden ID ${o.id} (${o.state}) en endpoint ${ep} tiene ${list.length} comentarios:`);
                            console.log(JSON.stringify(list, null, 2));
                            foundAny = true;
                        }
                    } catch (e) {
                        // Not JSON or error body
                    }
                }
            }
        }
        if (!foundAny) {
            console.log("No se encontraron órdenes con feedbacks en los endpoints probados.");
        }
    } catch (e) {
        console.error(e);
    }

    console.log("\n=== SCANNIG HELP DESK ISSUES FOR FEEDBACKS ===");
    try {
        // Fetch last 100 issues
        const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=100`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const issues = json.data || [];
        console.log(`Buscando en ${issues.length} reportes...`);
        
        let foundAny = false;
        for (const issue of issues) {
            const eps = [
                `/help_desk/issues/${issue.id}/comments`,
                `/help_desk/issues/${issue.id}/feedbacks`,
                `/help_desk/issues/${issue.id}/issue_feedbacks`
            ];
            for (const ep of eps) {
                const fRes = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                if (fRes.status === 200) {
                    const text = await fRes.text();
                    try {
                        const data = JSON.parse(text);
                        const list = data.data || data;
                        if (Array.isArray(list) && list.length > 0) {
                            console.log(`[EXITO] Issue ID ${issue.id} (${issue.state}) en endpoint ${ep} tiene ${list.length} comentarios:`);
                            console.log(JSON.stringify(list, null, 2));
                            foundAny = true;
                        }
                    } catch (e) {
                        // Not JSON or error
                    }
                }
            }
        }
        if (!foundAny) {
            console.log("No se encontraron reportes con feedbacks en los endpoints probados.");
        }
    } catch (e) {
        console.error(e);
    }
}

test();
