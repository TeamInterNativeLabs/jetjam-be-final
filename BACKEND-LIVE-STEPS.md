# Backend Live – Step by Step (EC2)

**EC2:** Running | **Public IP:** 13.60.82.114 | **PEM:** `C:\Users\wajiz.pk\Downloads\jetjamsserver.pem`  
**Repo:** https://github.com/TeamInterNativeLabs/jetjam-be-final.git

---

## Step 1: SSH into the server

PowerShell:

```powershell
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@13.60.82.114
```

(Pehli baar "yes" type karke fingerprint accept karo.)

---

## Step 2: One-time setup (Node + PM2) – agar pehle nahi kiya

Server par:

```bash
sudo apt update
sudo apt install -y nodejs npm git
sudo npm install -g pm2
```

---

## Step 3: Code lao

**Pehli baar (clone):**

```bash
cd ~
git clone https://github.com/TeamInterNativeLabs/jetjam-be-final.git jetjam-be-final
cd jetjam-be-final
```

**Baad mein (update):**

```bash
cd ~/jetjam-be-final
git pull origin main
```

---

## Step 4: .env banao / update karo

```bash
cd ~/jetjam-be-final
nano .env
```

Ye variables daalo (values apni):

```
PORT=5000
DB_CONNECTION_STRING=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/jetjams
JWT_SECRET_KEY=your_strong_secret_key
DB_NAME=jetjams
APP_NAME=jetjams
EMAIL_FORMAIL=your@gmail.com
EMAILPASSWORD_FORMAIL=your_app_password
PROTECTED=false
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
PAYPAL_API_URL=https://api-m.paypal.com
```

Save: **Ctrl+O** → Enter → **Ctrl+X**.

---

## Step 5: Dependencies + start / restart

**Pehli baar:**

```bash
cd ~/jetjam-be-final
npm install
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
```

(Jo command `pm2 startup` print kare, woh bhi chala do taaki reboot par app phir start ho.)

**Baad mein (code update ke baad):**

```bash
cd ~/jetjam-be-final
npm install
pm2 restart jetjam-api
```

---

## Step 6: Check backend

```bash
pm2 status
pm2 logs jetjam-api
```

**Test:** Browser ya Postman se:

- `http://13.60.82.114:5000/jetjams/v1/api/general/get`

Agar ye URL response de to backend **chal raha hai**.  
(EC2 Security Group mein **port 5000** inbound open hona chahiye.)

---

## Step 7: api.jetjams.net (HTTPS) – optional, baad mein

Abhi backend **http://13.60.82.114:5000** pe chal raha hai.  
**https://api.jetjams.net** ke liye server par:

1. **Nginx** install karo (reverse proxy).
2. **api.jetjams.net** ka **A record** apne domain pe **13.60.82.114** point karo.
3. Nginx config: 443 (SSL) → proxy to `http://127.0.0.1:5000`.
4. **SSL:** Let's Encrypt (certbot) se certificate.

Agar tum bolo to is doc mein Nginx + certbot ke exact commands bhi add kar sakte hain.

---

## Quick copy-paste (pehli baar full setup)

**1. Apne PC se SSH:**

```powershell
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@13.60.82.114
```

**2. Server par (ek ek run karo):**

```bash
sudo apt update && sudo apt install -y nodejs npm git && sudo npm install -g pm2
cd ~ && git clone https://github.com/TeamInterNativeLabs/jetjam-be-final.git jetjam-be-final
cd jetjam-be-final
nano .env
```

(.env mein saari values daalo, save karo.)

```bash
npm install
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
pm2 status
```

**3. EC2 Security Group:** Inbound rule add karo – **Port 5000**, Source **0.0.0.0/0** (ya apna IP).

**4. Test:** `http://13.60.82.114:5000/jetjams/v1/api/general/get`

---

**PEM path:** `C:\Users\wajiz.pk\Downloads\jetjamsserver.pem`  
**Current EC2 IP:** 13.60.82.114 (stop/start ke baad badal sakti hai; hamesha AWS console se confirm karo)
