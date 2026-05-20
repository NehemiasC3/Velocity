const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\nehfu\\.gemini\\antigravity\\brain\\b3d3044c-1a03-45b2-8d29-54b498e870ae\\.system_generated\\logs\\transcript.jsonl';

async function searchLog() {
    try {
        const fileStream = fs.createReadStream(logPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let count = 0;
        for await (const line of rl) {
            if (line.toLowerCase().includes('help_desk/issues') || line.toLowerCase().includes('feedback')) {
                // Print a snippet of the line (since lines can be huge)
                console.log(`Line ${count++}: ${line.slice(0, 400)}...`);
                if (count > 50) {
                    console.log("Too many matches, truncating...");
                    break;
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

searchLog();
