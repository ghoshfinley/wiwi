# WiWi - What I Want Is

A full-stack wishlist creator application built as a monorepo with Next.js frontend and Go backend.

## 🏗️ Project Structure

```
wiwi/
├── frontend/          # Next.js TypeScript React app
├── backend/           # Go REST API server
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Go 1.21+
- SQLite3

### Running the Application

#### 1. Start the Backend

```bash
cd backend
go run main.go
```

The backend API will be available at `http://localhost:8080`

#### 2. Start the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 📦 Frontend

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Features**:
  - Add wishlist items
  - View all wishlist items
  - Delete wishlist items
  - Responsive design
  - Dark mode support

See [frontend/README.md](frontend/README.md) for more details.

## 🔧 Backend

- **Language**: Go
- **Database**: SQLite
- **Features**:
  - REST API endpoints
  - CORS enabled
  - Automatic database creation
  - Health check endpoint

See [backend/README.md](backend/README.md) for more details.

## 🛠️ Development

### Build Frontend

```bash
cd frontend
npm run build
```

### Build Backend

```bash
cd backend
go build -o wiwi-backend
```

### Lint Frontend

```bash
cd frontend
npm run lint
```

## 📝 API Documentation

### Endpoints

- `GET /health` - Health check
- `GET /api/items` - List all wishlist items
- `GET /api/items/:id` - Get specific item
- `POST /api/items` - Create new item
- `DELETE /api/items/:id` - Delete item

### Example Request

```bash
# Create a new wishlist item
curl -X POST http://localhost:8080/api/items \
  -H "Content-Type: application/json" \
  -d '{"title":"New Book","description":"A great book to read","url":"https://example.com"}'
```

## 🌟 Features

- ✅ Full-stack TypeScript/Go application
- ✅ RESTful API design
- ✅ SQLite database
- ✅ Modern React with hooks
- ✅ Responsive UI with Tailwind CSS
- ✅ CORS enabled for local development
- ✅ Environment variable configuration

## 📄 License

MIT
