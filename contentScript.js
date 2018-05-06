function httpGetAsync(theUrl, callback) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.responseText);
        }
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

function GotNoResults(nodeList) {
    for (let i = 0; i < nodeList.length; i++) {
        let node = nodeList[i];
        if (node.nodeName == "#text" && node.textContent.includes("Saw 0")) {
            return true;
        }
    }
    return false;
}

function onSearchResponse(alternate, responseText) {
    let nodeList = $.parseHTML(responseText);
    if (!GotNoResults(nodeList)) {
        console.log("Got non-empty response for: " + alternate); 
        let wordSearchedDiv = document.createElement('div');
        wordSearchedDiv.innerHTML = "Searched for <b>" + alternate + "</b>";
        appendResult([ wordSearchedDiv ]);
        appendResult(nodeList.slice(3));
    } else {
        console.log("Got empty response for: " + alternate);                    
    }
}

function getMenuDocument() {
    let menuFrame = $("frame[name='menu']")[0];
    let menuDoc = menuFrame.contentDocument ||  menuFrame.contentWindow.document;
    return menuDoc;
}

function getResultDocument() {
    let resultFrame = $("frame[name='result']")[0];
    let resultDoc = resultFrame.contentDocument ||  resultFrame.contentWindow.document;
    return resultDoc;
}

function appendResult(nodeList) {
    let resultDoc = getResultDocument();
    let resultBody = $(resultDoc).find("body")[0];
    for (let i = 0; i < nodeList.length; i++) {
        resultBody.append(nodeList[i]);
    }
}

let vowels = [ 'a', 'ā', 'e', 'ĕ', 'ö', 'i', 'ī', 'o', 'u', 'ū' ];

function startsWithVowel(word) {
    for (let i = 0; i < vowels.length; i++) {
        if (word.startsWith(vowels[i])) {
            return true;
        }
    }
    return false;
}

let similarLetters = [
    [ "a", "ā" ],
    [ "b", "bh" ],
    [ "c", "ch" ],
    [ "d", "dh", "ḍ", "ḍh" ],
    [ "ĕ", "ö" ],
    [ "e", "ai" ],
    [ "g", "gh" ],
    [ "h" ],
    [ "i", "ī" ], 
    [ "j", "jh" ],
    [ "k", "kh" ],
    [ "l" ],
    [ "m" ],
    [ "n" ],
    [ "ṅ" ],
    [ "ñ" ],
    [ "o" ],
    [ "p", "ph" ],
    [ "r", "ṛ" ],
    [ "s", "ś", "ṣ" ],
    [ "t", "th", "ṭ", "ṭh" ],
    [ "u", "ū" ],
    [ "w" ],
    [ "y" ]
];

function getSearchBox() {
    let menu = getMenuDocument();
    let input = $(menu).find("#query")[0];
    return input;
}

function getSearchBoxString() {
    let input = getSearchBox();
    console.log("input: " + input.value);
    return input.value;
}

function getLetterEquivalenceClass(char) {
    for (let i = 0; i < similarLetters.length; i++) {
        let arr = similarLetters[i];
        let index = arr.indexOf(char);
        if (index != -1) {
            return arr;
        }
    }
    console.log("didnt find: " + char);
    return [];
}

function generatePermuations(word) {
    let alts = [ "" ];
    let newAlts = [];
    for (let i = 0; i < word.length; i++) {
        let altChars = getLetterEquivalenceClass(word[i]);
        for (let j = 0; j < alts.length; j++) {
            let currentAlt = alts[j];
            for (let k = 0; k < altChars.length; k++) {
                newAlts.push(currentAlt + altChars[k]);
            }
        }
        alts = newAlts;
        newAlts = [];
    }
    return alts;
}

function generateAlternates(original) {
    let word = original.trim();
    if(word.length == 0) {
        return [];
    }
    let alts = generatePermuations(word);
    if (startsWithVowel(word)) {
        alts.push("h" + word);
    }
    // remove original
    let index = alts.indexOf(word);
    alts.splice(index, 1);
    console.log(alts);
    return alts;
}

let entryHtmlCache = {};

function fillCache() {
    for (let i = 0; i < similarLetters.length; i++) {
        let eqClass = similarLetters[i].join("|"); 
        let url = entrySearchUrl + encodeURIComponent(eqClass);
        httpGetAsync(url, function(responseText) {
            entryHtmlCache[eqClass] = responseText;
            console.log("FillCache: got entryHtml for: " + eqClass);
        });
    }
}

let entrySearchUrl = "http://sealang.net/ojed/search.pl?service=entry&form=short&facet=head&query=";

function checkExistsInEntryHtml(alternate, cb) {
    let eqClass = getLetterEquivalenceClass(alternate[0]).join("|"); 
    let url = entrySearchUrl + encodeURIComponent(eqClass);
    if (eqClass in entryHtmlCache) {
        cb(entryHtmlCache[eqClass].includes(alternate));
    } else {
        httpGetAsync(url, function(responseText) {
            entryHtmlCache[eqClass] = responseText;
            console.log("Got entryHtml for: " + eqClass);
            cb(responseText.includes(alternate));
        });
    }
}

let searchUrl = "http://sealang.net/ojed/search.pl?service=dictionary&form=short&query=";

function search() {
    let input = getSearchBoxString();
    let alternates = generateAlternates(input);
    console.log("alternates #: " + alternates.length);    
    for (let i = 0; i < alternates.length; i++) {
        let alternate = alternates[i];
        checkExistsInEntryHtml(alternate, function (exists) {
            if (exists) {
                let queryUrl = searchUrl + encodeURIComponent(alternate);
                httpGetAsync(queryUrl, function(responseText) {
                    onSearchResponse(alternate, responseText); 
                });
                console.log("sent request for: " + alternate);
            } else {
                console.log("skipped request for: " + alternate);
            }
        });
    }
}

function getSearchButton() {
    let menu = getMenuDocument();
    let button = $(menu).find("button.nopad")[0];
    return button;
}

function init() {
    fillCache();
    let resultFrame = $("frame[name='result']")[0];    
    var resultDoc = getResultDocument();
    $(resultFrame).on("load", function () {
        //alert("Hi there, hello");
        search();        
    })

    console.log("Sealang Plus initialized.");
}

window.onload = init();