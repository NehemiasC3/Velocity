const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        const res = await fetch(`${baseUrl}/help_desk/issues?per_page=10`, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const issues = data.data || [];
        console.log(`Found ${issues.length} issues.`);

        for (const issue of issues) {
            const cid = issue.client_id;
            console.log(`\nIssue #${issue.public_id} - Client ID: ${cid}`);
            if (!cid) continue;

            // Try /clients/cid
            try {
                const r = await fetch(`${baseUrl}/clients/${cid}`, {
                    headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
                });
                console.log(`  /clients/${cid} -> status ${r.status}`);
                if (r.status === 200) {
                    const cData = await r.json();
                    console.log(`    Name: ${cData.data?.name || cData.name}`);
                }
            } catch (err) {
                console.log(`  /clients failed:`, err.message);
            }

            // Try /contracts/cid
            try {
                const r = await fetch(`${baseUrl}/contracts/${cid}`, {
                    headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
                });
                console.log(`  /contracts/${cid} -> status ${r.status}`);
                if (r.status === 200) {
                    const cData = await r.json();
                    console.log(`    Name: ${cData.data?.name || cData.name}`);
                }
            } catch (err) {
                console.log(`  /contracts failed:`, err.message);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
