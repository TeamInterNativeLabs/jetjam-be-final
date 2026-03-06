# JetJams Backend – EC2 Final Steps

Backend folder check ho chuka. Koi **build** nahi hai, sirf **Node** chalega. Ye files zaroori hain:

- `app.js` (entry)
- `package.json` / `package-lock.json`
- `src/` (sari folder)
- `.env` (server par tumhein banana hoga, git mein commit mat karo secrets)

**Zaroori nahi:** Firebase ab commented hai. SSL bhi off hai (`isProtected = false`), to koi extra cert file nahi chahiye.

---

## Step 1: EC2 par SSH

```bash
ssh -i "C:\path\to\jetjams.pem" ubuntu@16.171.134.222
```

(`C:\path\to\jetjams.pem` apne .pem ke path se replace karo.)

---

## Step 2: Server par Node + Git + PM2 (sirf pehli baar)

```bash
sudo apt update
sudo apt install -y nodejs npm git
sudo npm install -g pm2
```

---

## Step 3: Code lao (pehli baar clone, baad mein pull)

**Pehli baar:**

```bash
cd ~
git clone <BACKEND_REPO_URL> jetjam-be-final
cd jetjam-be-final
```

**Baad mein (update):**

```bash
cd ~/jetjam-be-final
git pull origin main
```

---

## Step 4: .env banao (pehli baar) ya update karo

```bash
cd ~/jetjam-be-final
nano .env
```

Ye variables daalo (values apni use karo):

```
PORT=5000
DB_CONNECTION_STRING=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/jetjams
JWT_SECRET_KEY=apna_strong_secret_key
DB_NAME=jetjams
APP_NAME=jetjams
EMAIL_FORMAIL=your@gmail.com
EMAILPASSWORD_FORMAIL=app_password
PROTECTED=false
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_secret
PAYPAL_API_URL=https://api-m.paypal.com
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Step 5: Dependencies + start/restart

**Pehli baar (start):**

```bash
cd ~/jetjam-be-final
npm install
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
```

(Jo command `pm2 startup` print kare, woh bhi chala do taaki reboot par app phir se start ho.)

**Baad mein (code update ke baad):**

```bash
cd ~/jetjam-be-final
git pull origin main
npm install
pm2 restart jetjam-api
```

---

## Step 6: Check

```bash
pm2 status
pm2 logs jetjam-api
```

API test: browser/Postman se  
`http://16.171.134.222:5000/jetjams/v1/api/...`  
(EC2 Security Group mein **5000** open hona chahiye.)

---

## Ek page summary

| Step | Command / kaam |
|------|-----------------|
| 1 | `ssh -i "path/to/jetjams.pem" ubuntu@16.171.134.222` |
| 2 | (Pehli baar) `sudo apt install -y nodejs npm git` + `sudo npm install -g pm2` |
| 3 | `cd ~` → `git clone <repo> jetjam-be-final` **ya** `cd ~/jetjam-be-final` + `git pull origin main` |
| 4 | `cd ~/jetjam-be-final` → `nano .env` → saare env vars daalo |
| 5 | `npm install` → pehli baar: `pm2 start app.js --name jetjam-api` + `pm2 save` + `pm2 startup` **ya** update: `pm2 restart jetjam-api` |
| 6 | `pm2 status` + `pm2 logs jetjam-api` + API URL test |

Domain (api.jetjams.net) ke liye EC2 ke saamne Nginx reverse proxy + SSL (Let’s Encrypt) alag se set karna hoga; ye steps sirf backend run karne ke liye hain.
