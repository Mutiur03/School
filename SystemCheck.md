---

## 1️⃣ The basics: NGINX access log (THIS IS THE SOURCE OF TRUTH)

### Default log location

```bash
/var/log/nginx/access.log
```

Each line = **1 HTTP request**

---

## 2️⃣ How many requests total?

### Today

```bash
wc -l /var/log/nginx/access.log
```

### Last 1 hour

```bash
awk '$4 ~ /\[15\/Dec\/2025:0[7-8]/' /var/log/nginx/access.log | wc -l
```

### Last 24 hours

```bash
awk '$4 ~ /\[15\/Dec\/2025/' /var/log/nginx/access.log | wc -l
```

---

## 3️⃣ How many unique users (approx)?

NGINX doesn’t know “users”, only **IP addresses**.

### Unique IPs (approx users)

```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq | wc -l
```

📌 This is **NOT perfect**:

- NAT / mobile networks = many users, 1 IP
- Bots inflate numbers

But it’s still useful.

---

## 4️⃣ Requests per second (RPS)

### Average RPS

```bash
echo "$(wc -l < /var/log/nginx/access.log) / 86400" | bc
```

---

## 5️⃣ Top IPs hitting your server

```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

Good to detect:

- bots
- crawlers
- attackers

---

## 6️⃣ Which endpoints are most hit?

```bash
awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

---

## 7️⃣ How many requests per minute (timeline)

```bash
awk '{print substr($4,2,17)}' /var/log/nginx/access.log \
| sort | uniq -c | sort -n
```

This shows traffic spikes clearly.

---

## 8️⃣ Enable REAL-TIME stats (nginx stub_status) 🔥

This shows **live traffic**.

### Enable it

Edit nginx config:

```bash
sudo nano /etc/nginx/conf.d/status.conf
```

Add:

```nginx
server {
    listen 127.0.0.1:80;
    location /nginx_status {
        stub_status;
        allow 127.0.0.1;
        deny all;
    }
}
```

Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Check:

```bash
curl http://127.0.0.1/nginx_status
```

Output example:

```
Active connections: 3
server accepts handled requests
 120934 120934 453921
```

The last number = **total requests since NGINX started**

---

## 9️⃣ Real users vs bots (IMPORTANT)

Most “users” are:

- Googlebot
- uptime monitors
- scanners

### Top user agents

```bash
awk -F\" '{print $6}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

---

https://chatgpt.com/c/693fad50-bd58-8322-b6b4-9083bf85fec1

```
sar -r | awk '
NR==1 {print "TIME\t\tfree(GB)\tavail(GB)\tused(GB)\t%used"}
NR>3 {
  printf "%s\t%.2f\t\t%.2f\t\t%.2f\t\t%s\n",
  $1,
  $2/1048576,
  $3/1048576,
  $4/1048576,
  $5
}'
```

```
sar -u | awk 'NR>3 {u+=$3; s+=$5; i+=$8; n++} END {
printf "Avg user: %.2f%% | Avg system: %.2f%% | Avg idle: %.2f%%\n",
u/n, s/n, i/n
}'
```
```
awk '{
uri=$7; # requested URI
status=$9; # HTTP status code
bytes=$10; # response size
upstream="-"; # backend address

    # loop through fields to find upstream and user-agent
    for(i=1;i<=NF;i++){
        if($i ~ /^upstream=/){
            split($i,a,"=");
            upstream=a[2];
        }

    }
    print client, uri, upstream, status, bytes, useragent

}' /var/log/nginx/access.log
```
```
awk '{count[$7]++} END {for (uri in count) print count[uri], uri}' /var/log/nginx/access.log | sort -nr
```
```
awk '{
    upstream="-";
    for(i=1;i<=NF;i++){
        if($i ~ /^upstream=/){
            split($i,a,"="); 
            upstream=a[2];
        }
    }
    count[upstream,$7]++
} END {
    for (key in count) {
        split(key,k,SUBSEP);
        print count[key], k[1], k[2]
    }
}' /var/log/nginx/access.log | sort -nr
```




```
docker exec container-name pg_dump -U user dbname > backup.sql
```
```
docker run -d \
  --name pg-temp \
  -v volume_name:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=password \
  postgres:17
```
```
docker exec -it pg-temp pg_dump -U user dbname > backup.sql
```
```
docker exec -i container-name psql -U user dbname < backup.sql
```
```
kill $(lsof -t -i:3000)
```



Make sure Postgres is stopped in both old and new containers.
then to rename volume
```
docker run --rm -it \
  -v my_old_volume:/from \
  -v my_new_volume:/to \
  alpine sh -c "cp -a /from/. /to/"
```
docker system df

docker system prune -a

docker builder prune -a

docker build -f server/Dockerfile -t school-server .
docker build --no-cache -fserver/Dockerfile -t school-server .

-- Backup
#!/bin/bash

# Configuration
CONTAINER_NAME="lbp-postgres_school-1"
DB_USER="mutiur"
DB_NAME="school"

GDRIVE_REMOTE="School_Drive"
LOCAL_TMP_DIR="/root/db_temp"
TIMESTAMP=$(date "+%Y-%m-%d_%H-%M")

# Custom compressed binary format (.dump) handles FK dependencies automatically during restore
BACKUP_FILE="${LOCAL_TMP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

echo "=== Docker DB Backup Started at $(date) ==="

# 1. Clean up and create temporary workspace
rm -rf "$LOCAL_TMP_DIR"
mkdir -p "$LOCAL_TMP_DIR"

# 2. Run pg_dump inside the running Docker container
# Using '-F c' (custom format) allows clean restoration without FK order errors
echo "Executing pg_dump inside container..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -F c "$DB_NAME" > "$BACKUP_FILE"

# 3. Check if the backup file was successfully created and is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty or database dump failed!"
    exit 1
fi

# 4. Upload the single .dump file directly to Google Drive
echo "Uploading custom binary dump to Google Drive..."
rclone copy "$BACKUP_FILE" "${GDRIVE_REMOTE}:PostgresBackups" --quiet

# 5. Clean up local temporary files
echo "Cleaning up local files..."
rm -rf "$LOCAL_TMP_DIR"

# 6. Automatically delete backups older than 7 days from Google Drive
echo "Cleaning up backups older than 7 days from Google Drive..."
rclone delete "${GDRIVE_REMOTE}:PostgresBackups" --min-age 7d --rmdirs --quiet

echo "=== Docker DB Backup Completed Successfully at $(date) ==="

-- Restore 
docker exec -i prod-postgres_school-1 pg_restore -U mutiur -d school --clean --no-owner < ./school_2026-08-07_10-51.dump


-- As superuser/owner
GRANT USAGE ON SCHEMA app TO school_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO school_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO school_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO school_app;