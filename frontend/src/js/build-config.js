#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const envPath = join(__dirname, '../../.env');
const configPath = join(__dirname, 'config.js');

// 1. Try to get variables from the Node Environment (Best for Amplify)
let apiGatewayUrl = process.env.API_GATEWAY_URL;
let apiGatewayJoinUrl = process.env.API_GATEWAY_JOIN_URL;

// 2. If not in environment, try reading .env file (Fallback for local dev)
if (!apiGatewayUrl || !apiGatewayJoinUrl) {
    if (existsSync(envPath)) {
        console.log('Reading from .env file...');
        try {
            const envContent = readFileSync(envPath, 'utf-8');
            const envLines = envContent.split('\n');
            
            for (const line of envLines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    const value = valueParts.join('=').trim();
                    
                    if (key === 'API_GATEWAY_URL' && !apiGatewayUrl) apiGatewayUrl = value;
                    if (key === 'API_GATEWAY_JOIN_URL' && !apiGatewayJoinUrl) apiGatewayJoinUrl = value;
                }
            }
        } catch (error) {
            console.error('Error reading .env file:', error.message);
        }
    }
}

// 3. Validation
if (!apiGatewayUrl || !apiGatewayJoinUrl) {
    console.error('Error: API Variables are missing.');
    console.error('Checked process.env AND .env file.');
    console.error(`API_GATEWAY_URL found: ${!!apiGatewayUrl}`);
    console.error(`API_GATEWAY_JOIN_URL found: ${!!apiGatewayJoinUrl}`);
    process.exit(1);
}

// 4. Update config.js
try {
    let configContent = readFileSync(configPath, 'utf-8');

    configContent = configContent.replace(
        /API_GATEWAY_URL:\s*"[^"]*"/,
        `API_GATEWAY_URL: "${apiGatewayUrl}"`
    );
    configContent = configContent.replace(
        /API_GATEWAY_JOIN_URL:\s*"[^"]*"/,
        `API_GATEWAY_JOIN_URL: "${apiGatewayJoinUrl}"`
    );

    writeFileSync(configPath, configContent, 'utf-8');
    console.log('✅ config.js updated successfully.');
} catch (err) {
    console.error('Failed to write config.js:', err);
    process.exit(1);
}