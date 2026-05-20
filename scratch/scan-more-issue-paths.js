const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== SCANNING MORE ISSUE PATHS ===");
    try {
        const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=5`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const issues = json.data || [];
        
        for (const issue of issues) {
            console.log(`\nIssue ID: ${issue.id}`);
            const paths = [
                `/help_desk/issues/${issue.id}/issue_comments`,
                `/help_desk/issues/${issue.id}/activities`,
                `/help_desk/issues/${issue.id}/history`,
                `/help_desk/issues/${issue.id}/events`,
                `/help_desk/issues/${issue.id}/logs`
            ];
            for (const p of paths) {
                const r = await fetch(`${BASE_URL}${p}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                console.log(` - Path: ${p} Status: ${r.status}`);
                if (r.status !== 404) {
                    const txt = await r.text();
                    console.log(`   Response: ${txt.slice(0, 200)}`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

test();
