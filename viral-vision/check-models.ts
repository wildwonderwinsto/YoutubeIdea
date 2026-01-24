import fs from 'fs';
import https from 'https';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);

if (!match) {
    console.error('Could not find VITE_GEMINI_API_KEY in .env');
    process.exit(1);
}

const apiKey = match[1].trim();
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('API Error:', json.error);
            } else {
                const models = json.models.filter((m: any) => m.name.includes('gemini')).map((m: any) => m.name);
                fs.writeFileSync('models.txt', models.join('\n'));
                console.log('Models written to models.txt');
            }
        } catch (e) {
            console.error('Failed to parse response:', data);
        }
    });
}).on('error', (e) => {
    console.error('Network error:', e);
});
