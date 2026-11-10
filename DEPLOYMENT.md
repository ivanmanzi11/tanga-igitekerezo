# Running Tanga Igitekerezo on phones, tablets and servers

## 1. While developing (any phone or tablet on the same Wi-Fi)

1. Run `.\start-dev.ps1` (or start the two servers by hand: backend
   `python manage.py runserver 0.0.0.0:8000`, frontend `npm run dev`).
2. On the phone open `http://<your-computer-address>:5173` (the script prints it).

Nothing needs configuring: the website finds the backend at the same address it was opened
from, and the backend accepts private-network origins while `DJANGO_DEBUG=True`.
If the phone cannot connect, allow Node.js and Python through Windows Firewall (Private networks).

## 2. Institutional deployment (real server, HTTPS)

Phones install the site to the home screen and use the camera/QR features only over **HTTPS**.

1. Build the website: `cd frontend && npm run build` (creates `frontend/dist`).
2. Run the backend with gunicorn behind a web server (nginx/Caddy/IIS):
   `gunicorn tanga_igitekerezo.wsgi:application --bind 127.0.0.1:8000 --access-logfile /dev/null`
   (`--access-logfile /dev/null` keeps visitors' IP addresses out of the logs, which protects anonymous senders).
3. Serve `frontend/dist` as the website root and proxy `/api` and `/media` to the backend, e.g. nginx:

   ```nginx
   server {
     listen 443 ssl http2;
     server_name suggestions.example.rw;
     root /var/www/tanga/frontend/dist;
     location / { try_files $uri /index.html; }
     location /api/   { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }
     location /media/ { proxy_pass http://127.0.0.1:8000; }
   }
   ```
4. Set these environment variables for the backend:
   `DJANGO_DEBUG=False`, `DJANGO_SECRET_KEY=<long random value>`,
   `DJANGO_ALLOWED_HOSTS=suggestions.example.rw`,
   `CORS_ALLOWED_ORIGINS=https://suggestions.example.rw`.
5. Build the frontend with `VITE_API_URL=https://suggestions.example.rw/api` and
   `VITE_PUBLIC_URL=https://suggestions.example.rw` (this address is printed inside the QR code).

## 3. Devices the interface is built for

Android and iPhone phones (from 320 px wide), tablets in portrait and landscape, laptops and desktops;
Chrome, Edge, Firefox, Safari and Samsung Internet. Layout rules live at the end of `frontend/src/index.css`.
