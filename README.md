# Radiance - Audio Conference System

Минималистичная система аудио-конференций на Go с WebRTC peer-to-peer архитектурой.

## Quick Start

### Требования
- Go 1.22+
- PostgreSQL 14+
- Redis (опционально, для будущих расширений)

### Установка

1. Клонируем репо и настраиваем окружение:
```bash
cp .env.example .env
# Отредактируй .env с твоими credentials
```

2. Создаем БД:
```bash
psql -U postgres -c "CREATE DATABASE radiance;"
```

3. Скачиваем зависимости:
```bash
go mod download
```

4. Запускаем сервер:
```bash
go run main.go
```

Сервер будет доступен на http://localhost:8080

## API Endpoints

### Auth
- `POST /auth/register` - Регистрация (email, password)
- `POST /auth/login` - Вход (email, password)
- `GET /auth/me` - Получить профиль (требует JWT)

### Rooms
- `GET /rooms` - Список активных комнат
- `GET /rooms/{id}` - Получить комнату
- `POST /rooms` - Создать комнату (требует JWT)
- `POST /rooms/{id}/join` - Присоединиться (требует JWT)
- `POST /rooms/{id}/leave` - Выйти (требует JWT)
- `GET /rooms/{id}/participants` - Список участников

### Chat
- `GET /rooms/{id}/messages?limit=50&offset=0` - История сообщений
- `POST /rooms/{id}/messages` - Отправить сообщение (требует JWT)

### WebSocket (Real-time)
- `WS /signaling?room={roomId}` - WebRTC signaling (требует JWT в header)

## Архитектура

```
┌─────────────────┐
│   Браузер       │
│   (WebRTC P2P)  │
└────────┬────────┘
         │
    HTTPS/WSS
         │
┌────────▼────────────────────────────┐
│  Go Backend                         │
│  ├─ HTTP API (Auth, Rooms, Chat)   │
│  ├─ WebSocket Signaling Server     │
│  └─ PostgreSQL Connection Pool     │
└────────┬────────────────────────────┘
         │
    SQL  │
         │
    ┌────▼────────┐
    │ PostgreSQL  │
    └─────────────┘
```

**Mesh WebRTC**: Клиенты подключаются друг к другу напрямую (P2P). Сервер только помогает установить соединение (SDP/ICE).

**限制**: До 5 участников в комнате (совместимость с вычислительными ресурсами mesh архитектуры).

## Development

Структура проекта:
```
.
├── main.go              # Точка входа
├── config/              # Конфигурация
├── models/              # Data models
├── handlers/            # HTTP handlers
├── db/                  # Database
├── middleware/          # Auth middleware
└── signaling/           # WebRTC signaling
```

## Optimization для малого VPS

- Connection pooling (25 max, 5 idle)
- Минимальное логирование
- Graceful shutdown
- Никакого лишнего кода
- Mesh WebRTC вместо SFU (разгруженный сервер)

## Next Steps

1. Frontend на React/Svelte
2. Docker compose для развертывания
3. TURN сервер для NAT traversal
4. Мониторинг и логирование
