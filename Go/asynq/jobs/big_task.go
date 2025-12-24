package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/hibiken/asynq"
)

const TypeVideoCompressor = "video:compress"

type VideoPayload struct {
	VideoURL string `json:"video_url"`
}

func NewVideoCompressionTask(src string) (*asynq.Task, error) { 
	payload, err := json.Marshal(VideoPayload{VideoURL: src})
	if err != nil {
		 return nil , err
	}

	return asynq.NewTask( TypeVideoCompressor , payload , asynq.MaxRetry(2) ,asynq.Timeout(20 * time.Second)) , nil
}

var allowedVideoTypes = map[string]string{
	"video/mp4":       ".mp4",
	"video/quicktime": ".mov",
	"video/webm":      ".webm",
	"video/x-matroska": ".mkv",
	"video/x-msvideo":       ".avi",
}

func ProbeContentType(url string) (string, error) {
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil { return "", err }
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		return "", fmt.Errorf("missing Content-Type")
	}
	return strings.Split(ct, ";")[0], nil
}

func HandleVideoCompressionTask(ctx context.Context, t *asynq.Task) error {
	var p VideoPayload
	if err := json.Unmarshal(t.Payload() , &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	log.Printf("process started for video : %s", p.VideoURL)
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %w", err)
	}
	
	ctype, err := ProbeContentType(p.VideoURL)
	if err != nil {
		return err
	}

	ext, ok := allowedVideoTypes[ctype]
	if !ok {
		return fmt.Errorf("unsupported content-type: %s", ctype)
	}

	input := filepath.Join(cwd, "video", "downloads", "input"+ext)
	output := filepath.Join(cwd, "video", "compress",
		fmt.Sprintf("super-compressed-%s.mp4", time.Now().Format("20060102150405")),
	)

	log.Printf("Dowloading video : %s" , input)
	if err := Download(p.VideoURL, input); err != nil {
		return fmt.Errorf("failed to download video: %w", err)
	}
	
	log.Printf("compressing video")
	if err := CompressVideo(input, output); err != nil {
		return fmt.Errorf("failed to compress video: %w", err)
	}

	// log.Printf("cleaning up")   
	// if err = os.Remove(input) ; err != nil {
	// 	return fmt.Errorf("failed to remove input file: %w", err)
	// }

	log.Printf("Video compressed successfully: %s", output)   
	return nil
}

func Download(url, out string) error {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, resp.Body)
	return err
}

func CompressVideo(input, output string) error {
	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-i", input,

		"-vf", "scale=640:-2",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "35",
		"-b:v", "300k",	

		"-c:a", "aac",
		"-b:a", "64k",

		output,
	)

	// cmd.Stderr = os.Stderr
	return cmd.Run()
}
