// TODO
// 2. Undo button deletes the last row
// 5. Fetch header image from the page and save it to Google Sheets

class AuthService {
    constructor() {
        this.token = null;
        this.CLIENT_ID = '574014316759-h77ia0d21flsa9c81mbjqmkft94ep9go.apps.googleusercontent.com';
        this.redirectUrl = chrome.identity.getRedirectURL();
        this.authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.CLIENT_ID}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets')}&redirect_uri=${encodeURIComponent(this.redirectUrl)}`;
        // Prevent multiple simultaneous authentication requests
        this.authenticating = false;
    }

    setToken(token) {
        console.log('Setting token:', token);
        this.token = token;
        // Save the token to local storage
        chrome.storage.local.set({ accessToken: token });
    }

    async isAuthenticated() {
        return this.token && (! await this.isTokenExpired());
    }

    async isTokenExpired() {
        // Check if the google api token is expired with a network request
        if (!this.token) {
            return true;
        }
        return await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + this.token)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    this.token = null; // Clear the token so future checks fail faster
                    return true;
                }
                return false;
            });
    }

    async getToken() {
        if (!this.token || await this.isTokenExpired()) {
            await this.authenticate();
        }
        return this.token;
    }

    async authenticate(callback) {
        if (this.authenticating) {
            console.log('Already authenticating, won\'t start another authentication flow');
            return;
        }
        this.authenticating = true;

        console.log('Authenticating...');
        console.log('Auth URL:', this.authUrl);

        chrome.identity.launchWebAuthFlow(
            {
                url: this.authUrl,
                interactive: true,
            },
            (redirectUri) => {
                this.authenticating = false;
                console.log('Redirect URI:', redirectUri);
                if (chrome.runtime.lastError || redirectUri.includes('access_denied')) {
                    console.error('Authentication failed:', chrome.runtime.lastError);
                    return;
                }
                const accessToken = new URL(redirectUri).hash.split('&').filter(function (el) {
                    if (el.match('access_token') !== null) return true;
                })[0].split('=')[1];

                // Save the token to local storage
                this.setToken(accessToken);

                // Call the callback function if it exists
                if (callback) {
                    //callback();
                }
            }
        );
    }
}

// Create a new instance of the AuthService
const authService = new AuthService();

// Get the access token from local storage on startup for the authService
chrome.storage.local.get(['accessToken'], function (result) {
    if (result.accessToken) {
        authService.setToken(result.accessToken);
    } else {
        console.log('No access token found');
    }
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action == "googleSignIn") {
            authService.setToken(request.access_token);
        }
    }
);



// ======================================================
// ======================================================
// ======================================================


const spreadsheetId = '1BDW6n6wABMIIx-p-5NZUV_EQLv49nXQAwhn85jx22T8';

cache_map = new Map();

// Event for when the user clicks the extension icon
chrome.browserAction.onClicked.addListener(function (tab) {
    console.log('Icon clicked. Adding page to Google Sheets:', activeTab.title, activeTab.url);
    // Add the current page to Google Sheets
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var activeTab = tabs[0];
        console.log('Icon clicked. Adding page to Google Sheets:', activeTab.title, activeTab.url);
        addPageToSheet(activeTab.title, activeTab.url);
    });
});

// Event for popup to add a page
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log("message received.")
        if (request.action == "savePage") {
            console.log("savePage message received.")
            addPageToSheet(request.title, request.url);
        }
    }
);

// Event to send the most recent rows
chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        if (request.action == "getItems") {
            console.log("getItems message received.")
            const items = await getRecentRows(request.count);
            console.log(items);
            chrome.runtime.sendMessage({ action: "returnItems", items: items });
        }
    }
);

// Event for when the user installs the extension
chrome.runtime.onInstalled.addListener(() => {
    chrome.menus.create({
        id: "addPageToSheet",
        title: "Add Page to Google Sheets",
        contexts: ["link"],
        onclick: function (info, tab) {
            console.log("Link URL:", info.linkUrl);

            // Fetch the page title at the link URL
            fetch(info.linkUrl)
                .then(response => response.text())
                .then(data => {
                    // Extract the page title from the HTML
                    let title = data.match(/<title[^>]*>([^<]*)<\/title>/)[1];

                    // Sanitize the title to prevent injecting special characters
                    title = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/=/g, '');
                    console.log('Page Title:', title);

                    // Add the page to Google Sheets
                    addPageToSheet(title, info.linkUrl);
                })
                // If the fetch fails, add the page to Google Sheets with the URL only
                .catch(error => {
                    console.error('Error fetching page for title:', error);
                    addPageToSheet(info.linkUrl, info.linkUrl);
                });
        }
    });


});

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


