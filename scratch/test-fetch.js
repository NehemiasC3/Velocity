const fetch = require('node-fetch');

async function test() {
    const url = 'https://script.google.com/macros/s/AKfycbybpjnWEu60H4koS4SfD5MAkWEO0NXLEU8JbpkSOQulv0YODTcCevavg8j6QlXNLuLoFA/exec';
    console.log('Fetching:', url);
    try {
        const res = await fetch(url);
        console.log('Status:', res.status);
        console.log('Headers:', res.headers.raw());
        const text = await res.text();
        console.log('Body start:', text.slice(0, 800));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
