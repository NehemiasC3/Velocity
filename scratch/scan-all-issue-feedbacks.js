const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== SCANNING HELP DESK ISSUES FOR FEEDBACK PATHS ===");
    try {
        const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=50`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const json = await res.json();
        const issues = json.data || [];
        console.log(`Scanning ${issues.length} issues...`);
        
        let checked = 0;
        for (const issue of issues) {
            checked++;
            // Test various endpoints
            const paths = [
                `/help_desk/issues/${issue.id}/issue_feedbacks`,
                `/help_desk/issues/${issue.id}/feedbacks`,
                `/help_desk/issues/${issue.id}/comments`,
                `/help_desk/issues/${issue.id}/notes`
            ];
            
            for (const p of paths) {
                const r = await fetch(`${BASE_URL}${p}`, {
                    headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
                });
                if (r.status !== 404) {
                    console.log(`[FOUND!] Path: ${p} returned Status: ${r.status}`);
                    const text = await r.text();
                    console.log(`Response: ${text.slice(0, 500)}`);
                }
            }
        }
        console.log(`Scan completed. Checked ${checked} issues.`);
    } catch (e) {
        console.error(e);
    }
}

test();
