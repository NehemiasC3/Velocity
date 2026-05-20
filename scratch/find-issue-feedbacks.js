const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    console.log("=== SCANNING FOR ISSUE FEEDBACKS IN DATA ===");
    try {
        let page = 1;
        let found = 0;
        while (page <= 5) {
            const res = await fetch(`${BASE_URL}/help_desk/issues?per_page=100&page=${page}`, {
                headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
            });
            const json = await res.json();
            const issues = json.data || [];
            if (issues.length === 0) break;
            
            for (const issue of issues) {
                // Check if any of these properties are present and populated
                const keys = Object.keys(issue);
                const candidates = ['feedbacks', 'comments', 'notes', 'replies', 'issue_feedbacks'];
                for (const c of candidates) {
                    if (issue[c] && Array.isArray(issue[c]) && issue[c].length > 0) {
                        console.log(`\nEncontrado ${c} en Issue ID ${issue.id} (Seq: ${issue.public_id}):`);
                        console.log(JSON.stringify(issue[c], null, 2));
                        found++;
                    }
                }
            }
            page++;
        }
        console.log(`\nTotal issues revisadas con alguna coleccion de comentarios poblada: ${found}`);
    } catch (e) {
        console.error(e);
    }
}

test();
