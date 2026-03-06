# Recover EC2 Access (Lost .pem) + Deploy Jet Jams

You **cannot recover** the original `jetjams.pem`; AWS gives it only once at launch. You can **regain access** by mounting the instance’s disk on another EC2 and adding a **new** SSH key.

**Instance:** `i-02b8cb8da580d0051` (Jet Jams Server)  
**Region:** `eu-north-1`  
**Public IP:** `16.171.134.222`  
**OS:** Ubuntu 24.04 (Noble)

---

## Part 1: Regain SSH Access (New Key)

### Step 1.1: Create a new key pair in AWS

1. In **AWS Console** go to **EC2** → **Key Pairs** (under Network & Security).
2. **Create key pair**
   - Name: `jetjams-recovery` (or any name).
   - Type: **RSA**, Format: **.pem**.
3. Download the `.pem` and store it safely (e.g. `C:\Users\You\.ssh\jetjams-recovery.pem`).
4. **Do not** assign this key to the existing instance yet (we’ll inject it manually).

### Step 1.2: Note the root volume of your Jet Jams instance

1. **EC2** → **Instances** → select `i-02b8cb8da580d0051`.
2. **Storage** tab → note the **Volume ID** of the root device (e.g. `vol-xxxxxxxx`).
3. Note the **Availability Zone** of the instance (e.g. `eu-north-1a`). You must use the **same AZ** for the recovery instance.

### Step 1.3: Stop the Jet Jams instance

1. Select instance `i-02b8cb8da580d0051`.
2. **Instance state** → **Stop instance**.
3. Wait until **Instance state** = **Stopped**.

### Step 1.4: Detach the root volume from the Jet Jams instance

1. **EC2** → **Volumes**.
2. Find the volume attached to `i-02b8cb8da580d0051` (root `/dev/sda1` or similar).
3. Select it → **Actions** → **Detach volume**.
4. Wait until **State** = **available**.

### Step 1.5: Launch a temporary “recovery” instance (same AZ)

1. **EC2** → **Launch instance**.
2. **Name:** `jetjams-recovery-temp`.
3. **AMI:** Ubuntu Server 24.04 (same family as your instance).
4. **Instance type:** `t3.micro`.
5. **Key pair:** Select **jetjams-recovery** (the one you created in Step 1.1).
6. **Network:** Same VPC as the Jet Jams instance; **subnet:** same **Availability Zone** as the stopped instance (e.g. `eu-north-1a`).
7. **Storage:** Default 8 GB is enough (we only need this instance to edit the volume).
8. **Launch**.

### Step 1.6: Attach the old root volume to the recovery instance

1. **EC2** → **Volumes**.
2. Select the **Jet Jams** root volume (now available).
3. **Actions** → **Attach volume**.
   - **Instance:** `jetjams-recovery-temp`.
   - **Device name:** `/dev/sdf` (or any free device like `/dev/sdg`).
4. **Attach**.

### Step 1.7: SSH into the recovery instance

From your PC (PowerShell or Git Bash):

```bash
ssh -i "C:\path\to\jetjams-recovery.pem" ubuntu@<RECOVERY_INSTANCE_PUBLIC_IP>
```

Replace `C:\path\to\jetjams-recovery.pem` and `<RECOVERY_INSTANCE_PUBLIC_IP>` (find IP in EC2 console).

### Step 1.8: Mount the attached volume and add your new SSH key

On the **recovery instance** (SSH session), run:

```bash
# See the attached volume (e.g. nvme1n1 or xvd f)
lsblk

# If the root partition is e.g. nvme1n1p1 (adjust name if different)
sudo mkdir -p /mnt/jetjams
sudo mount /dev/nvme1n1p1 /mnt/jetjams

# If the volume shows as nvme1n1 with no p1, try:
# sudo mount /dev/nvme1n1 /mnt/jetjams

# Create .ssh for ubuntu on the Jet Jams disk if missing
sudo mkdir -p /mnt/jetjams/home/ubuntu/.ssh
sudo chmod 700 /mnt/jetjams/home/ubuntu/.ssh

# Add YOUR NEW PUBLIC KEY to authorized_keys
# Option A: Append from your recovery key (so you can later use the same key for Jet Jams)
sudo bash -c 'cat >> /mnt/jetjams/home/ubuntu/.ssh/authorized_keys' < ~/.ssh/authorized_keys

# Option B: Or paste the contents of jetjams-recovery.pem's PUBLIC key.
# On your Windows PC, generate public key from the .pem (if needed):
#   ssh-keygen -y -f jetjams-recovery.pem
# Then copy that one line and run on recovery instance:
echo 'PASTE_THE_ONE_LINE_PUBLIC_KEY_HERE' | sudo tee -a /mnt/jetjams/home/ubuntu/.ssh/authorized_keys
```

**Easier Option B (use same key as recovery instance):**  
On the **recovery instance**, the key you used to SSH is already in `~/.ssh/authorized_keys`. So you can copy that into the Jet Jams disk:

