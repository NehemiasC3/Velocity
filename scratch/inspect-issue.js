const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== INSPECTING HELP DESK ISSUE ===");
    try {
        const issuesRes = await fetch(`${BASE_URL}/help_desk/issues?per_page=1`, {
            headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
        });
        const issues = await issuesRes.json();
        const issue = issues.data[0];
        
        if (issue) {
            console.log("Issue Keys:", Object.keys(issue));
            console.log("Issue details:", JSON.stringify(issue, null, 2));
            
            // Try fetching specific issue resource
            const singleRes = await fetch(`${BASE_URL}/help_desk/issues/${issue.id}`, {
                headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
            });
            const singleData = await singleRes.json();
            console.log("\nSingle Issue keys:", Object.keys(singleData));
            console.log("Single Issue details:", JSON.stringify(singleData, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

test();
