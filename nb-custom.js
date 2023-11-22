document.addEventListener('DOMContentLoaded', async (event) => {
    const chrono = await import("https://esm.sh/chrono-node@2.7.0");
    const R = await import('https://esm.run/rambda')
    const dateFns = await import('https://esm.run/date-fns');

    // Load query module
    const queryModule = await importModule('/query.js');
    const queryMethods = queryModule.default({chrono, R, dateFns, document, fetch, DOMParser})

    Promise.all([
        queryMethods.executeQueries(),
        addRunnableCodeBlocks()
    ])
});

/**
 * Gets a url of a resource relative to this script
 * @param {string} path 
 * @returns {string}
 */
function getRelativeUrl(path) {
    const script = Array.from(document.getElementsByTagName('script')).find(script => script.src.includes('nb-custom.js'))
    return script.src.replace('/nb-custom.js', path.startsWith('/') ? path : '/' + path)
}

async function importModule(path) {
    return await import(getRelativeUrl(path))
}

// TODO: Write documentation of how to use this
async function addRunnableCodeBlocks() {
    const elements = Array.from(document.querySelectorAll('code.sourceCode.javascript'));
    return Promise.all(elements.map(addRunButtonToCodeElement))
}

function addRunButtonToCodeElement(codeEl) {
    // 1. Creating the Run Button
    let runButton = document.createElement('button');
    runButton.textContent = 'Run';
    const sourceCodePre = codeEl.parentNode
    const sourceCodeDiv = sourceCodePre.parentNode;
    sourceCodeDiv.insertBefore(runButton, sourceCodePre);

    function executeUserCode(userCode, pre) {
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            pre.textContent += args.join(' ') + '\n';
        };

        try {
            eval(userCode);
        } catch (error) {
            pre.textContent += 'Error: ' + error.message;
        }

        // Restore original console.log
        console.log = originalConsoleLog;
    }

    // 2. Adding Event Listener to Button
    runButton.addEventListener('click', function() {
        // a) Adding DIV below code element
        let outputDiv = document.createElement('div');
        outputDiv.className = 'runOutput';
        sourceCodeDiv.append(outputDiv);

        // b) Appending Output Text and PRE tag
        outputDiv.innerHTML = '<b>Output:</b><br/><pre></pre>';
        let pre = outputDiv.querySelector('pre');

        executeUserCode(codeEl.textContent, pre);        
    });
}