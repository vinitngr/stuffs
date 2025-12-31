package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
)

func main() {
	broker := os.Getenv("KAFKA_BROKER")
	topic := os.Getenv("KAFKA_TOPIC")
	group := os.Getenv("KAFKA_GROUP")

	if broker == "" || topic == "" || group == "" {
		log.Fatal("missing env: KAFKA_BROKER / KAFKA_TOPIC / KAFKA_GROUP")
	}

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{broker},
		Topic:   topic,
		GroupID: group,
	})

	log.Println("consumer started")

	for {
		msg, err := r.ReadMessage(context.Background())
		if err != nil {
			log.Println("read error:", err)
			time.Sleep(time.Second)
			continue
		}

		log.Printf("message: key=%s value=%s\n", msg.Key, msg.Value)
	}
}
