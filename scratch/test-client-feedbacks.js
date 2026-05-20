const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== CHECKING CLIENT & CONTRACT FEEDBACKS ===");
    try {
        const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=5`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const issues = json.data || [];
        
        for (const issue of issues) {
            console.log(`\nIssue ID: ${issue.id}, Client ID: ${issue.client_id}`);
            const paths = [];
            if (issue.client_id) {
                paths.push(`/clients/${issue.client_id}/feedbacks`);
                paths.push(`/clients/${issue.client_id}/comments`);
            }
            if (issue.contract_id) {
                paths.push(`/contracts/${issue.contract_id}/feedbacks`);
                paths.push(`/contracts/${issue.contract_id}/comments`);
            }
            
            for (const p of paths) {
                const r = await fetch(`${BASE_URL}${p}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                console.log(` - Path: ${p} Status: ${r.status}`);
                if (r.status === 200) {
                    const text = await r.text();
                    console.log(`   Response: ${text.slice(0, 200)}`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

test();
