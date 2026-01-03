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
	ID              int      `json:"id"`
	UserUUID        string   `json:"user_uuid"`
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	URL             string   `json:"url"`
	InterestedNames []string `json:"interested_names"`
	BoughtByNames   []string `json:"bought_by_names"`
	CreatedAt       string   `json:"created_at"`
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
		wishlist_name TEXT,
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
	_, _ = db.Exec(addColumnSQL)

	// Migrate users table: add wishlist_name column if it doesn't exist
	addWishlistNameSQL := `ALTER TABLE users ADD COLUMN wishlist_name TEXT;`
	_, _ = db.Exec(addWishlistNameSQL)

	// Migrate wishlist_items: add interested_count, interested_names, is_bought, and bought_by_name columns
	_, _ = db.Exec(`ALTER TABLE wishlist_items ADD COLUMN interested_count INTEGER DEFAULT 0;`)
	_, _ = db.Exec(`ALTER TABLE wishlist_items ADD COLUMN interested_names TEXT DEFAULT '[]';`)
	_, _ = db.Exec(`ALTER TABLE wishlist_items ADD COLUMN is_bought BOOLEAN DEFAULT 0;`)
	_, _ = db.Exec(`ALTER TABLE wishlist_items ADD COLUMN bought_by_names TEXT DEFAULT '[]';`)

	// Set up routes
	http.HandleFunc("/api/auth/signup", corsMiddleware(handleSignup))
	http.HandleFunc("/api/auth/login", corsMiddleware(handleLogin))
	http.HandleFunc("/api/users/", corsMiddleware(handleUserRoutes))
	http.HandleFunc("/api/items", corsMiddleware(handleItems))
	http.HandleFunc("/api/items/", corsMiddleware(handleItemRoutes))
	http.HandleFunc("/health", corsMiddleware(handleHealth))
	addr := "0.0.0.0:8081"

	log.Printf("Server starting on %s...", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
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

func handleUserRoutes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract user UUID from path: /api/users/{uuid}...
	path := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(path, "/")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	userUUID := parts[2]

	// Handle /api/users/{uuid}
	if len(parts) == 3 {
		switch r.Method {
		case "GET":
			getUserInfo(w, r, userUUID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// Handle /api/users/{uuid}/items...
	if parts[3] == "items" {
		if len(parts) == 4 {
			switch r.Method {
			case "GET":
				getUserItems(w, r, userUUID)
			case "POST":
				createUserItem(w, r, userUUID)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if len(parts) == 5 {
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
	rows, err := db.Query("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, COALESCE(interested_names, '[]'), COALESCE(bought_by_names, '[]'), created_at FROM wishlist_items WHERE user_uuid = ? ORDER BY created_at DESC", userUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []WishlistItem{}
	for rows.Next() {
		var item WishlistItem
		var createdAt time.Time
		var namesJSON string
		var buyersJSON string
		err := rows.Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &namesJSON, &buyersJSON, &createdAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.Unmarshal([]byte(namesJSON), &item.InterestedNames)
		if item.InterestedNames == nil {
			item.InterestedNames = []string{}
		}

		json.Unmarshal([]byte(buyersJSON), &item.BoughtByNames)
		if item.BoughtByNames == nil {
			item.BoughtByNames = []string{}
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

func handleItemRoutes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(path, "/")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(parts[2])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	if len(parts) == 3 {
		switch r.Method {
		case "GET":
			getItemByID(w, r, id)
		case "DELETE":
			deleteItem(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	if len(parts) == 4 {
		action := parts[3]
		var req struct {
			Name string `json:"name"`
		}

		if r.Method == "POST" {
			json.NewDecoder(r.Body).Decode(&req)
			log.Printf("Action %s on item %d by %s", action, id, req.Name)

			switch action {
			case "interest":
				interestItem(w, r, id, req.Name)
			case "buy":
				buyItem(w, r, id, req.Name)
			default:
				http.Error(w, "Invalid action", http.StatusBadRequest)
			}
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.Error(w, "Invalid path", http.StatusBadRequest)
}

func interestItem(w http.ResponseWriter, r *http.Request, id int, name string) {
	var namesJSON string
	err := db.QueryRow("SELECT COALESCE(interested_names, '[]') FROM wishlist_items WHERE id = ?", id).Scan(&namesJSON)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var names []string
	json.Unmarshal([]byte(namesJSON), &names)

	// Check if name already exists
	exists := false
	for _, n := range names {
		if n == name {
			exists = true
			break
		}
	}

	if !exists {
		names = append(names, name)
		newNamesJSON, _ := json.Marshal(names)
		_, err = db.Exec("UPDATE wishlist_items SET interested_names = ? WHERE id = ?", string(newNamesJSON), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "interest marked"})
}

func buyItem(w http.ResponseWriter, r *http.Request, id int, name string) {
	var buyersJSON string
	err := db.QueryRow("SELECT COALESCE(bought_by_names, '[]') FROM wishlist_items WHERE id = ?", id).Scan(&buyersJSON)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var buyers []string
	json.Unmarshal([]byte(buyersJSON), &buyers)

	// Check if name already exists
	exists := false
	for _, b := range buyers {
		if b == name {
			exists = true
			break
		}
	}

	if !exists {
		buyers = append(buyers, name)
		newBuyersJSON, _ := json.Marshal(buyers)
		_, err = db.Exec("UPDATE wishlist_items SET bought_by_names = ? WHERE id = ?", string(newBuyersJSON), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "item bought"})
}



func getItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, COALESCE(interested_names, '[]'), COALESCE(bought_by_names, '[]'), created_at FROM wishlist_items ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []WishlistItem{}
	for rows.Next() {
		var item WishlistItem
		var createdAt time.Time
		var namesJSON string
		var buyersJSON string
		err := rows.Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &namesJSON, &buyersJSON, &createdAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.Unmarshal([]byte(namesJSON), &item.InterestedNames)
		if item.InterestedNames == nil {
			item.InterestedNames = []string{}
		}

		json.Unmarshal([]byte(buyersJSON), &item.BoughtByNames)
		if item.BoughtByNames == nil {
			item.BoughtByNames = []string{}
		}

		item.CreatedAt = createdAt.Format(time.RFC3339)
		items = append(items, item)
	}

	json.NewEncoder(w).Encode(items)
}

func getItemByID(w http.ResponseWriter, r *http.Request, id int) {
	var item WishlistItem
	var createdAt time.Time
	var namesJSON string
	var buyersJSON string

	err := db.QueryRow("SELECT id, COALESCE(user_uuid, '') as user_uuid, title, description, url, COALESCE(interested_names, '[]'), COALESCE(bought_by_names, '[]'), created_at FROM wishlist_items WHERE id = ?", id).
		Scan(&item.ID, &item.UserUUID, &item.Title, &item.Description, &item.URL, &namesJSON, &buyersJSON, &createdAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.Unmarshal([]byte(namesJSON), &item.InterestedNames)
	if item.InterestedNames == nil {
		item.InterestedNames = []string{}
	}

	json.Unmarshal([]byte(buyersJSON), &item.BoughtByNames)
	if item.BoughtByNames == nil {
		item.BoughtByNames = []string{}
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
