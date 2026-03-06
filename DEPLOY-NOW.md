# Deploy JetJams Backend – Ab karo

## 1. Instance start karo (stopped hai to)

- AWS Console → EC2 → Instances → **Jet Jams Server** select karo.
- **Instance state** → **Start instance**.
- Jab state **Running** ho jaye, **Public IPv4 address** note karo (pehle `13.60.82.114` thi, ab same ya nayi ho sakti hai).

---

## 2. Pehli baar deploy (server par abhi kuch nahi hai)

### Option A: Script se (recommended)

PowerShell open karo (normal ya Run as Administrator), phir:

```powershell
cd D:\jetjam-be-final
.\deploy-to-ec2.ps1 -IP "13.60.82.114" -FirstTime
```

Agar script run nahi hoti (execution policy) to pehle ye chalao:  
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`  
phir dubara `.\deploy-to-ec2.ps1 ...` chalao.

**IP replace karo** agar instance start ke baad nayi Public IP mili ho (e.g. `.\deploy-to-ec2.ps1 -IP "NEW_IP" -FirstTime`).

Script kya karega: server par Node/PM2 install (agar nahi hai), repo clone, `npm install`.  

Uske **baad tumhein ek baar SSH karke .env banana hoga**:

```powershell
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@13.60.82.114
```

Server par:

```bash
cd ~/jetjam-be-final
nano .env
```

Ye variables daalo (values apni):

```
PORT=5000
DB_CONNECTION_STRING=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/jetjams
JWT_SECRET_KEY=apna_strong_secret
DB_NAME=jetjams
APP_NAME=jetjams
EMAIL_FORMAIL=your@gmail.com
EMAILPASSWORD_FORMAIL=app_password
PROTECTED=false
PAYPAL_CLIENT_ID=your_live_id
PAYPAL_CLIENT_SECRET=your_live_secret
PAYPAL_API_URL=https://api-m.paypal.com
```

Save: `Ctrl+O`, Enter, `Ctrl+X`. Phir:

```bash
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
```

(Jo line `pm2 startup` print kare, woh bhi chala do.)

---

### Option B: Sab manually

**2.1 SSH**

```powershell
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@13.60.82.114
```

(IP agar badal chuki ho to nayi use karo.)

**2.2 Server par (ek ek run karo):**

```bash
sudo apt update && sudo apt install -y nodejs npm git
sudo npm install -g pm2
cd ~
git clone https://github.com/TeamInterNativeLabs/jetjam-be-final.git jetjam-be-final
cd jetjam-be-final
npm install
nano .env
```

`.env` mein wahi variables daalo jo upar diye. Phir:

```bash
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
```

---

## 3. Baad mein sirf code update (pehle se deploy ho chuka hai)

PowerShell:

```powershell
cd D:\jetjam-be-final
.\deploy-to-ec2.ps1 -IP "13.60.82.114"
```

Ya manually SSH karke:

```bash
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@13.60.82.114
cd ~/jetjam-be-final
git pull origin main
npm install
pm2 restart jetjam-api
```

---

## 4. Check

- Server par: `pm2 status` aur `pm2 logs jetjam-api`
- Browser/Postman: `http://<PUBLIC_IP>:5000/jetjams/v1/api/...`  
  EC2 Security Group mein **port 5000** (aur SSH ke liye **22**) open hona chahiye.

---

**PEM path:** `C:\Users\wajiz.pk\Downloads\jetjamsserver.pem`  
**Repo:** https://github.com/TeamInterNativeLabs/jetjam-be-final.git
