// contentScript.js
let div = document.createElement('div');
div.className = 'linksheet-notification linksheet-notification-hidden';
div.textContent = 'Hello, world!';
div.addEventListener('click', function() {
  console.log('Notification clicked');
});
document.body.appendChild(div);

// listen for messages from the background script to show the notification
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Message received', request, sender, sendResponse);
    if (request.action == 'showNotification') {
        const notification = document.querySelector('.linksheet-notification');
        notification.classList.remove('linksheet-notification-hidden');
        setTimeout(() => {
            notification.classList.add('linksheet-notification-hidden');
        }, 3000);
    }
});

console.log('Content script loaded');
