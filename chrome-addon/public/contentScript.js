// State to track if we're currently recording
let isTracking = false;
let trackedIframes = new Set();

// Helper function to get a unique XPath
function getXPath(element) {
  // If element has an ID, use it
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  // Check for unique data attributes
  const dataAttrs = Array.from(element.attributes).filter(attr => 
    attr.name.startsWith('data-') && attr.value
  );
  
  for (let attr of dataAttrs) {
    const xpath = `//*[@${attr.name}="${attr.value}"]`;
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (result.snapshotLength === 1) {
        return xpath;
      }
    } catch (e) {
      // Continue to next attribute
    }
  }
  
  // Check for unique class attribute
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    for (let className of classes) {
      if (className) {
        const xpath = `//${element.tagName.toLowerCase()}[@class="${element.className}"]`;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) {
            return xpath;
          }
        } catch (e) {
          // Continue to next check
        }
      }
    }
  }
  
  // Generate positional XPath
  let path = '';
  let current = element;
  
  while (current && current !== document.documentElement) {
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    const position = index > 1 ? `[${index}]` : '';
    path = `/${tagName}${position}${path}`;
    
    current = current.parentElement;
  }
  
  return `/${document.documentElement.tagName.toLowerCase()}${path}`;
}

// Click event handler
function handleClick(e) {
  const context = e.target.ownerDocument === document ? 'main page' : 'iframe';
  
  const eventData = {
    type: 'click',
    selector: getXPath(e.target)
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
    selector: getXPath(e.target),
    value: e.target.value
  };
  
  // Store event in chrome.storage instead of sending to popup
  chrome.storage.local.get(['capturedEvents'], (result) => {
    const events = result.capturedEvents || [];
    
    // Find existing input event with the same selector
    const existingIndex = events.findIndex(event => event.selector === eventData.selector);
    
    if (existingIndex !== -1) {
      // Update existing entry
      events[existingIndex].value = eventData.value;
    } else {
      // Add new entry
      events.push(eventData);
    }
    
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

