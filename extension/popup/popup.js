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

const checkboxSVG = `<svg class="checkbox" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

const trashSVG = `<svg class="trash" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm7-8v6c0 .55-.45 1-1 1s-1-.45-1-1V11c0-.55.45-1 1-1s1 .45 1 1z"/></svg>`;

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action == "returnItems") {
            console.log("returnItems message received.")
            console.log(request)
            let htmlString = "";
            let items = request.items;
            for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                htmlString += `<tr><td><a href="${it.url}" target="_blank">${it.title}</a></td><td><button class="delete-button" data-id="${it.id}">${trashSVG}</button></td><td><button class="finish-button" data-id="${it.id}">${checkboxSVG}</button></td></tr>`;
            }
            document.getElementById('items').innerHTML = htmlString;

            // Add event listeners to the buttons
            Array.from(document.getElementsByClassName('delete-button')).forEach(button => {
                button.addEventListener('click', function () {
                    chrome.runtime.sendMessage({ action: 'deleteItem', id: this.getAttribute('data-id') });
                });
            });

            Array.from(document.getElementsByClassName('finish-button')).forEach(button => {
                button.addEventListener('click', function () {
                    chrome.runtime.sendMessage({ action: 'finishItem', id: this.getAttribute('data-id') });
                });
            });
        }
    }
);
