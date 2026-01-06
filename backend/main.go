package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type WishlistItem struct {
	ID          int    `json:"id"`
	UserUUID    string `json:"user_uuid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	CreatedAt   string `json:"created_at"`
}

type User struct {
	UUID      string `json:"uuid"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Password  string `json:"password,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
}

type AuthResponse struct {
	UUID  string `json:"uuid"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var db *sql.DB

func main() {
	var err error

	// Initialize database
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./wishlist.db"
	}

	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Create users table
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		uuid TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		name TEXT,
		password_hash TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	_, err = db.Exec(createUsersTable)
	if err != nil {
		log.Fatal("Failed to create users table:", err)
	}

	// Create wishlist_items table with user_uuid
	createTable := `
	CREATE TABLE IF NOT EXISTS wishlist_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_uuid TEXT,
		title TEXT NOT NULL,
		description TEXT,
		url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_uuid) REFERENCES users(uuid)
	);`

	_, err = db.Exec(createTable)
	if err != nil {
		log.Fatal("Failed to create table:", err)
	}

	// Migrate existing table: add user_uuid column if it doesn't exist
	addColumnSQL := `ALTER TABLE wishlist_items ADD COLUMN user_uuid TEXT;`
	_, err = db.Exec(addColumnSQL)
	// Ignore error if column already exists
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		log.Printf("Migration note: %v (this is okay if column already exists)", err)
	}

	// Set up routes
	http.HandleFunc("/api/auth/signup", corsMiddleware(handleSignup))
	http.HandleFunc("/api/auth/login", corsMiddleware(handleLogin))
	http.HandleFunc("/api/users/", corsMiddleware(handleUsers))
	http.HandleFunc("/api/items", corsMiddleware(handleItems))
	http.HandleFunc("/api/items/", corsMiddleware(handleItemByID))
	http.HandleFunc("/health", corsMiddleware(handleHealth))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Server starting on port %s...", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
		if allowedOrigin == "" {
			allowedOrigin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleSignup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid request body"})
		return
	}

	// Validate required fields
	if user.Email == "" || user.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Email and password are required"})
		return
	}

	// Generate UUID
	userUUID := uuid.New().String()

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Failed to process password"})
		return
	}

	// Insert user into database
	_, err = db.Exec("INSERT INTO users (uuid, email, name, password_hash) VALUES (?, ?, ?, ?)",
		userUUID, user.Email, user.Name, string(hashedPassword))
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "Email already exists"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Failed to create user"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		UUID:  userUUID,
		Email: user.Email,
		Name:  user.Name,
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var credentials User
	err := json.NewDecoder(r.Body).Decode(&credentials)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid request body"})
		return
	}

	// Retrieve user from database
	var user User
	var passwordHash string
	err = db.QueryRow("SELECT uuid, email, name, password_hash FROM users WHERE email = ?", credentials.Email).
		Scan(&user.UUID, &user.Email, &user.Name, &passwordHash)

	if err == sql.ErrNoRows {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid email or password"})
		return
	} else if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Failed to authenticate"})
		return
	}

	// Compare passwords
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(credentials.Password))
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid email or password"})
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		UUID:  user.UUID,
		Email: user.Email,
		Name:  user.Name,
	})
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract user UUID from path: /api/users/{uuid}, /api/users/{uuid}/items, or /api/users/{uuid}/items/{id}
	path := r.URL.Path
	parts := strings.Split(strings.Trim(path, "/"), "/")
	
	// Filter out empty parts
	var filteredParts []string
	for _, part := range parts {
		if part != "" {
			filteredParts = append(filteredParts, part)
		}
	}
	parts = filteredParts

	if len(parts) < 3 || parts[0] != "api" || parts[1] != "users" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	userUUID := parts[2]

	// Check if it's an item-specific operation
	if len(parts) >= 5 && parts[3] == "items" {
		// /api/users/{uuid}/items/{id}
		itemID, err := strconv.Atoi(parts[4])
		if err != nil {
			http.Error(w, "Invalid item ID", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case "DELETE":
			deleteUserItem(w, r, userUUID, itemID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	if len(parts) == 4 && parts[3] == "items" {
		// /api/users/{uuid}/items
		switch r.Method {
		case "GET":
			getUserItems(w, r, userUUID)
		case "POST":
			createUserItem(w, r, userUUID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	if len(parts) == 3 {
		// /api/users/{uuid} - get user info
		switch r.Method {
		case "GET":
			getUserInfo(w, r, userUUID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.Error(w, "Invalid path", http.StatusBadRequest)
}

func getUserInfo(w http.ResponseWriter, r *http.Request, userUUID string) {
	var user User
	err := db.QueryRow("SELECT uuid, email, name FROM users WHERE uuid = ?", userUUID).
		Scan(&user.UUID, &user.Email, &user.Name)

	if err == sql.ErrNoRows {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(user)
}

func getUserItems(w http.ResponseWriter, r *http.Request, userUUID string) {
	rows, err := db.Query("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, created_at FROM wishlist_items WHERE user_uuid = ? ORDER BY created_at DESC", userUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []WishlistItem{}
	for rows.Next() {
		var item WishlistItem
		var createdAt time.Time
		err := rows.Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &createdAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		items = append(items, item)
	}

	json.NewEncoder(w).Encode(items)
}

func createUserItem(w http.ResponseWriter, r *http.Request, userUUID string) {
	var item WishlistItem
	err := json.NewDecoder(r.Body).Decode(&item)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if item.Title == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("INSERT INTO wishlist_items (user_uuid, title, description, url) VALUES (?, ?, ?, ?)",
		userUUID, item.Title, item.Description, item.URL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	item.ID = int(id)
	item.UserUUID = userUUID
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func deleteUserItem(w http.ResponseWriter, r *http.Request, userUUID string, itemID int) {
	result, err := db.Exec("DELETE FROM wishlist_items WHERE id = ? AND user_uuid = ?", itemID, userUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleItems(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		getItems(w, r)
	case "POST":
		createItem(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleItemByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract ID from URL path
	path := r.URL.Path
	idStr := path[len("/api/items/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		getItemByID(w, r, id)
	case "DELETE":
		deleteItem(w, r, id)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func getItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, created_at FROM wishlist_items ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []WishlistItem{}
	for rows.Next() {
		var item WishlistItem
		var createdAt time.Time
		err := rows.Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &createdAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		items = append(items, item)
	}

	json.NewEncoder(w).Encode(items)
}

func getItemByID(w http.ResponseWriter, r *http.Request, id int) {
	var item WishlistItem
	var createdAt time.Time

	err := db.QueryRow("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, created_at FROM wishlist_items WHERE id = ?", id).
		Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &createdAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	item.CreatedAt = createdAt.Format(time.RFC3339)
	json.NewEncoder(w).Encode(item)
}

func createItem(w http.ResponseWriter, r *http.Request) {
	var item WishlistItem
	err := json.NewDecoder(r.Body).Decode(&item)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if item.Title == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}

	var result sql.Result
	// Try to insert with user_uuid, if column doesn't exist, insert without it
	result, err = db.Exec("INSERT INTO wishlist_items (user_uuid, title, description, url) VALUES (?, ?, ?, ?)",
		item.UserUUID, item.Title, item.Description, item.URL)
	if err != nil && strings.Contains(err.Error(), "no such column") {
		// Fallback for old database schema
		result, err = db.Exec("INSERT INTO wishlist_items (title, description, url) VALUES (?, ?, ?)",
			item.Title, item.Description, item.URL)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	item.ID = int(id)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func deleteItem(w http.ResponseWriter, r *http.Request, id int) {
	result, err := db.Exec("DELETE FROM wishlist_items WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
