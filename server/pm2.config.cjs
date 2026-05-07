/**
 * PM2 Ecosystem Configuration — Siddiqui Admin Server
 *
 * Usage on VPS:
 *   pm2 start pm2.config.cjs
 *   pm2 save
 *   pm2 startup   (to auto-start on reboot)
 *
 * This file is safe to commit — secrets live in .env (gitignored).
 */
module.exports = {
    apps: [
        {
            name: 'siddique-admin-api',
            script: 'src/index.js',

            // Load environment variables from .env automatically
            // PM2 does NOT do this by default — this is the fix for missing env vars on VPS
            env_file: '.env',

            env_production: {
                NODE_ENV: 'production',
            },

            // Which env block to use when starting
            node_args: [],
            interpreter: 'node',

            // Restart policy
            watch: false,                  // Never watch files in production
            max_memory_restart: '300M',    // Restart if it leaks above 300 MB
            restart_delay: 3000,           // Wait 3s before restarting after crash
            max_restarts: 10,              // Stop restarting after 10 consecutive crashes

            // Logging
            out_file: '/var/log/pm2/admin-api-out.log',
            error_file: '/var/log/pm2/admin-api-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
        },
    ],
};