```bash
sudo cp /home/ubuntu/.ssh/authorized_keys /mnt/jetjams/home/ubuntu/.ssh/authorized_keys
sudo chown -R 1000:1000 /mnt/jetjams/home/ubuntu/.ssh
sudo chmod 600 /mnt/jetjams/home/ubuntu/.ssh/authorized_keys
```

Unmount and exit:

```bash
sudo umount /mnt/jetjams
exit
```

### Step 1.9: Detach volume from recovery instance and reattach to Jet Jams

1. **EC2** → **Volumes**.
2. Select the Jet Jams volume (attached to `jetjams-recovery-temp`).
3. **Actions** → **Detach volume**.
4. When **State** = **available**, **Actions** → **Attach volume**.
   - **Instance:** `i-02b8cb8da580d0051` (Jet Jams).
   - **Device name:** use the **same** device it had before (e.g. `/dev/sda1` — check the original instance’s block device mapping if unsure).
5. **Attach**.

### Step 1.10: Start Jet Jams instance and terminate recovery instance

1. **EC2** → **Instances**.
2. Select `i-02b8cb8da580d0051` → **Instance state** → **Start instance**.
3. Wait until it’s **Running**. (Public IP may change; check the console for the new **Public IPv4 address**.)
4. **Test SSH** with the **new** key (e.g. `jetjams-recovery.pem`):

   ```bash
   ssh -i "C:\path\to\jetjams-recovery.pem" ubuntu@16.171.134.222
   ```

   If the public IP changed, use the new one.

5. Once you confirm access, **terminate** the temporary recovery instance (`jetjams-recovery-temp`) to avoid extra cost.

---

## Part 2: Deploy / Update Jet Jams Backend

After you can SSH with the new key, use your existing process.

### Step 2.1: SSH into Jet Jams server

```bash
ssh -i "C:\path\to\jetjams-recovery.pem" ubuntu@<JETJAMS_PUBLIC_IP>
```

Use the current **Public IPv4** from the EC2 console (e.g. `16.171.134.222` or the new one after start).

### Step 2.2: Install Node, npm, Git, PM2 (first time only)

```bash
sudo apt update
sudo apt install -y nodejs npm git
sudo npm install -g pm2
```

### Step 2.3: Get the code (first time: clone; later: pull)

**First time:**

```bash
cd ~
git clone <YOUR_BACKEND_REPO_URL> jetjam-be-final
cd jetjam-be-final
```

**Later (updates):**

```bash
cd ~/jetjam-be-final
git pull origin main
```

### Step 2.4: Environment file (first time create, later edit if needed)

```bash
cd ~/jetjam-be-final
nano .env
```

Example (replace with your real values):

```env
PORT=5000
DB_CONNECTION_STRING=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/jetjams
JWT_SECRET_KEY=your_strong_secret_key
APP_NAME=jetjams
DB_NAME=jetjams
EMAIL_FORMAIL=your@gmail.com
EMAILPASSWORD_FORMAIL=app_password
PROTECTED=false
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_secret
PAYPAL_API_URL=https://api-m.paypal.com
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

### Step 2.5: Install dependencies and run with PM2

**First time:**

```bash
cd ~/jetjam-be-final
npm install
pm2 start app.js --name jetjam-api
pm2 save
pm2 startup
```

(Run the command that `pm2 startup` prints so the app restarts after reboot.)

**After code updates:**

```bash
cd ~/jetjam-be-final
git pull origin main
npm install
pm2 restart jetjam-api
```

### Step 2.6: Check

```bash
pm2 status
pm2 logs jetjam-api
```

Test API:  
`http://<JETJAMS_PUBLIC_IP>:5000/jetjams/v1/api/...`  
Ensure the EC2 **Security Group** allows **inbound TCP 5000** (and 22 for SSH).

---

## Quick reference

| Phase | What you do |
|-------|------------------|
| **Recovery** | Create new key → Stop Jet Jams → Detach root volume → Launch recovery instance (same AZ) with new key → Attach volume → Mount → Copy `authorized_keys` from recovery to `/home/ubuntu/.ssh/` on volume → Unmount → Detach → Reattach to Jet Jams as root → Start Jet Jams → SSH with new key → Terminate recovery instance |
| **Deploy** | SSH with new key → clone/pull repo → .env → npm install → pm2 start/restart |

---

## If the instance has a new IP after start

After **Stop** → **Start**, the public IP can change unless you use an **Elastic IP**. Always check **EC2** → **Instances** → **Public IPv4 address** and use that in:

- SSH: `ssh -i "jetjams-recovery.pem" ubuntu@<NEW_IP>`
- API base URL: `http://<NEW_IP>:5000/jetjams/v1/api/...`

To keep the same IP, allocate an **Elastic IP** in the console and associate it with `i-02b8cb8da580d0051`.
