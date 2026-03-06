# SSH "Connection timed out" – Fix

## 1. Instance Running ho aur sahi IP use karo

- **AWS Console** → **EC2** → **Instances**.
- **Jet Jams Server** select karo.
- **Instance state** = **Running** hona chahiye. Agar **Stopped** hai to **Start instance** karo.
- **Public IPv4 address** copy karo (start ke baad IP **change** ho sakti hai – hamesha yahi nayi use karo).

---

## 2. Security Group – Port 22 (SSH) open karo

- Same **Instances** list mein, apne instance pe click karo.
- Neeche **Security** tab ya **Security groups** ka link hoga → us Security Group pe click karo (e.g. `sg-xxxxx`).
- **Inbound rules** → **Edit inbound rules**.
- Rule add / check karo:

  | Type   | Port | Source        |
  |--------|------|---------------|
  | SSH    | 22   | **My IP**     |

  **My IP** se sirf tumhare current internet IP se SSH chalega (recommended).

  Ya (kam secure, test ke liye):

  | Type   | Port | Source      |
  |--------|------|-------------|
  | SSH    | 22   | **0.0.0.0/0** |

  **Save rules**.

- Thodi der (10–20 sec) wait karke dubara try karo:

  ```powershell
  ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" ubuntu@<PUBLIC_IP>
  ```

---

## 3. Agar ab bhi timeout aaye

- **Firewall / office WiFi** kabhi outbound port 22 block karti hai. **Mobile hotspot** se try karo.
- **IP sahi hai?** Instance stop/start ke baad nayi Public IP milti hai – console wali **current** IP use karo.
- **Region** sahi hai? Instance **eu-north-1** (Stockholm) mein hai – koi VPN us region se different country dikha raha ho to disconnect karke try karo.

---

## 4. Test command (sirf SSH check)

```powershell
ssh -i "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem" -v ubuntu@16.171.134.222
```

`-v` se detailed log aata hai. Agar "Connection timed out" hi dikhe to problem network / security group hai; agar "Permission denied (publickey)" aaye to key sahi hai, problem sirf key/auth ki.
