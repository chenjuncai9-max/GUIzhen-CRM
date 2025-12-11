/**
 * PWA Service Worker Registration
 * Handles service worker registration and update notifications
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers are not supported in this browser');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', registration);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New service worker is ready
              console.log('New Service Worker available');
              
              // Show update notification
              if (document.hidden === false) {
                showUpdateNotification();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });

  // Handle messages from service worker
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    });
  }
}

function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className =
    'fixed bottom-4 right-4 bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 z-50';
  notification.innerHTML = `
    <span>应用有新版本可用</span>
    <button id="update-btn" class="bg-white text-blue-500 px-4 py-1 rounded font-semibold hover:bg-gray-100">
      更新
    </button>
  `;

  document.body.appendChild(notification);

  const updateBtn = notification.querySelector('#update-btn');
  updateBtn?.addEventListener('click', () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });

  // Auto remove after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}
