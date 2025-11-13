// Simplified Obsidian-like markdown handling
// Replace the handlePreviewKeydown and handlePreviewInput functions with these

function handlePreviewKeydown(e) {
  // Only handle special cases, let browser handle normal text entry
  const preview = document.getElementById('markdown-preview');
  const selection = window.getSelection();
  
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let currentNode = range.startContainer;
    
    // Find if we're in a list item
    let listItem = null;
    let tempNode = currentNode;
    while (tempNode && tempNode !== preview) {
      if (tempNode.nodeType === Node.ELEMENT_NODE && tempNode.tagName === 'LI') {
        listItem = tempNode;
        break;
      }
      tempNode = tempNode.parentNode;
    }
    
    if (listItem) {
      e.preventDefault();
      
      // Get the text content of the list item (excluding checkbox)
      const checkbox = listItem.querySelector('input[type="checkbox"]');
      let textContent = listItem.textContent.trim();
      
      // Check if list item is empty
      if (textContent === '' || (checkbox && textContent === '')) {
        // Exit the list - insert a paragraph after the list
        const list = listItem.parentElement;
        const newPara = document.createElement('p');
        newPara.innerHTML = '<br>';
        
        // Remove the empty list item
        listItem.remove();
        
        // If list is now empty, remove it too
        if (list.children.length === 0) {
          list.parentNode.insertBefore(newPara, list.nextSibling);
          list.remove();
        } else {
          list.parentNode.insertBefore(newPara, list.nextSibling);
        }
        
        // Place cursor in new paragraph
        const newRange = document.createRange();
        const newSel = window.getSelection();
        newRange.selectNodeContents(newPara);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      } else {
        // Create new list item after current one
        const newListItem = document.createElement('li');
        
        if (checkbox) {
          // Create a new checkbox for the new item
          const newCheckbox = document.createElement('input');
          newCheckbox.type = 'checkbox';
          newCheckbox.addEventListener('change', (e) => {
            setTimeout(() => {
              preview.dispatchEvent(new Event('input', { bubbles: true }));
            }, 10);
          });
          newListItem.appendChild(newCheckbox);
          newListItem.appendChild(document.createTextNode(' '));
        }
        
        newListItem.innerHTML += '<br>';
        listItem.parentNode.insertBefore(newListItem, listItem.nextSibling);
        
        // Place cursor in new list item
        const newRange = document.createRange();
        const newSel = window.getSelection();
        const textNode = checkbox ? newListItem.childNodes[2] : newListItem.firstChild;
        if (textNode) {
          newRange.setStart(textNode, 0);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }
      
      // Trigger input to save changes
      preview.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  
  // Check for markdown patterns after typing
  if (e.key === ' ' || e.key === 'Enter') {
    setTimeout(() => {
      transformMarkdownPatterns();
    }, 10);
  }
}

function transformMarkdownPatterns() {
  const preview = document.getElementById('markdown-preview');
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  let currentNode = range.startContainer;
  
  // Find the current paragraph or container
  let container = currentNode;
  while (container && container !== preview) {
    if (container.nodeType === Node.ELEMENT_NODE && 
        (container.tagName === 'P' || container.tagName === 'DIV')) {
      break;
    }
    container = container.parentNode;
  }
  
  if (!container || container === preview) return;
  
  // Get the text content of the current line
  const text = container.textContent;
  
  // Check for list patterns at the start of the line
  const bulletMatch = text.match(/^-\s/);
  const checkboxMatch = text.match(/^-\s\[\s?\]\s/);
  
  if (bulletMatch || checkboxMatch) {
    // Save cursor position relative to text
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(container);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const cursorOffset = preCaretRange.toString().length;
    
    // Create a list
    const list = document.createElement('ul');
    const listItem = document.createElement('li');
    
    if (checkboxMatch) {
      // Create checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', (e) => {
        setTimeout(() => {
          preview.dispatchEvent(new Event('input', { bubbles: true }));
        }, 10);
      });
      listItem.appendChild(checkbox);
      
      // Add text after the checkbox pattern
      const remainingText = text.substring(checkboxMatch[0].length);
      listItem.appendChild(document.createTextNode(' ' + remainingText));
    } else {
      // Add text after the bullet pattern
      const remainingText = text.substring(bulletMatch[0].length);
      listItem.appendChild(document.createTextNode(remainingText));
    }
    
    list.appendChild(listItem);
    container.parentNode.replaceChild(list, container);
    
    // Restore cursor position in the list item
    const newRange = document.createRange();
    const newSel = window.getSelection();
    
    const textNode = checkboxMatch ? listItem.childNodes[1] : listItem.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newOffset = cursorOffset - (checkboxMatch ? checkboxMatch[0].length : bulletMatch[0].length);
      newRange.setStart(textNode, Math.min(Math.max(0, newOffset), textNode.length));
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    }
    
    // Trigger input to save
    preview.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function handlePreviewInput(e) {
  const preview = e.target;
  
  // Convert HTML back to markdown
  const markdown = htmlToMarkdown(preview);
  
  // Update the hidden textarea
  const markdownInput = document.getElementById('markdown-input');
  markdownInput.value = markdown;
  
  // Debounced save
  clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => {
    saveCurrentFile(markdown);
  }, 500);
}
