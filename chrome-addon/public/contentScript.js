// State to track if we're currently recording
let isTracking = false;
let trackedIframes = new Set();

// Helper function to get element selector
function getElementSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  return element.tagName.toLowerCase();
}

// Helper function to get element path
function getElementPath(element) {
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    path.unshift(getElementSelector(current));
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// Click event handler
function handleClick(e) {
  const context = e.target.ownerDocument === document ? 'main page' : 'iframe';
  
  const eventData = {
    type: 'click',
    context: context,
    timestamp: new Date().toISOString(),
    element: {
      tagName: e.target.tagName,
      id: e.target.id || null,
      className: e.target.className || null,
      text: e.target.innerText?.substring(0, 50) || null,
      selector: getElementSelector(e.target),
      path: getElementPath(e.target),
    },
    position: {
      x: e.clientX,
      y: e.clientY
    }
  };
  
  // Store event in chrome.storage instead of sending to popup
  chrome.storage.local.get(['capturedEvents'], (result) => {
    const events = result.capturedEvents || [];
    events.push(eventData);
    chrome.storage.local.set({ capturedEvents: events });
  });
  
  console.log(`Click (${context}):`, eventData);
}

// Input event handler
function handleInput(e) {
  const context = e.target.ownerDocument === document ? 'main page' : 'iframe';
  
  const eventData = {
    type: 'input',
    context: context,
    timestamp: new Date().toISOString(),
    element: {
      tagName: e.target.tagName,
      id: e.target.id || null,
      className: e.target.className || null,
      name: e.target.name || null,
      type: e.target.type || null,
      selector: getElementSelector(e.target),
      path: getElementPath(e.target),
    },
    value: e.target.value
  };
  
  // Store event in chrome.storage instead of sending to popup
  chrome.storage.local.get(['capturedEvents'], (result) => {
    const events = result.capturedEvents || [];
    events.push(eventData);
    chrome.storage.local.set({ capturedEvents: events });
  });
  
  console.log(`Input (${context}):`, eventData);
}

// Function to attach listeners to a document (main page or iframe)
function attachListenersToDocument(doc) {
  doc.addEventListener('click', handleClick, true);
  doc.addEventListener('input', handleInput, true);
}

// Function to remove listeners from a document
function removeListenersFromDocument(doc) {
  doc.removeEventListener('click', handleClick, true);
  doc.removeEventListener('input', handleInput, true);
}

// Function to track all iframes
function trackIframes() {
  const iframes = document.querySelectorAll('iframe');
  
  iframes.forEach((iframe) => {
    if (trackedIframes.has(iframe)) return;
    
    try {
      // Try to access iframe content (will fail for cross-origin iframes)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      if (iframeDoc) {
        attachListenersToDocument(iframeDoc);
        trackedIframes.add(iframe);
        console.log('Tracking iframe:', iframe.src || 'inline iframe');
      }
    } catch (e) {
      // Cross-origin iframe - cannot access
      console.warn('Cannot track cross-origin iframe:', iframe.src, e.message);
    }
  });
}

// Function to stop tracking iframes
function stopTrackingIframes() {
  trackedIframes.forEach((iframe) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        removeListenersFromDocument(iframeDoc);
      }
    } catch (e) {
      // Iframe might have been removed or became inaccessible
    }
  });
  trackedIframes.clear();
}

// Observer to detect dynamically added iframes
let iframeObserver = null;

function startIframeObserver() {
  iframeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'IFRAME') {
          // Wait for iframe to load before tracking
          node.addEventListener('load', () => {
            if (isTracking) {
              trackIframes();
            }
          });
        }
      });
    });
  });
  
  iframeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopIframeObserver() {
  if (iframeObserver) {
    iframeObserver.disconnect();
    iframeObserver = null;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTracking') {
    if (!isTracking) {
      isTracking = true;
      // Attach event listeners to main document
      attachListenersToDocument(document);
      
      // Track existing iframes
      trackIframes();
      
      // Start observing for new iframes
      startIframeObserver();
      
      console.log('Event tracking started (including iframes)');
      sendResponse({ status: 'tracking started' });
    } else {
      sendResponse({ status: 'already tracking' });
    }
  } else if (request.action === 'stopTracking') {
    if (isTracking) {
      isTracking = false;
      // Remove event listeners from main document
      removeListenersFromDocument(document);
      
      // Stop tracking iframes
      stopTrackingIframes();
      
      // Stop iframe observer
      stopIframeObserver();
      
      console.log('Event tracking stopped');
      sendResponse({ status: 'tracking stopped' });
    } else {
      sendResponse({ status: 'not tracking' });
    }
  }
  return true; // Required for async sendResponse
});

