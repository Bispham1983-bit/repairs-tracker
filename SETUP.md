# Repairs Tracker — N100 Setup Guide

Everything you need to do on the N100, start to finish.

---

## 1. Push the code to GitHub (do this on your laptop first)

```bash
cd ~/repairs-tracker     # wherever the project lives on your laptop
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:YOUR_USERNAME/repairs-tracker.git
git branch -M main
git push -u origin main
```

---

## 2. On the N100 — Install Node.js

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install latest LTS Node
nvm install --lts
nvm use --lts
node -v   # should print v20.x or similar
```

---

## 3. On the N100 — Install PM2

```bash
npm install -g pm2
```

---

## 4. On the N100 — Clone the repo

```bash
cd ~
git clone git@github.com:YOUR_USERNAME/repairs-tracker.git
cd repairs-tracker
npm install
```

---

## 5. On the N100 — Create your .env file

```bash
cp .env.example .env
nano .env
```

Fill in your values:

```
APP_USERNAME=admin
APP_PASSWORD=yourSecurePassword
SESSION_SECRET=some-long-random-string-at-least-32-chars
PORT=3000
```

For the SESSION_SECRET, generate a random one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. On the N100 — Import historical data (one-time only)

```bash
node seed.js
```

This imports all 48 existing items and sets the counter to 50 so new items start at #050.

---

## 7. On the N100 — Start the app with PM2

```bash
pm2 start app.js --name repairs-tracker

# Save the process list so it survives reboots
pm2 startup    # run the command it prints
pm2 save
```

Test it's running:
```bash
curl http://127.0.0.1:3000/login
# Should return HTML
```

---

## 8. On the N100 — Install Cloudflare Tunnel

```bash
# Download cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Log in (opens a browser on your machine — run this from desktop if needed,
# or copy the URL it shows and open it on any device)
cloudflared tunnel login

# Create the tunnel
cloudflared tunnel create repairs-tracker

# Note the Tunnel ID it prints — you'll need it below
```

Create the config file:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this (replace YOUR_TUNNEL_ID with what was printed above):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: inventory.respawnrepairs.uk
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Point your DNS (in Cloudflare dashboard or via CLI):

```bash
cloudflared tunnel route dns repairs-tracker inventory.respawnrepairs.uk
```

Install as a system service so it starts on boot:

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Test: open https://inventory.respawnrepairs.uk — you should see the login page.

---

## 9. On the N100 — Set up the GitHub Actions runner

This is what makes `git push` auto-deploy to the N100.

1. Go to your GitHub repo → **Settings → Actions → Runners → New self-hosted runner**
2. Choose **Linux x64**
3. Copy and run each command it shows — they'll look like:

```bash
mkdir ~/actions-runner && cd ~/actions-runner
# ... download and configure steps from GitHub ...
```

4. When it asks for labels, just press Enter (uses default).
5. When it asks for work folder, just press Enter.
6. **Don't run `./run.sh` directly** — install it as a service instead:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

Now every push to `main` triggers the deploy workflow automatically.

---

## 10. Test the full deploy pipeline

On your laptop:

```bash
# Make a trivial change, push it
echo "# test" >> README.md
git add README.md
git commit -m "Test deploy"
git push origin main
```

On GitHub → your repo → **Actions tab** — you should see the workflow running and completing within a minute.

---

## Daily workflow

- Make changes on your laptop
- `git add . && git commit -m "your message" && git push`
- App updates automatically within ~30 seconds

## Useful N100 commands

```bash
pm2 status                    # check app is running
pm2 logs repairs-tracker      # view logs
pm2 restart repairs-tracker   # manual restart
sudo systemctl status cloudflared  # check tunnel
```

## Database location

Your database lives at `~/repairs-tracker/repairs.db`. Back it up:

```bash
cp ~/repairs-tracker/repairs.db ~/repairs-tracker/repairs.db.backup
```

Or set up a cron to do it nightly:

```bash
crontab -e
# Add: 0 2 * * * cp ~/repairs-tracker/repairs.db ~/backups/repairs-$(date +\%F).db
```
