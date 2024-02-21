document.addEventListener('DOMContentLoaded', () => {
    const authenticateBtn = document.getElementById('authenticate');

    // Listen for authenticate button clicks
    authenticateBtn.addEventListener('click', () => {
        // Trigger authentication process
        chrome.runtime.sendMessage({ action: "authenticate" });
    });

    // Save the current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const url = new URL(tab.url);
        const domain = url.hostname;

        // Display the current tab URL
        // document.getElementById('current-url').innerText = domain;
        console.log("popup loaded " + tab.url);
        // Send savePage message
        chrome.runtime.sendMessage({ action: "savePage", title: tab.title, url: tab.url })
    });


    // Get recent saves
    chrome.runtime.sendMessage({ action: "getItems", count: 10 });
});


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action == "returnItems") {
            console.log("returnItems message received.")
            console.log(request)
            let string = ""
            let items = request.items;
            for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                string += `<a href='${it.url}>${it.title}</a><br/>`;
                console.log(`<a href='${it.url}>${it.title}</a><br/>`)
            }
            console.log("Setting string " + string)
            document.getElementById('lastPage').innerHTML = string;
        }
    }
);
