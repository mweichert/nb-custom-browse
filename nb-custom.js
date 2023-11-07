document.addEventListener('DOMContentLoaded', (event) => {
    const elements = document.querySelectorAll('[data-query]');
    elements.forEach(el => getData(el));
});

async function toJsonFormat(html) {
    const chrono = await import("https://esm.sh/chrono-node@2.7.0");
    debugger;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a.list-item');
    const items = Array.from(anchors).map(anchor => {
        const spans = anchor.querySelectorAll('span.identifier');
        const path = spans[0].textContent.trim();
        const isChecked = anchor.innerHTML.includes('✔️');
        const status = anchor.innerText.match(/\[\s+]/) ? 'open' : 'closed';

        // Remove all spans - they're not needed any more
        Array.from(anchor.querySelectorAll('span')).map(span => span.remove());

        // Get the unparsed Title
        let title = anchor.innerText.substring(6)

        // Get tags
        let tags = title.match(/#\w+/g) ?? []

        // Remove tags from title
        title = tags.reduce(
            (retval, tag) => retval.replace(tag, '').trim(),
            title
        )

        // Remove hash from tags
        tags = tags.map(tag => tag.replace('#', ''))

        // Get due date
        let due = title.match(/(\(\@.*\))/)
        due = due ? due[0] : null

        // Remove the due date from the title
        title = due ? title.replace(due, '').trim() : title

        // Remove the brackets from the due date
        due = due ? due.replace(/[\(\)\@]/g, '').trim() : due

        // Parse due date
        if (due) {
            due = chrono.parseDate(due)
        }

        return {
            path: path,
            icon: isChecked ? '✔️' : '📝',
            type: isChecked ? 'task' : 'note',
            status: status,
            title: title.trim(),
            due: due,
            tags: tags
        };
  });

  return items;
}

function formatResult(json) {
    return json.map(item => {
        let linkText = `${item.title}`
        if (item.due) {
            linkText += ` (${item.due.toLocaleDateString()})`
        }

        const link = `<a href="${item.path}">${linkText}</a>`
        const tags = item.tags.map(tag => `#${tag}`).join(' ')

        return `<div>${item.icon} ${link} ${tags}</div>`
    }).join("\n")
}

// Gets data from the nb server using queries defined in element attributes and renders the result inline
async function getData(el) {
    let query = el.getAttribute("data-query") ?? ''
	
    // Compute query
    const tags = el.getAttribute("data-tags")
        .trim()
        .split(",")
        .map(t => `#${t}`)
        .join(' ')
    
    if (tags) query += ` ${tags}`

    // Encode query
    query = encodeURIComponent(query.trim());

    // Get the data from the nb server
    const src = `/home:?--query=${query}`;
    const res = await fetch(src);
    const html_str = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html_str, 'text/html');
    const found = doc.querySelector('.item-list');

    // Convert to JSON
    const json = await toJsonFormat(found.innerHTML);

    // Filter by type
    const typeFilter = el.getAttribute("data-type")
    if (typeFilter) {
        json = json.filter(item => typeFilter.trim().split(",").map(t => t.trim()).includes(item.type))
    }

    // Exclude tags
    const excludeTags = el.getAttribute("data-exclude-tags")
    if (excludeTags) {
        json = json.filter(item => !item.tags.some(t => excludeTags.trim().split(",").map(t => t.trim()).includes(t)))
    }

    // Filter by status
    const statusFilter = el.getAttribute("data-status")
    if (statusFilter) {
        json = json.filter(item => statusFilter.trim().split(",").map(t => t.trim()).includes(item.status))
    }

    // Filter by due date
    let dueFilter = el.getAttribute("data-due")
    if (dueFilter) {
        dueFilter = dueFilter.trim()
        if (dueFilter === 'today' || dueFilter === "tomorrow") {
            dueFilter = chrono.parseDate(dueFilter)
            json = json.filter(item => item.due && item.due.toDateString() === dueFilter.toDateString())
        }
        else if (dueFilter == "this week") {
            const today = new Date()
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
            const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
            json = json.filter(item => item.due && item.due >= startOfWeek && item.due <= endOfWeek)
        }
        else if (dueFilter == "next week") {
            const today = new Date()
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 7))
            const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 13))
            json = json.filter(item => item.due && item.due >= startOfWeek && item.due <= endOfWeek)
        }
        else if (dueFilter == "last week") {
            const today = new Date()
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() - 7))
            const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() - 1))
            json = json.filter(item => item.due && item.due >= startOfWeek && item.due <= endOfWeek)
        }
        else if (dueFilter == "this month") {
            const today = new Date()
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            json = json.filter(item => item.due && item.due >= startOfMonth && item.due <= endOfMonth)
        }
        else if (dueFilter == "next month") {
            const today = new Date()
            const startOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0)
            json = json.filter(item => item.due && item.due >= startOfMonth && item.due <= endOfMonth)
        }
        else if (dueFilter == "last month") {
            const today = new Date()
            const startOfMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const endOfMonth = new Date(today.getFullYear(), today.getMonth(), 0)
            json = json.filter(item => item.due && item.due >= startOfMonth && item.due <= endOfMonth)
        }
        else if (dueFilter == "this year") {
            const today = new Date()
            const startOfYear = new Date(today.getFullYear(), 0, 1)
            const endOfYear = new Date(today.getFullYear(), 11, 31)
            json = json.filter(item => item.due && item.due >= startOfYear && item.due <= endOfYear)
        }
        else if (dueFilter == "next year") {
            const today = new Date()
            const startOfYear = new Date(today.getFullYear() + 1, 0, 1)
            const endOfYear = new Date(today.getFullYear() + 1, 11, 31)
            json = json.filter(item => item.due && item.due >= startOfYear && item.due <= endOfYear)
        }
        else if (dueFilter == "last year") {
            const today = new Date()
            const startOfYear = new Date(today.getFullYear() - 1, 0, 1)
            const endOfYear = new Date(today.getFullYear() - 1, 11, 31)
            json = json.filter(item => item.due && item.due >= startOfYear && item.due <= endOfYear)
        }
    }

    // Filter by due date before
    let dueBeforeFilter = el.getAttribute("data-due-before")
    if (dueBeforeFilter) {
        dueBeforeFilter = chrono.parseDate(dueBeforeFilter)
        json = json.filter(item => item.due && item.due <= dueBeforeFilter)
    }

    // Filter by due date after
    let dueAfterFilter = el.getAttribute("data-due-after")
    if (dueAfterFilter) {
        dueAfterFilter = chrono.parseDate(dueAfterFilter)
        json = json.filter(item => item.due && item.due >= dueAfterFilter)
    }

    // Return formatted result
    el.innerHTML = formatResult(json)
}

/*
Examples:

<div data-query="type" data-tags="work,30m" data-exclude-tags="epic" data-limit="5" data-status="open|closed" due="today|tomorrow|this week|next week|this month|pastdue|2023|2023-10|2023-10-01" data-due-before="" data-due-after=""></div>
*/