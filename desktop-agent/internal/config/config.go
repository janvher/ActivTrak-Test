package config

import (
	"os"
	"time"
)

// Config holds runtime settings for the desktop agent.
type Config struct {
	APIURL            string
	PollInterval      time.Duration
	IdleThreshold     time.Duration
	HeartbeatInterval time.Duration
	DataDir           string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	home, _ := os.UserHomeDir()
	dataDir := home + "/.activtrak-agent"
	if v := os.Getenv("ACTIVTRAK_DATA_DIR"); v != "" {
		dataDir = v
	}

	return Config{
		APIURL:            getenv("ACTIVTRAK_API_URL", "http://localhost:3001"),
		PollInterval:      durationEnv("ACTIVTRAK_POLL_INTERVAL", 3*time.Second),
		IdleThreshold:     durationEnv("ACTIVTRAK_IDLE_THRESHOLD", 60*time.Second),
		HeartbeatInterval: durationEnv("ACTIVTRAK_HEARTBEAT_INTERVAL", 30*time.Second),
		DataDir:           dataDir,
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
