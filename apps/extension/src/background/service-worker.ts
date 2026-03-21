const API_BASE = "http://127.0.0.1:9271";

// Handle toolbar icon click — one-click download
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:")) {
    return;
  }

  try {
    const token = await getToken();
    const settings = await fetchSettings(token);
    const oneClickMode = (settings as Record<string, string>).one_click_mode || "current_page";

    const flags: Record<string, unknown> = {};
    if (oneClickMode === "whole_site") {
      flags.recursive = true;
      flags.convert_links = true;
      flags.page_requisites = true;
      flags.no_parent = true;
    }

    const response = await fetch(`${API_BASE}/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: tab.url, flags }),
    });

    if (response.ok) {
      // Show success badge
      chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId: tab.id });
      setTimeout(() => {
        if (tab.id) chrome.action.setBadgeText({ text: "", tabId: tab.id });
      }, 2000);
    } else {
      showErrorBadge(tab.id);
    }
  } catch (err) {
    console.error("Yoinkit: Failed to send download", err);
    showErrorBadge(tab.id);
  }
});

// Context menu: "Download with Yoinkit"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yoinkit-download-link",
    title: "Yoink this link",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: "yoinkit-download-page",
    title: "Yoink this page",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "yoinkit-clip-selection",
    title: "Clip selection to Yoinkit",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "yoinkit-clip-page",
    title: "Clip page to Yoinkit",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "yoinkit-download-link" || info.menuItemId === "yoinkit-download-page") {
    const url = info.menuItemId === "yoinkit-download-link"
      ? info.linkUrl
      : info.pageUrl;

    if (!url) return;

    try {
      const token = await getToken();
      await fetch(`${API_BASE}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (tab?.id) {
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId: tab.id });
        setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 2000);
      }
    } catch (err) {
      console.error("Yoinkit: Context menu download failed", err);
    }
  }

  if (info.menuItemId === "yoinkit-clip-selection" && tab?.id) {
    // Send message to content script to get selected HTML
    chrome.tabs.sendMessage(tab.id, { type: "CLIP_SELECTION" }, async (response) => {
      if (response?.success) {
        try {
          const token = await getToken();
          await fetch(`${API_BASE}/clip`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: response.url, html: response.html }),
          });
          chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
          chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId: tab.id });
          setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id! }), 2000);
        } catch (err) {
          console.error("Yoinkit: Clip failed", err);
          showErrorBadge(tab.id);
        }
      }
    });
  }

  if (info.menuItemId === "yoinkit-clip-page") {
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/clip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: info.pageUrl }),
      });
      if (tab?.id) {
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId: tab.id });
        setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id! }), 2000);
      }
    } catch (err) {
      console.error("Yoinkit: Page clip failed", err);
      if (tab?.id) showErrorBadge(tab.id);
    }
  }
});

// Health check — update badge for connection status
async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Periodic health check
setInterval(async () => {
  const healthy = await checkHealth();
  chrome.action.setIcon({
    path: healthy ? {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    } : {
      "16": "icons/icon-16-grey.png",
      "48": "icons/icon-48-grey.png",
      "128": "icons/icon-128-grey.png",
    },
  });
}, 30000);

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHECK_HEALTH") {
    checkHealth().then(sendResponse);
    return true; // async response
  }
  if (message.type === "GET_CURRENT_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse(tabs[0]?.url || "");
    });
    return true;
  }
});

async function getToken(): Promise<string> {
  const result = await chrome.storage.local.get("auth_token");
  return result.auth_token || "";
}

async function fetchSettings(token: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

function showErrorBadge(tabId?: number) {
  if (!tabId) return;
  chrome.action.setBadgeText({ text: "!", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#ef4444", tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 3000);
}
