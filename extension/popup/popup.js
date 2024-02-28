// Global url variable
let url = "";

function stripUrlParams(url) {
    let hashIndex = url.indexOf("#");
    let queryIndex = url.indexOf("?");

    // Find the earliest index of either '#' or '?'
    let endIndex = -1;
    if (hashIndex > -1 && queryIndex > -1) {
        endIndex = Math.min(hashIndex, queryIndex);
    } else if (hashIndex > -1) {
        endIndex = hashIndex;
    } else if (queryIndex > -1) {
        endIndex = queryIndex;
    }

    // If either '#' or '?' was found, strip everything after it; otherwise, return the original URL
    return endIndex > -1 ? url.substring(0, endIndex) : url;
}

document.addEventListener('DOMContentLoaded', () => {
    const authenticateBtn = document.getElementById('authenticate');

    // Listen for authenticate button clicks
    authenticateBtn.addEventListener('click', () => {
        // Trigger authentication process
        chrome.runtime.sendMessage({ action: "authenticate" });
    });

    // Populate the save input with the current URL and title
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        url = stripUrlParams(tab.url);
        document.getElementById('current-page-title').value = tab.title;
        document.getElementById('current-page-url').value = url;
        // change data-id on the fininsh button to the current page url
        document.getElementById('finish-current-page').setAttribute('data-id', tab.url);
        chrome.runtime.sendMessage({ action: "getIsPageSaved", url: tab.url });
    });

    // Get recent saves
    chrome.runtime.sendMessage({ action: "getItems", count: 10 });
});

const checkboxSVG = `<svg class="checkbox" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

const trashSVG = `<svg class="trash" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm7-8v6c0 .55-.45 1-1 1s-1-.45-1-1V11c0-.55.45-1 1-1s1 .45 1 1z"/></svg>`;

function escapeHTML(str) {
    return new Option(str).innerHTML;
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action == "returnItems") {
            console.log("returnItems message received.")
            console.log(request)
            let htmlString = "<tbody>";
            let items = request.items;
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                htmlString += `<tr><td><a class="item-title" href="${escapeHTML(it.url)}" target="_blank">${escapeHTML(it.title)}</a></td><td><button class="finish-button" data-id="${it.url}">${checkboxSVG}</button></td></tr>`;
            }
            htmlString += "</tbody>";
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
        } else if (request.action == "returnIsPageSaved") {
            console.log("returnIsPageSaved message received.")
            console.log(request)
            if (request.isSaved) {
                document.getElementById('save-current-page-row').style.display = 'none';
                document.getElementById('current-page-saved-row').style.display = 'block';
            } else {
                document.getElementById('save-current-page-row').style.display = 'block';
                document.getElementById('current-page-saved-row').style.display = 'none';
            }
        } else if (request.action == "addedNotification") {
            // Check if the added item is the current page, and if so update the UI
            console.log("Checking " + stripUrlParams(request.url) + " against " + stripUrlParams(url));
            if (stripUrlParams(request.url) === stripUrlParams(url)) {
                document.getElementById('save-current-page-row').style.display = 'none';
                document.getElementById('current-page-saved-row').style.display = 'block'
            } else {
                // If it's not the current page, refresh the list of items
                chrome.runtime.sendMessage({ action: "getItems", count: 10 });
            }

        }
    }
);

// Save current page button
document.getElementById('save-current-page-button').addEventListener('click', function () {
    const title = document.getElementById('current-page-title').value;
    const url = document.getElementById('current-page-url').value;
    chrome.runtime.sendMessage({ action: "savePage", title: title, url: url });
});