function myCheapHash(str) {
    // Should be equivalent to the following Excel formula, which is performed after stripping URL params:
    // =MOD(SUMPRODUCT(CODE(MID(D4, ROW(INDIRECT("1:" & LEN(D4))), 1))), $J$1)+1
    str = stripUrlParams(str);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    return (hash % 1024) + 1;
}


// Function to convert a number to a letter (e.g., 1 -> A, 2 -> B, 27 -> AA, etc.)
function numToLetter(num) {
    let letter = '';
    while (num > 0) {
        let remainder = num % 26;
        if (remainder == 0) {
            remainder = 26;
        }
        letter = String.fromCharCode(64 + remainder) + letter;
        num = (num - remainder) / 26;
    }
    return letter;
}

async function isPageInSheet(url) {
    url = stripUrlParams(url);
    await lookupPageInSheet(url);
}

function pageInCache(url) {
    url = stripUrlParams(url);
    return cache_map.has(url) ? cache_map.get(url) : false;
}

async function getRowCount(force_refresh) {
    const cacheKey = "rowCount"
    if (!force_refresh && cache_map.has(cacheKey)) {
        return cache_map.get(cacheKey);
    }
    const cell = `Stats!B2`;
    const token = await authService.getToken();
    if (!token) {
        console.log('Don\'t have a token yet');
        return;
    }

    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cell)}?access_token=${token}`;

    return await fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Getting the row count', data);
            const count = data.values[0][0];
            console.log(count);
            cache_map.set(cacheKey, count);
            return count;
        });
}

async function getRecentRows(count) {
    const rowCount = await getRowCount();
    if (!rowCount) {
        console.log("Couldn't get the row count")
        return;
    }
    const token = await authService.getToken();
    if (!token) {
        console.log('Don\'t have a token yet');
        return;
    }
    const rangeEnd = rowCount;
    const rangeStart = Math.max(rangeEnd - count + 1, 2) // Don't let the range begin before row 2 where the data starts
    const range = `A${rangeStart}:K${rangeEnd}` // Grab all the data columns
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?access_token=${token}`;

    return await fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Got recent rows', data);
            let returnValues = [];
            for (let i = data.values.length - 1; i >= 0; i--) {
                const [index, index2, blank1, title, url, dateSaved, notes, blank2, finished, rating] = data.values[i];
                const values = {
                    index: index,
                    title: title,
                    finished: finished,
                    dateSaved: dateSaved,
                    notes: notes,
                    finished: finished,
                    url: url
                }
                cache_map.set(url, values);
                console.log(1)
                returnValues.push(values);
                console.log(2)
            }
            return returnValues;
        });
}

