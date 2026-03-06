# JetJams Backend - Deploy to EC2
# Usage: .\deploy-to-ec2.ps1 -IP "16.171.134.222"
#        .\deploy-to-ec2.ps1 -IP "16.171.134.222" -FirstTime
# Before running: Start your EC2 instance from AWS Console and use the current Public IP.

param(
    [Parameter(Mandatory=$true)]
    [string]$IP,
    [switch]$FirstTime
)

$PemPath = "C:\Users\wajiz.pk\Downloads\jetjamsserver.pem"
$RepoUrl = "https://github.com/TeamInterNativeLabs/jetjam-be-final.git"

if (-not (Test-Path $PemPath)) {
    Write-Host "ERROR: PEM file not found at: $PemPath" -ForegroundColor Red
    exit 1
}

if ($FirstTime) {
    Write-Host "First-time setup: installing Node/PM2, cloning repo, npm install..." -ForegroundColor Cyan
    $remoteScript = @"
set -e
export DEBIAN_FRONTEND=noninteractive
command -v node >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq nodejs npm git; }
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
cd ~
[ -d jetjam-be-final ] || git clone $RepoUrl jetjam-be-final
cd jetjam-be-final
git pull origin main 2>/dev/null || true
npm install
echo 'DONE. Now create .env and start app:'
echo '  nano .env   (add PORT, DB_CONNECTION_STRING, JWT_SECRET_KEY, APP_NAME, PAYPAL_*, etc.)'
echo '  pm2 start app.js --name jetjam-api'
echo '  pm2 save && pm2 startup'
"@
    $remoteScript | ssh -i $PemPath -o StrictHostKeyChecking=accept-new ubuntu@$IP "bash -s"
} else {
    Write-Host "Updating: git pull, npm install, pm2 restart..." -ForegroundColor Cyan
    ssh -i $PemPath ubuntu@$IP "cd ~/jetjam-be-final && git pull origin main && npm install && pm2 restart jetjam-api"
    Write-Host "Deploy done. Check: pm2 status" -ForegroundColor Green
}
