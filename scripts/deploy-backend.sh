#!/bin/bash -e

user=main
host=backend.vatiris.se

cd "$(dirname $0)/.."

rm -rf build backend/dist

cd backend
npm install
npm run build
cd ..

mkdir -p build
cp -r backend/dist/* build/
cp -r backend/migrations build/

rm -f backend.zip
cd build
zip -r ../backend.zip .
cd ..

scp backend.zip $user@$host:
ssh $user@$host unzip -o backend.zip -d backend

# scp scripts/vatiris-backend.service $user@$host:backend/
# ssh $user@$host "sudo mv ~/backend/vatiris-backend.service /etc/systemd/system/vatiris-backend.service"
# ssh $user@$host "sudo systemctl daemon-reload"
# ssh $user@$host "sudo systemctl enable vatiris-backend"

ssh $user@$host "sudo systemctl restart vatiris-backend"

rm -f backend.zip
echo "Deployed to $host"
echo "Don't forget migrations, if any..."
