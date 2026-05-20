const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== QUICK SCANNING ISSUES FOR COMMENTS ===");
    try {
        const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=10`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const issues = json.data || [];
        console.log(`Scanning ${issues.length} issues...`);
        for (const issue of issues) {
            console.log(`\nIssue sequential_id=${issue.public_id || issue.sequential_id} state=${issue.state} id=${issue.id}`);
            const eps = [
                `/help_desk/issues/${issue.id}/comments`,
                `/help_desk/issues/${issue.id}/feedbacks`,
                `/help_desk/issues/${issue.id}/issue_feedbacks`
            ];
            for (const ep of eps) {
                const fRes = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                const text = await fRes.text();
                console.log(` - ${ep} status=${fRes.status} body=${text.slice(0, 100)}`);
            }
        }
    } catch (e) {
        console.error(e);
    }

    console.log("\n=== QUICK SCANNING ORDERS FOR COMMENTS ===");
    try {
        const res = await fetch(`${BASE_URL}/order/orders?per_page=10`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const orders = json.data || [];
        console.log(`Scanning ${orders.length} orders...`);
        for (const order of orders) {
            console.log(`\nOrder sequential_id=${order.sequential_id} state=${order.state} id=${order.id}`);
            const eps = [
                `/order/orders/${order.id}/feedbacks`,
                `/installation_orders/${order.id}/feedbacks`
            ];
            for (const ep of eps) {
                const fRes = await fetch(`${BASE_URL}${ep}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                const text = await fRes.text();
                console.log(` - ${ep} status=${fRes.status} body=${text.slice(0, 100)}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

test();
