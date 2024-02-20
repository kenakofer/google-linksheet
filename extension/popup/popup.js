document.addEventListener('DOMContentLoaded', () => {
    const authenticateBtn = document.getElementById('authenticate');

    // Listen for authenticate button clicks
    authenticateBtn.addEventListener('click', () => {
        // Trigger authentication process
        chrome.runtime.sendMessage({action: "authenticate"});
    });

    // Save the current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        const url = new URL(tab.url);
        const domain = url.hostname;

        // Display the current tab URL
        // document.getElementById('current-url').innerText = domain;
        console.log("popup loaded " + domain);
    });
});