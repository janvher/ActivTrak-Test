package device

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const idFileName = "device_id"

// ID returns a stable device identifier, creating and persisting one if needed.
func ID(dataDir string) (string, error) {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return "", err
	}

	path := filepath.Join(dataDir, idFileName)
	data, err := os.ReadFile(path)
	if err == nil {
		id := strings.TrimSpace(string(data))
		if id != "" {
			return id, nil
		}
	}

	id := uuid.NewString()
	if err := os.WriteFile(path, []byte(id+"\n"), 0o600); err != nil {
		return "", err
	}
	return id, nil
}

// Hostname returns the local machine hostname for display in the UI / payloads.
func Hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}
