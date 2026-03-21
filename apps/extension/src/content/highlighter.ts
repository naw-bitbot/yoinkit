// Content script for Yoinkit — handles text selection clipping

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CLIP_SELECTION") {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            sendResponse({ success: false, error: "No text selected" });
            return;
        }

        // Get the selected HTML
        const range = selection.getRangeAt(0);
        const container = document.createElement("div");
        container.appendChild(range.cloneContents());
        const selectedHtml = container.innerHTML;

        sendResponse({
            success: true,
            html: selectedHtml,
            url: window.location.href,
            title: document.title,
        });
    }
    return true; // async response
});
