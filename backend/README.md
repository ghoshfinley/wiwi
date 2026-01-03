# Backend - WiWi API

Go backend server with SQLite database for the WiWi wishlist application.

## Features

- REST API endpoints for managing wishlist items
- SQLite database for data persistence
- CORS enabled for frontend integration

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/items` - Get all wishlist items
- `GET /api/items/:id` - Get a specific item by ID
- `POST /api/items` - Create a new wishlist item
- `DELETE /api/items/:id` - Delete a wishlist item

## Setup

1. Install dependencies:
   ```bash
   go mod download
   ```

2. Run the server:
   ```bash
   go run main.go
   ```

The server will start on port 8080 by default.

## Environment Variables

- `PORT` - Server port (default: 8080)
- `DB_PATH` - Path to SQLite database file (default: ./wishlist.db)

## Build

```bash
go build -o wiwi-backend
```

## Database

The SQLite database is automatically created on first run with the following schema:

```sql
CREATE TABLE wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
