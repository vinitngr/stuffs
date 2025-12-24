package main

import (
	"asyncs/jobs"
	"log"
	"net/http"

	"github.com/hibiken/asynq"
)

const redisAddr = "127.0.0.1:6379"

func main() {
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	mux := http.NewServeMux()

	mux.Handle(
		"/video/",
		http.StripPrefix("/video/", http.FileServer(http.Dir("./video/static"))),
	)

	mux.HandleFunc("/big_task", func(w http.ResponseWriter, r *http.Request) {
		videoURL := r.URL.Query().Get("video_url")
		if videoURL == "" {
			http.Error(w, "video_url required", http.StatusBadRequest)
			return
		}

		task, err := jobs.NewVideoCompressionTask(videoURL)
		if err != nil {
			http.Error(w, "could not create task", http.StatusInternalServerError)
			return
		}

		info, err := client.Enqueue(task)
		if err != nil {
			http.Error(w, "could not enqueue task", http.StatusInternalServerError)
			return
		}

		log.Printf("enqueued task: id=%s queue=%s", info.ID, info.Queue)
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte("sent"))
	})

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
