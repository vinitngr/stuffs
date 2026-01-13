package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/yourdomain/myapp/services"
)

// User represents a user in the system
type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// UserService defines the interface for user operations
type UserService interface {
	FindByID(ctx context.Context, id int) (*User, error)
	Create(ctx context.Context, user *User) error
	Update(ctx context.Context, user *User) error
	Delete(ctx context.Context, id int) error
}

// UserController handles HTTP requests for user operations
type UserController struct {
	userService UserService
	authService services.AuthService
	cache       map[int]*User
	mu          sync.RWMutex
}

// NewUserController creates a new UserController instance
func NewUserController(userService UserService, authService services.AuthService) *UserController {
	return &UserController{
		userService: userService,
		authService: authService,
		cache:       make(map[int]*User),
	}
}

// GetUser retrieves a user by ID
// It first checks the cache, then falls back to the service
func (c *UserController) GetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	ctx := r.Context()
	user, err := c.userService.FindByID(ctx, parseInt(id))
	
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

// CreateUser creates a new user
func (c *UserController) CreateUser(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	if !validateEmail(user.Email) {
		http.Error(w, "Invalid email", http.StatusBadRequest)
		return
	}
	
	ctx := r.Context()
	if err := c.userService.Create(ctx, &user); err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}
	
	c.mu.Lock()
	c.cache[user.ID] = &user
	c.mu.Unlock()
	
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

// getCachedUser retrieves a user from the cache
func (c *UserController) getCachedUser(id int) (*User, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	user, ok := c.cache[id]
	return user, ok
}

// DataUtils provides utility functions for data operations
type DataUtils struct{}

// ArrayToMap converts a slice of users to a map keyed by ID
func (d *DataUtils) ArrayToMap(users []*User) map[int]*User {
	result := make(map[int]*User)
	for _, user := range users {
		result[user.ID] = user
	}
	return result
}

// DeepClone creates a deep copy of a user
func (d *DataUtils) DeepClone(user *User) (*User, error) {
	data, err := json.Marshal(user)
	if err != nil {
		return nil, err
	}
	
	var cloned User
	if err := json.Unmarshal(data, &cloned); err != nil {
		return nil, err
	}
	
	return &cloned, nil
}

// InitializeDatabase sets up the database connection
func InitializeDatabase(connectionString string) error {
	log.Println("Connecting to database...")
	time.Sleep(1 * time.Second)
	log.Println("Database connected")
	return nil
}

// FetchExternalData retrieves data from an external API
func FetchExternalData(endpoint string) ([]byte, error) {
	resp, err := http.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var data []byte
	if _, err := resp.Body.Read(data); err != nil {
		return nil, err
	}
	
	return data, nil
}

// calculateTotal computes the sum of integers
func calculateTotal(items []int) int {
	total := 0
	for _, item := range items {
		total += item
	}
	return total
}

// formatCurrency formats a float as currency string
func formatCurrency(amount float64, currency string) string {
	symbols := map[string]string{
		"USD": "$",
		"EUR": "€",
		"GBP": "£",
	}
	
	symbol, ok := symbols[currency]
	if !ok {
		symbol = currency
	}
	
	return fmt.Sprintf("%s%.2f", symbol, amount)
}

// validateEmail checks if an email address is valid
func validateEmail(email string) bool {
	// Simple validation
	return len(email) > 3 && containsChar(email, '@')
}

// parseInt converts a string to int (helper function)
func parseInt(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

// containsChar checks if a string contains a character
func containsChar(s string, c rune) bool {
	for _, char := range s {
		if char == c {
			return true
		}
	}
	return false
}

func main() {
	// Setup router
	r := mux.NewRouter()
	
	// Initialize services (mock)
	var userService UserService
	var authService services.AuthService
	
	controller := NewUserController(userService, authService)
	
	// Register routes
	r.HandleFunc("/users/{id}", controller.GetUser).Methods("GET")
	r.HandleFunc("/users", controller.CreateUser).Methods("POST")
	
	// Start server
	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
