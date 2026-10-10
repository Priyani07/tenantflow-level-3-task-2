import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
if(!existsSync('.env'))copyFileSync('.env.example','.env');mkdirSync('data',{recursive:true});console.log('Ready. npm run build, then npm start. Open http://localhost:3001.');
