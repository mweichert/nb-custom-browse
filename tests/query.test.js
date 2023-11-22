import { assertEquals } from "https://deno.land/std@0.207.0/assert/mod.ts";
import * as chrono from "https://esm.sh/chrono-node@2.7.0";
import * as R from 'https://esm.run/rambda';
import * as dateFns from 'https://esm.run/date-fns';
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";


function getDateString(date=null) {
    if (!date) date = new Date();
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const getDateStringAt1pm = (date=null) => {
    if (!date) date = new Date();
    date.setHours(13, 0, 0, 0);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} 1:00pm`
}

function createFetcher(_dataType='todos', subs={}) {
    if (!subs.date) subs.date=getDateString()
    if (!subs.dateAtTime) subs.dateAtTime=getDateStringAt1pm()

    return function fetch() {
        return Promise.resolve({
            async text() {
                const text = await Deno.readTextFile('./tests/query_results_todos.html')
                return text
                    .replace('{{date}}', subs.date)
                    .replace('{{date-at-time}}', subs.dateAtTime)
            }
        })
    }
}

function createDocument(queryHtml) {
    const parser = new DOMParser();
    return parser.parseFromString(queryHtml, 'text/html');
}


async function getNotes(queryHtml, subs={}) {
    const queryModule = await import('../query.js');
    const document = createDocument(queryHtml);
    const fetch = createFetcher('todos', subs)
    const queryMethods = queryModule.default({chrono, R, dateFns, fetch, document, DOMParser})
    const el = document.getElementById('todo_query');
    const {getNotes} = queryMethods.__test__;
    const results = await getNotes(el);
    return results
}


Deno.test("Query module provides executeQueries function", async () => {
    const queryModule = await import('../query.js');
    const queryMethods = queryModule.default({chrono, R, dateFns, fetch}, DOMParser)
    assertEquals(typeof queryMethods.executeQueries, 'function')
})

Deno.test('can query for any markdown file that contains "todo"', async (t) => {
    const queryHtml = "<div id='todo_query' data-query='todo'></div>";
    const results = await getNotes(queryHtml);
    assertEquals(results.length, 14);

    await t.step('can filter for just todos', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo'></div>";
        const results = await getNotes(queryHtml);
        assertEquals(results.length, 4);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Respond to Manas', 'Take out recylcing', 'Pick up Hayes from school', 'Pick up soap'])
    })

    await t.step('can filter for just todos with the #important tag', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-tags='important'></div>";
        const results = await getNotes(queryHtml);
        assertEquals(results.length, 3);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Respond to Manas', 'Pick up Hayes from school', 'Pick up soap'])
    })

    await t.step('can filter for just todos with just the chores tag but not the important tag', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-tags='chores' data-filter-exclude-tags='important'></div>";
        const results = await getNotes(queryHtml);
        assertEquals(results.length, 1);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Take out recylcing'])
    })

    await t.step('can filter for just todos due today', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='today'></div>";
        const results = await getNotes(queryHtml);
        assertEquals(results.length, 2);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '13:00'])
    })

    await t.step('can filter for just todos due today at 1pm`', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='today at 1pm'></div>";
        const results = await getNotes(queryHtml);
        assertEquals(results.length, 1);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['13:00'])
    })

    await t.step('can filter for just todos due tomorrow', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='tomorrow'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('tomorrow').setHours(0, 0, 0, 0)),
            dateAtTime: chrono.parseDate('tomorrow at 1pm')
        });
        assertEquals(results.length, 2);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '13:00'])
    })

    await t.step('can filter for just todos due next week', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='next week'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('next week').setHours(0, 0, 0, 0)),
            dateAtTime: chrono.parseDate('next week at 1pm')
        });
        assertEquals(results.length, 2);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '13:00'])
    })

    await t.step('can filter for just todos due the previous week', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='last week'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('last week').setHours(0, 0, 0, 0)),
            dateAtTime: chrono.parseDate('last week at 1pm')
        });
        assertEquals(results.length, 3);

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['18:30', '00:00', '13:00'])
    })

    await t.step('can filter for just todos due this week', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='this week'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('monday of this week').setHours(0, 0, 0, 0)),
            dateAtTime: chrono.parseDate('monday of this week at 1pm')
        });
        assertEquals(results.length, 3);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Respond to Manas', 'Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '00:00', '13:00'])
    })

    await t.step('can filter for just todos due this month', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='this month'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('this month').setHours(0, 0, 0, 0)),
            dateAtTime: chrono.parseDate('this month at 1pm')
        });
        assertEquals(results.length, 4);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Respond to Manas', 'Take out recylcing', 'Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '18:30', '00:00', '13:00'])
    })

    await t.step('can filter for just todos due last month', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='last month'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('last month').setHours(0, 0, 0, 0)),
            dateAtTime: new Date(chrono.parseDate('last month').setHours(13, 0, 0, 0))
        });
        assertEquals(results.length, 2);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '13:00'])
    })

    await t.step('can filter for just todos due next month', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='next month'></div>";
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate('next month').setHours(0, 0, 0, 0)),
            dateAtTime: new Date(chrono.parseDate('next month').setHours(13, 0, 0, 0))
        });
        assertEquals(results.length, 2);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '13:00'])
    })

    await t.step('can filter for just todos due this year', async() => {
        const queryHtml = "<div id='todo_query' data-query='todo' data-filter-type='todo' data-filter-due='this year'></div>";
        const thisYear = new Date().getFullYear()
        const results = await getNotes(queryHtml, {
            date: new Date(chrono.parseDate(`january 15 ${thisYear}`).setHours(0, 0, 0, 0)),
            dateAtTime: new Date(chrono.parseDate(`february 15 ${thisYear}`).setHours(13, 0, 0, 0))
        });
        assertEquals(results.length, 4);

        const foundTitles = results.map(note => note.title)
        assertEquals(foundTitles, ['Respond to Manas', 'Take out recylcing', 'Pick up Hayes from school', 'Pick up soap'])

        const foundTimes = results.map(note => dateFns.format(note.dueDate, "HH:mm"))
        assertEquals(foundTimes, ['00:00', '18:30', '00:00', '13:00'])
    })
})

