package websocket

import (
	"context"
	"strings"

	"github.com/redis/go-redis/v9"
)

type Broadcaster struct {
	redis *redis.Client
	hub   *Hub
}

func NewBroadcaster(redis *redis.Client, hub *Hub) *Broadcaster {
	return &Broadcaster{
		redis: redis,
		hub:   hub,
	}
}

func (b *Broadcaster) Start(ctx context.Context) {
	if b.redis == nil {
		// Redis not available, broadcaster won't work
		return
	}
	
	pubsub := b.redis.PSubscribe(ctx, "logs:*")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			// Extract project ID from channel name (logs:<projectId>)
			projectID := strings.TrimPrefix(msg.Channel, "logs:")
			b.hub.Broadcast(projectID, []byte(msg.Payload))
		}
	}
}

// PublishLog publishes a log message to Redis for broadcasting
func (b *Broadcaster) PublishLog(ctx context.Context, projectID string, data []byte) error {
	if b.redis == nil {
		// Redis not available, skip publishing
		return nil
	}
	return b.redis.Publish(ctx, "logs:"+projectID, data).Err()
}
