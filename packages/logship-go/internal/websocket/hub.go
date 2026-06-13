package websocket

import (
	"context"
	"log/slog"
	"sync"
)

const (
	// Max clients per project
	MaxClientsPerProject = 50
)

type Hub struct {
	clients    map[string]map[*Client]bool // projectID -> clients
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

type Message struct {
	ProjectID string
	Data      []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan *Message, 512),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-h.register:
			h.mutex.Lock()
			clients := h.clients[client.ProjectID]
			if clients == nil {
				clients = make(map[*Client]bool)
				h.clients[client.ProjectID] = clients
			}
			
			// Check if project has reached client limit
			if len(clients) >= MaxClientsPerProject {
				h.mutex.Unlock()
				slog.Debug("Client rejected - project at capacity", "projectID", client.ProjectID)
				// Send rejection message to client
				select {
				case client.send <- []byte(`{"type":"error","message":"Project at maximum client capacity"}`):
				default:
				}
				continue
			}
			
			h.clients[client.ProjectID][client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock()
			if clients, ok := h.clients[client.ProjectID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.clients, client.ProjectID)
					}
				}
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			clients := h.clients[message.ProjectID]
			h.mutex.RUnlock()

			for client := range clients {
				select {
				case client.send <- message.Data:
				default:
					// Buffer full - client is slow
					slog.Debug("Client buffer full, disconnecting", "projectID", message.ProjectID)
					h.mutex.Lock()
					delete(clients, client)
					close(client.send)
					h.mutex.Unlock()
				}
			}
		}
	}
}

func (h *Hub) Broadcast(projectID string, data []byte) {
	h.broadcast <- &Message{
		ProjectID: projectID,
		Data:      data,
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) GetClientCount(projectID string) int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients[projectID])
}

func (h *Hub) GetClientLimit() int {
	return MaxClientsPerProject
}
