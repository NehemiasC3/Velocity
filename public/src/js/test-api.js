const fetch = require('node-fetch');
const token = "7531ec1c-b820-4959-9ae0-1b13fd9c4c1b";
const base = "https://www.cloud.wispro.co/api/v1";

async function check() {
    const endpoints = ['/naps', '/optical_nodes', '/nodes', '/boxes'];
    for (let e of endpoints) {
        console.log("Checking", e);
        try {
            const res = await fetch(base + e, {
                headers: { 'Authorization': token, 'Accept': 'application/json' }
            });
            console.log(e, res.status);
            if (res.ok) {
                const data = await res.json();
                console.log(e, "SUCCESS", JSON.stringify(data).slice(0, 200));
            }
        } catch(e) { console.error(e); }
    }
}
check();
