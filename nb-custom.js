document.addEventListener('DOMContentLoaded', (event) => {
    const elements = document.querySelectorAll('[data-query]');
    elements.forEach(el => getData(el));
});

function toListFormat(htmlString) {
	// Create a new DOMParser instance
	const parser = new DOMParser();

	// Parse the string as 'text/html'
	const doc = parser.parseFromString(htmlString, 'text/html');

	// Create a list element
	const list = document.createElement('div');

	// Get all list items
	const items = doc.querySelectorAll('.list-item');

	// Insert list items for each link
	items.forEach(item => {
		 // Create a list item
		 const listItem = document.createElement('div');
		 
		 // Extract the URL from the original link
		 const url = item.getAttribute('href');

		 // Create a new anchor element
		 const link = document.createElement('a');
		 link.setAttribute('href', url);

		  // Remove the first three span elements
		 const spansToRemove = item.querySelectorAll('span.muted, span.identifier');
		 spansToRemove.forEach((span, index) => {
		   if (index < 3) span.remove();
		 });

		 // Extract and keep the icon (assuming it is the first character)
		 const icon = item.textContent.trim().charAt(0);
		 
		 // Extract the text content, exclude the identifier and brackets and icon
		 let textContent = item.textContent.replace(/\s{2,}\[.*?\]/g, '').trim().substring(1);

		 // Add icon to list item
		 const span = document.createElement('a');
		 span.innerHTML = icon;
		 listItem.appendChild(span);

		 // Append the link to the list item
		 listItem.appendChild(link);
		 link.innerHTML = textContent;
		 list.appendChild(listItem);
	});

	return list.innerHTML;
}

// Gets data from the nb server using queries defined in element attributes and renders the result inline
async function getData(el) {
    let query = encodeURIComponent(el.getAttribute("data-query"))
	
    // If no query, then use tags
	if (!query) {
		let tags = el.getAttribute("data-tags")
			.trim()
			.split(",")
			.map(t => `#${t}`)
			.join(' ')

		query = encodeURIComponent(tags);
	}

    // Get the data from the nb server
    const src = `/home:?--query=${query}`;
    const res = await fetch(src);
    const html_str = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html_str, 'text/html');
    const found = doc.querySelector('.item-list');

    // Render the result
    el.innerHTML = toListFormat(found.outerHTML);
}
