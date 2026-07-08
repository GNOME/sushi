'use strict';

const admonitionTitles = document.querySelectorAll('.admonition-title');
for (const admonitionTitle of admonitionTitles) {
    const textSpan = document.createElement('span');
    textSpan.append(...admonitionTitle.childNodes);
    admonitionTitle.append(textSpan);
}
