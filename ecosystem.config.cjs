/**
 * pm2 process definition for the production server.
 *
 * This file ships *inside* the deploy artifact, so `__dirname` resolves to the
 * concrete release directory (`.../app/releases/<sha>`) rather than to the
 * `current` symlink — Node resolves module paths through symlinks by default.
 * That's deliberate: a running process should be pinned to an identifiable
 * release, and `pm2 describe pika` should tell you which one.
 *
 * Because of that pin, a deploy must not `pm2 reload`/`startOrReload` a running
 * app: pm2 keeps the cwd and script the process was started with, so it would
 * restart the old release. deploy.sh deletes the app and starts it again:
 *
 *   pm2 delete pika
 *   pm2 start /www/wwwroot/pika.elabins.com/app/current/ecosystem.config.cjs --update-env
 *
 * See docs/DEPLOYMENT.md.
 */
const path = require('path')

module.exports = {
  apps: [
    {
      name: 'pika',
      cwd: __dirname,
      // Next's standalone entrypoint. It sets NODE_ENV=production itself,
      // chdir()s to its own directory, and loads `.env` from there — which is
      // why deploy.sh symlinks shared/.env into every release.
      script: 'server.js',
      instances: 1,
      // Fork, not cluster. The MiniLM embedding pipeline is a per-process
      // singleton holding ~22MB of weights plus an onnxruntime session; a
      // second instance doubles that for no throughput this app needs.
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // Higher than a plain Next app would need: onnxruntime keeps the model
      // resident once the first embedding request loads it.
      max_memory_restart: '1500M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--no-deprecation',
        PORT: '3333',
        HOSTNAME: '127.0.0.1',
      },
      // Logs live in shared/, not in the release, so they survive deploys and
      // aren't wiped when an old release is pruned. Derived from __dirname
      // (releases/<sha>) rather than hardcoded, so the deploy root can move
      // without editing this file.
      error_file: path.join(__dirname, '../../shared/logs/pm2-error.log'),
      out_file: path.join(__dirname, '../../shared/logs/pm2-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
}
