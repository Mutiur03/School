echo "Starting all services..."

# Frontend 1
cd client || exit
npm run dev &
echo "Client started"
cd ..

# Frontend 2
cd admin || exit
npm run dev &
echo "Admin started"
cd ..


# Backend
cd server || exit
npm run dev &
echo "Backend started"

echo "✅ All services are running"
wait
