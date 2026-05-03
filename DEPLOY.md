# Развертывание на VPS

## Вариант 1: Docker Compose (рекомендуется)

### На локальной машине:
```bash
# Собираем образ
docker build -t radiance:latest .

# Тестируем локально
docker-compose up

# Проверяем http://localhost:8080
curl http://localhost:8080/rooms
```

### На VPS:
```bash
# 1. Устанавливаем Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 2. Клонируем репо
git clone <repo-url> radiance
cd radiance

# 3. Настраиваем переменные окружения
cp .env.example .env
nano .env  # Отредактировать!
# Важно: JWT_SECRET должен быть минимум 32 символа

# 4. Запускаем с Docker Compose
docker-compose up -d

# 5. Проверяем логи
docker-compose logs -f app

# 6. Настраиваем Nginx как reverse proxy (смотри ниже)
```

## Вариант 2: Native Go (если Docker не поддерживается)

### На VPS:
```bash
# 1. Устанавливаем зависимости
sudo apt-get update
sudo apt-get install -y postgresql-client-15 git

# 2. Устанавливаем Go 1.22
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 3. Клонируем и запускаем
git clone <repo-url> radiance
cd radiance

cp .env.example .env
nano .env

go mod download
go build -o radiance .

# 4. Создаем systemd service
sudo tee /etc/systemd/system/radiance.service > /dev/null <<EOF
[Unit]
Description=Radiance Audio Conference
After=network.target

[Service]
Type=simple
User=radiance
WorkingDirectory=/home/radiance/radiance
ExecStart=/home/radiance/radiance/radiance
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable radiance
sudo systemctl start radiance

# 5. Проверяем статус
sudo systemctl status radiance
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        
        # Для WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Сохраняем в `/etc/nginx/sites-available/radiance` и включаем:
```bash
sudo ln -s /etc/nginx/sites-available/radiance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL сертификат (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Мониторинг

```bash
# Логи Docker
docker-compose logs -f app

# Логи systemd
sudo journalctl -u radiance -f

# Проверка здоровья
curl https://your-domain.com/rooms
```

## Оптимизация для малого VPS (~1GB RAM)

1. **PostgreSQL**: Уменьшаем `shared_buffers` и `work_mem`
2. **Go app**: Connection pool уже оптимизирован (25 max, 5 idle)
3. **Swap**: Добавляем 2GB swap если RAM мало
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## Масштабирование

Если нужно поддержать больше комнат:
- Текущая настройка: до 5 участников в mesh mode
- Для большей нагрузки: добавить Redis для кэширования состояния комнат
- Потом: можно перейти на SFU (Mediasoup) если нужно >10 участников
