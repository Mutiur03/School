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
docker exec ontainer-name pg_dump -U user dbname > backup.sql
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