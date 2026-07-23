async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "getStatus" });
  document.getElementById("domain").textContent = status.currentDomain || "—";
  document.getElementById("status").textContent = status.paused
    ? "Paused"
    : "Running";
  document.getElementById("toggle").textContent = status.paused
    ? "Resume"
    : "Pause";
  document.getElementById("api").value = status.apiUrl;
  document.getElementById("toggle").dataset.paused = status.paused
    ? "1"
    : "0";
}

document.getElementById("toggle").addEventListener("click", async () => {
  const paused = document.getElementById("toggle").dataset.paused === "1";
  await chrome.runtime.sendMessage({ type: "setPaused", paused: !paused });
  await refresh();
});

document.getElementById("saveApi").addEventListener("click", async () => {
  const apiUrl = document.getElementById("api").value.trim();
  await chrome.runtime.sendMessage({ type: "setApiUrl", apiUrl });
  await refresh();
});

void refresh();