async function lookupPageInSheet(url) {
    url = stripUrlParams(url);
    const column = numToLetter(myCheapHash(url));
    const range = `LookupCONCAT!${column}:${column}`;
    const token = await authService.getToken();
    if (!token) {
        console.log('Don\'t have a token yet');
        return;
    }

    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?access_token=${token}`;

    return await fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Checking for page in Google Sheets', data);
            // For each row in the column, check if the URL is present. Go latest to earliestvk
            for (let i = data.values.length - 1; i >= 0; i--) {
                // "7\nhttps://forum.kittensgame.com/c/kittensgame\nFALSE"
                const entry = data.values[i][0];

                // Split the entry by \n into the index, URL and the finished state
                const [index, pageURL, dateAdded, finishedText] = entry.split('\n');
                const finished = finishedText == 'TRUE';

                // Add each entry to the cache
                let values = cache_map.get(pageURL) || {};
                values.index = index;
                values.dateAdded = dateAdded;
                values.finished = finished;
                cache_map.set(pageURL, values);

                if (pageURL == url) {
                    console.log('Page already in Google Sheets');
                    currentTabUpdateIcon();
                    return true;
                }
            }
            console.log('Page not in Google Sheets');
            // Add negative cache entry
            cache_map.set(url, false);
            return false;
        })
        .catch(error => {
            console.error('Error checking page in Google Sheets', error);
        }
        );
}

async function catchIf401(response, callback) {
    if (response.status == 401) {
        console.log('Re-authenticating...');
        authService.authenticate(function () {
            // Try the request again after re-authenticating
            //callback();
        });
        return;
    }
    return response;
}

// Function to handle adding the page to Google Sheets
async function addPageToSheet(title, url) {
    url = stripUrlParams(url);
    // Check if the user is authenticated
    const token = await authService.getToken()
    if (!token) {
        console.log('Re-authenticating...');
        authService.authenticate(function () {
            // Try adding the page to Google Sheets after re-authenticating
            // addPageToSheet(title, url);
        });
        return;
    }

    // Check if the page is already in the cache and unfinished
    const cached = await lookupPageInSheet(url);
    if (cached && !cached.finished) {
        console.log('Page already in cache and unfinished');
        // Show a notification in the page
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var activeTab = tabs[0];
            chrome.tabs.sendMessage(activeTab.id, {
                action: "duplicateNotification",
                title: title,
                url: url
            });
        });
        return;
    }
    // Title, URL, and Date columns
    const range = 'C2:E2';

    // API URL for appending data to a Google Sheet
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&access_token=${token}`;

    // Sheets uses days since 30/12/1899 as the date format. Use our time zone.
    const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000; // in milliseconds
    const date_number = (new Date() - new Date('1899-12-30') - timezoneOffset) / (1000 * 60 * 60 * 24);

    // Data to be added
    const values = [[title, url, date_number]];
    const body = { values };

    return await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
        // .then(response => catchIf401(response, addPageToSheet.bind(null, title, url)))
        .then(response => response.json())
        .then(data => {
            const cell = data.updates.updatedRange.split('!')[1].split(':')[0]
            const row = cell.match(/\d+/)[0];
            console.log('Page added to Google Sheets', data, row);
            // Add to cache
            cache_map.set(url, {
                index: row,
                dateAdded: date_number,
                finished: false
            });

            // Update the icon
            currentTabUpdateIcon();

            // Force update total rows from sheet formula
            getRowCount(true);

            // Show a notification in the page
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                var activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, {
                    action: "addedNotification",
                    title: title,
                    url: url
                });
            });

            return data;
        })
        .catch(error => {
            console.error('Error adding page to Google Sheets', error);
        });
}

// Receive messages from content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action == 'authenticate') {
        authService.authenticate();
    }
});


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action == "signIn") {
            console.log("Received ID token:", request.idToken);
            // Handle the ID token (e.g., verify it or use it for API calls)
        }
    }
);

async function checkIfPageIsSaved(url) {
    url = stripUrlParams(url);
    // If we have the entry in the cache, trust it without making the request
    if (!cache_map.has(url)) {
        console.log('Request to check if page is saved:', url);
        await lookupPageInSheet(url);
    }
    return cache_map.get(url) && !cache_map.get(url).finished;
}

function updateIcon(tabId, isSaved) {
    let path = isSaved ? 'icons/icon128green.png' : 'icons/icon128.png';
    browser.browserAction.setIcon({ path: path, tabId: tabId });
}

function getTabById(tabId) {
    return new Promise((resolve, reject) => {
        browser.tabs.get(tabId, function (tab) {
            if (browser.runtime.lastError) {
                reject(browser.runtime.lastError);
            } else {
                resolve(tab);
            }
        });
    });
}

async function checkAndUpdateIcon(tabId) {
    const tab = await getTabById(tabId);
    if (!tab.url) {
        console.error('No URL for tab:', tab);
        return;
    }
    console.log('Checking if page is saved:', tab.url);
    const isSaved = await checkIfPageIsSaved(tab.url);
    console.log('Page is saved:', isSaved);
    updateIcon(tabId, isSaved);
}

async function currentTabUpdateIcon() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        console.log(tab)
        checkAndUpdateIcon(tab.id);
    });
}

// When the active tab changes
browser.tabs.onActivated.addListener(activeInfo => {
    checkAndUpdateIcon(activeInfo.tabId);
});

// When the URL of a tab changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        console.log('URL changed:', changeInfo.url);
        checkAndUpdateIcon(tabId);
    }
});
