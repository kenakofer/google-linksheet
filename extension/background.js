// TODO
// 2. Undo button deletes the last row
// 3. Clicking extension icon saves the current page to Google Sheets
// 4. Add save date to Google Sheets
// 5. Fetch header image from the page and save it to Google Sheets

CLIENT_ID='574014316759-h77ia0d21flsa9c81mbjqmkft94ep9go.apps.googleusercontent.com';

accessToken = null;


const spreadsheetId = '1BDW6n6wABMIIx-p-5NZUV_EQLv49nXQAwhn85jx22T8';

cache_map = new Map();

// Load the access token from storage on startup
chrome.storage.local.get(['accessToken'], function(result) {
    accessToken = result.accessToken;
    console.log('Access Token:', accessToken);
});

browser.runtime.onInstalled.addListener(() => {
    browser.menus.create({
        id: "addPageToSheet",
        title: "Add Page to Google Sheets",
        contexts: ["link"],
        onclick: function(info, tab) {
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
                console.error('Error fetching page:', error);
                addPageToSheet(info.linkUrl, info.linkUrl);
            });
        }
    });


});

function myCheapHash(str) {
    // Should be equivalent to the following Excel formula:
    // =MOD(SUMPRODUCT(CODE(MID(D4, ROW(INDIRECT("1:" & LEN(D4))), 1))), $J$1)+1
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
    await lookupPageInSheet(url);
}

function isPageInCache(url) {
    return cache_map.has(url);
}

async function lookupPageInSheet(url) {
    if (!accessToken) {
        authenticate();
        return;
    }

    const column = numToLetter(myCheapHash(url));
    const range = `LookupCONCAT!${column}:${column}`;
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?access_token=${accessToken}`;

    return await fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        console.log('Page in Google Sheets', data);
        // For each row in the column, check if the URL is present
        for (let i = 0; i < data.values.length; i++) {
            // "7\nhttps://forum.kittensgame.com/c/kittensgame\nFALSE"
            const entry = data.values[i][0];

            // Split the entry by \n into the index, URL and the finished state
            const [index, sheetUrl, finished] = entry.split('\n');

            // Add each entry to the cache
            cache_map.set(sheetUrl, {
                index: index,
                finished: finished
            });

            if (sheetUrl == url) {
                console.log('Page already in Google Sheets');
                return true;
            }
        }
        console.log('Page not in Google Sheets');
        return false;
    })
    .catch(error => {
        console.error('Error checking page in Google Sheets', error);
    }
    );
}


// Function to handle adding the page to Google Sheets
function addPageToSheet(title, url) {
    // Check if the user is authenticated
    if (!accessToken) {
        authenticate();
        return;
    }
    // Title and URL columns
    const range = 'C2:D2';

    // API URL for appending data to a Google Sheet
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&access_token=${accessToken}`;

    // Data to be added
    const values = [[title, url]]; // Structure data as needed by the Sheets API
    const body = { values };

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        const cell = data.updates.updatedRange.split('!')[1].split(':')[0]
        const row = cell.match(/\d+/)[0];
        console.log('Page added to Google Sheets', data, row);
        // Add to cache
        cache_map.set(url, {
            index: row,
            finished: false
        });
    // Show a notification in the popup
    chrome.runtime.sendMessage({action: "showNotification"});
    })
    .catch(error => {
        console.error('Error adding page to Google Sheets', error);
    });
}

// Receive messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action == 'authenticate') {
        authenticate();
    }
});

function authenticate() {
    console.log('Authenticating...');
    let redirectUrl = browser.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets')}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    console.log('Auth URL:', authUrl);

    browser.identity.launchWebAuthFlow(
        {
            url: authUrl,
            interactive: true,
        },
        function(redirectUri) {
            console.log('Redirect URI:', redirectUri);
            if (chrome.runtime.lastError || redirectUri.includes('access_denied')) {
                console.error('Authentication failed:', chrome.runtime.lastError);
                return;
            }
            accessToken = new URL(redirectUri).hash.split('&').filter(function(el) {
                if (el.match('access_token') !== null) return true;
            })[0].split('=')[1];
            console.log('Access Token:', accessToken);

            // Store the access token securely
            chrome.storage.local.set({ accessToken });
        }
    );
}
