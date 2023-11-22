/**
 * @typedef {Object} Deps
 * @property {import("https://esm.run/rambda")} R - Ramda library type. See [Ramda Documentation](https://ramdajs.com/docs/).
 * @property {ChronoType} chrono - Chrono library type. See [Chrono Documentation](https://github.com/wanasit/chrono).
 * @property {import("https://esm.run/date-fns'")} dateFns - Date-fns library type. See [Date-fns Documentation](https://date-fns.org/docs/Getting-Started).
 * @property {Document} document - Document type. See [DOM Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Document).
 * @property {typeof fetch} fetch - Fetch type. See [Fetch Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 * @property {DOMParser} DOMParser - DOMParser type. See [DOMParser Documentation](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser).
 */

/**
 * A function using the custom type.
 * @param {Deps} param - The parameter with Ramda and Chrono types.
 */
export function init({R, chrono, dateFns, document, fetch, DOMParser}) {
    /**
     * This method will find and execute notebook queries in the current page to find notes.
     * Notes can then be filtered by type, tags, etc.
     * 
     * A notebook query is identified as a div with a [data-query] attribute.
     * 
     * E.g.: <div data-query="noteboook"/>
     */
    function executeQueries() {
        const elements = Array.from(document.querySelectorAll('[data-query]'));
        return Promise.all(elements.map(executeQuery))
    }

    /**
     * @typedef {Object} FoundItem
     * @property {"note"|"folder"|"doc"|"bookmark"|"todo"} type
     * @property {string} title
     * @property {string} url
     * @property {string} icon 
     * @property {string} dueDate
     * @property {string[]} tags
     * @property {boolean} isPinned
     * 
     * 
     * @param {Element} el
     */
    function parseFoundItem(el) {
        const type = getType(el);

        return {
            id: el.querySelector('.identifier').textContent,
            url: el.getAttribute("href"),
            title: getTitle(el),
            type,
            icon: getIcon(type),
            isPinned: el.textContent.includes('📌'),
            tags: getTags(el),
            dueDate: getDueDate(el)
        }
    }


    function getTitle(el) {
        Array.from(el.querySelectorAll('span')).map(item => item.remove());
        let retval =  Object.values(getTypeIconMap()).reduce(
            (title, icon) => title.replace(icon, '').trim(),
            el.textContent.replace('&nbsp;', '').replace('📌', '').trim()
        )

        // Remove tags
        retval = getTags(el, true).reduce(
            (title, tag) => title.replace(tag, '').trim(),
            retval
        )

        // Remove filename from title
        if (retval.includes('·')) {
            const idx = retval.indexOf('·');
            retval = retval.substring(idx + 1).trim();
        }

        // Remove due date (if present)
        retval = retval.replace(/\(@.*\)/, '').trim();

        // Replace non-breaking spaces with spaces
        return retval.replace(/\u00A0/g, ' ').trim();
    }

    function getTypeIconMap() {
        return {
            'note': '📔',
            'folder': '📂',
            'doc': '📄',
            'bookmark': '🔖',
            'todo': '✔️'
        }
    }

    function getType(el) {
        const typeIconMap = getTypeIconMap();

        const retval = Object.entries(typeIconMap).reduce(
            (retval, [type, icon]) => retval ?? (el.textContent.includes(icon) ? type : null),
            null
        )

        return retval ?? 'note'
    }

    function getTags(el, withHash = false) {
        const tags = Array.from(el.textContent.match(/#([\w-_]+)/g) ?? [])
        return withHash ? tags : tags.map(tag => tag.replace('#', ''))
    }

    function getIcon(type) {
        const typeIconMap = getTypeIconMap();
        return typeIconMap[type] ?? '📝';
    }

    function getDueDate(el) {
        let dueString = el.textContent.match(/\(\@(.*)\)/);
        if (dueString) {
            dueString = dueString[1];
            if (!dueString.match(/\s/)) {
                const duedate = chrono.parseDate(dueString);
                duedate.setHours(0,0,0,0);
                return duedate;
            }
            
            const duedate = chrono.parseDate(dueString);
            return duedate;
        }
        return null
    }

    /**
    This method will execute a single notebook query.
    A notebook query is performed using `nb search` command, which is what the `search` form uses behind-the-scenes to perform a searches using the `nb browse` interface
     
    A query can have many attributes:
      
    - data-query (required): the text query to execute.
    - filter-type: filter the results by type: note,folder,doc,bookmark,todo

     * 
     * @param {HTMLElement} el 
     */
    async function executeQuery(el) {
        const notes = await getNotes(el);

        if (!notes.length) el.replaceWith('No results found');

        switch(el.getAttribute("data-format")) {
            case 'json':
                outputFormattedJSON(el, notes);
                break;
            default:
                outputFormattedList(el, notes);
        }
    }

    /**
     * Processes a query and returns a JSON array of found items
     * @param {Element} el 
     * @returns {FoundItem[]}
     */
    async function getNotes(el) {
        const query = _getQuery(el);
        const results = await fetchQueryResults(query);

        // If no results, then return with a message
        if (!results.length) return [];

        // Parse the results
        let json = results.map(parseFoundItem)

        // Filter the results
        json = filterDuplicates(json)
        json = filterByType(el, json)
        json = filterByTags(el, json)
        json = filterByExcludingTags(el, json)
        json = filterByDue(el, json)

        return json
    }

    function outputFormattedList(el, notes) {
        const ul = document.createElement('ul');
        const output = notes.reduce(
            (ul, note) => {
                const li = outputFormattedListItem(el, note);
                ul.appendChild(li);
                return ul;
            },
            ul
        )
        el.replaceWith(output);
    }

    function outputFormattedListItem(el, note) {
        const li = document.createElement('li');
        li.classList.add('found-note');

        const displaySettings = getDisplaySettings(el);
        const content = Object.entries(displaySettings).reduce(
            (content, [setting, value]) => {
                if (value) {
                    switch(setting) {
                        case 'icon':
                            content = `<span class="note-${setting}">${note.icon}</span> ${content}`;
                            break;
                        case 'due-date':
                            content = note.date ? `${content} <span class="note-${setting}">@${note.dueDate.toLocaleDateString()}</span>` : content;
                            break;
                    }
                }
                return content;
            },
            `<span class='note-title'>${note.title}</span>`
        )

        const tags = note.tags.length && displaySettings.tags? ` <span class="note-tags">${tagstoLinks(note.tags)}</span>` : '';

        li.innerHTML = `<span class="note"><a href="${note.url}">${content}</a>${tags}</span>`;
        return li;
    }

    function tagstoLinks(tags) {
        return tags.reduce(
            (retval, tag) => retval.length ? `${retval} ${tagToLink(tag)}` : tagToLink(tag),
            ''
        )
    }

    function tagToLink(tag) {
        return `<a href="/home:?--query=%23${tag}">#${tag}</a>`
    }

    function getDisplaySettings(el) {
        const settings = ['icon', 'due-date', 'tags']

        return settings.reduce(
            (retval, setting) => {
                let value = el.getAttribute(getSettingsAttributeName(setting, 'display')) ?? 'true';
                retval[setting] = value.match(/y|yes|true|1|on/i) ? true : false;
                return retval;
            },
            {}
        )
    }

    function getSettingsAttributeName(string, group='display') {
        if (group === 'display')
            return `data-show-${string}`
        else if (group === 'filter')
            return `data-filter-${string}`
        else
            return `data-{group}-${string}`
    }

    function filterByTags(el, json) {
        const filterTags = el.getAttribute("data-filter-tags");
        if (!filterTags) return json;

        const tags = filterTags.split(',').map(tag => tag.trim());
        return json.filter(item => R.intersection(item.tags, tags).length > 0);
    }

    function filterByExcludingTags(el, json) {
        const filterTags = el.getAttribute("data-filter-exclude-tags");
        if (!filterTags) return json;

        const tags = filterTags.split(',').map(tag => tag.trim());
        return json.filter(item => R.intersection(item.tags, tags).length === 0);
    }

    function filterDuplicates(json) {
        return R.uniqBy(item => item.id, json)
    }

    /**
     * 
     * @param {Element} el 
     * @param {FoundItem[]} json 
     * @returns 
     */
    function filterByDue(el, json) {
        let dueFilter = el.getAttribute("data-filter-due");
        if (dueFilter) dueFilter = dueFilter.trim()
        else return json

        if (dueFilter === 'today' || dueFilter === "tomorrow" || dueFilter === "yesterday") {
            dueFilter = chrono.parseDate(dueFilter)
            dueFilter.setHours(0,0,0,0);
            const {isEqual} = dateFns;
            json = json.filter(item => {
                if (!item.dueDate) return false;
                const dueDate = new Date(item.dueDate.toLocaleDateString());
                dueDate.setHours(0,0,0,0);
                return isEqual(dueDate, dueFilter)
            })
        }
        else if (dueFilter == "this week") {
            const startDate = chrono.parseDate('monday of this week')
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.addDays(startDate, 6)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "next week") {
            const startDate = dateFns.addWeeks(chrono.parseDate('monday of this week'), 1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.addDays(startDate, 6)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "last week") {
            const startDate = dateFns.addWeeks(chrono.parseDate('monday of this week'), -1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.addDays(startDate, 6)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "this month") {
            const startDate = chrono.parseDate('first day this month')
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfMonth(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "next month") {
            const startDate = dateFns.addMonths(chrono.parseDate('first day this month'), 1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfMonth(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "last month") {
            const startDate = dateFns.addMonths(chrono.parseDate('first day this month'), -1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfMonth(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "this year") {
            const thisYear = new Date().getFullYear()
            const startDate = chrono.parseDate(`january 1 ${thisYear}`)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfYear(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "next year") {
            const thisYear = new Date().getFullYear()
            const startDate = dateFns.addYears(chrono.parseDate(`january 1 ${thisYear}`), 1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfYear(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (dueFilter == "last year") {
            const thisYear = new Date().getFullYear()
            const startDate = dateFns.addYears(chrono.parseDate(`january 1 ${thisYear}`), -1)
            startDate.setHours(0,0,0,0);
            const endDate = dateFns.lastDayOfYear(startDate)
            endDate.setHours(23, 59, 59, 999)
            json = json.filter(item => item.dueDate && dateFns.isWithinInterval(item.dueDate, {start: startDate, end: endDate}))
        }
        else if (/(past|over)\s?due/.test(dueFilter)) {
            json = json.filter(item => item.dueDate && dateFns.isPast(item.dueDate))
        }
        else if (dueFilter === "unscheduled") {
            json = json.filter(item => !item.dueDate)
        }

        // Attempt to parse filter as a date
        else {
            dueFilter = chrono.parseDate(dueFilter)
            json = json.filter(item => item.dueDate && dateFns.isEqual(item.dueDate, dueFilter))
        }

        return json;
    }

    /**
     * Filters the results by type. Type is specified in the [filter-type] attribute as a comma-separated list of types.
     * @param {Element} el 
     * @param {FoundItem[]} json 
     * @returns {FoundItem[]}
     */
    function filterByType(el, json) {
        const filterType = el.getAttribute("data-filter-type");
        if (!filterType) return json;

        const types = filterType.split(',').map(type => type.trim());
        return json.filter(item => types.includes(item.type));
    }

    function outputFormattedJSON(el, json) {
        const json_str = JSON.stringify(json, null, 2);
        const pre = document.createElement('pre');
        pre.textContent = json_str;
        el.replaceWith(pre);
    }

    /**
     * Given a query, returns the list of found elements
     * @param {string} query 
     * @returns {Promise<Element[]>} 
     */
    async function fetchQueryResults(query) {
        // Encode query
        query = encodeURIComponent(query);

        // Get the data from the nb server
        const src = `/home:?--query=${query}`;
        const res = await fetch(src);
        const html_str = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html_str, 'text/html');
        const results = doc.querySelectorAll('.item-list a');
        return Array.from(results);
    }

    /**
     * Given a [data-query] element, return the query string
     * @param {Element} el 
     * @returns {string}
     */
    function _getQuery(el) {
        let query = el.getAttribute("data-query");
        return query ? query.trim() : ' ';
    }


    return {
        executeQueries,
        __test__: {
            getQuery: _getQuery,
            getNotes,
            parseFoundItem,
            filterByType,
            filterByTags,
            filterByExcludingTags,
            filterByDue,
            filterDuplicates,
            getType,
            getIcon,
            getTags,
            getTitle,
            getDueDate,
            getTypeIconMap,
            outputFormattedJSON,
            outputFormattedList,
            outputFormattedListItem,
            getDisplaySettings,
            tagstoLinks,
            tagToLink,
            fetchQueryResults
        }
    }
}

export default init;