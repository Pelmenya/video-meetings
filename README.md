# video-meetings

Монорепозиторий сервиса видеовстреч: планирование встреч с хостом и участниками, регистрация и вход по JWT.

Проект в активной разработке — сейчас готовы аутентификация и CRUD встреч на бэкенде, на фронтенде страницы регистрации и входа.

## Стек

| | |
|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, HeroUI v3 |
| `apps/api` | NestJS 11, TypeScript, Prisma 6, CQRS, JWT, bcrypt, Jest |
| Инфраструктура | npm workspaces, PostgreSQL 17 + pgAdmin в Docker Compose, Husky |

## Быстрый старт

Нужны Node.js 20+, npm 10+ и Docker.

```bash
git clone https://github.com/Pelmenya/video-meetings.git
cd video-meetings
npm install

# переменные окружения — скопировать примеры и при желании поправить
cp .env.example .env                     # доступы к Postgres и pgAdmin
cp apps/api/.env.example apps/api/.env   # DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGIN
cp apps/web/.env.example apps/web/.env   # NEXT_PUBLIC_API_URL

npm run db:up                            # Postgres на :5435, pgAdmin на :5050
cd apps/api && npx prisma migrate deploy && cd ../..   # применить миграции Prisma

npm run dev                              # web на :3000, api на :3001
```

Обязательно смените `JWT_SECRET` в `apps/api/.env` — в примере лежит заглушка `change-me`.

## Команды

Запускаются из корня репозитория, у каждой есть вариант для одного воркспейса с суффиксом `:web` / `:api`.

```bash
npm run dev            # оба приложения параллельно
npm run build          # сборка обоих
npm run start          # продакшен-режим
npm run lint           # линт обоих приложений
npm run format         # prettier --write
npm run test           # unit-тесты apps/api (*.spec.ts)
npm run test:e2e       # e2e-тесты apps/api, требуют поднятой БД
npm run db:up          # поднять Postgres + pgAdmin
npm run db:down        # остановить их
npm run db:logs        # логи контейнеров
```

Точечно по воркспейсу: `npm run <script> -w web` или `-w api`.

## Структура

```
apps/
  web/        Next.js: /register, /login, главная за авторизацией
  api/        NestJS: модули auth, users, meetings + Prisma
docker/       конфиг pgAdmin (преднастроенное подключение к Postgres)
```

Бэкенд построен на CQRS: каждый модуль раскладывается на `commands/` и `queries/` с парами impl + handler, HTTP-контроллеры только диспатчат их через `CommandBus` / `QueryBus`. Модуль `users` владеет всем доступом к таблице пользователей и не имеет своего HTTP-слоя — `auth` и `meetings` обращаются к нему только через шину.

## API

| Метод | Эндпоинт | Доступ | Описание |
|---|---|---|---|
| `POST` | `/auth/register` | публично | Регистрация, возвращает access token |
| `POST` | `/auth/login` | публично | Вход по email и паролю |
| `POST` | `/meetings` | JWT | Создать встречу |
| `GET` | `/meetings` | JWT | Встречи, где пользователь хост или участник |
| `GET` | `/meetings/:id` | JWT | Одна встреча |
| `PATCH` | `/meetings/:id` | JWT | Обновить встречу |
| `DELETE` | `/meetings/:id` | JWT | Удалить встречу |

Встреча видна и редактируема только её хосту и участникам — остальные получают отказ на уровне доступа, а не фильтрации выдачи.

## Модель данных

`User` — id, email (уникальный), хеш пароля. `Meeting` — заголовок, дата, статус (`SCHEDULED` / `ONGOING` / `ENDED` / `CANCELLED`), хост и список участников (многие-ко-многим).

## База данных

Docker Compose поднимает Postgres 17 на хост-порту `5435` и pgAdmin на `5050` — порты выбраны так, чтобы не конфликтовать с контейнерами других проектов на той же машине. pgAdmin получает преднастроенное подключение из `docker/pgadmin/servers.json`, останется ввести только пароль БД при первом входе.

## Git-хуки

Husky ставит `pre-commit`, который последовательно гоняет `npm run lint`, `npm run test` и `npm run test:e2e`; коммит блокируется при падении любого шага. Для e2e нужна поднятая база (`npm run db:up`) — иначе коммит упадёт на ошибке подключения, а не на реальном тесте. Хуки ставятся скриптом `prepare` при `npm install` в корне.
