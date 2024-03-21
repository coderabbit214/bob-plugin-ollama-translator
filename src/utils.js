var HttpErrorCodes = require("./const.js").HttpErrorCodes;

/**
 * @param {string}  url
 * @returns {string}
 */
function ensureHttpsAndNoTrailingSlash(url) {
    const hasProtocol = /^[a-z]+:\/\//i.test(url);
    const modifiedUrl = hasProtocol ? url : 'https://' + url;

    return modifiedUrl.endsWith('/') ? modifiedUrl.slice(0, -1) : modifiedUrl;
}

/**
 * @returns {{
 *   "Content-Type": string;
 * }} The header object.
 */
function buildHeader() {
    return {
        "Content-Type": "application/json",
    };
}


/**
 * @param {Bob.Completion} completion
 * @param {Bob.HttpResponse} error
 */
function handleGeneralError(completion, error) {
    if ('response' in error) {
        // 处理 HTTP 响应错误
        const {statusCode} = error.response;
        const reason = (statusCode >= 400 && statusCode < 500) ? "param" : "api";
        completion({
            error: {
                type: reason,
                message: `接口响应错误 - ${HttpErrorCodes[statusCode]}`,
                addition: `${JSON.stringify(error)}`,
            },
        });
    } else {
        completion({
            error: {
                type: "unknown",
                message: "Unknown error",
            },
        });
    }
}

/**
 * @param {string} prompt
 * @param {Bob.TranslateQuery} query
 * @returns {string}
 */
function replacePromptKeywords(prompt, query) {
    if (!prompt) return prompt;
    return prompt.replace("$text", query.text)
        .replace("$sourceLang", query.detectFrom)
        .replace("$targetLang", query.detectTo);
}

exports.ensureHttpsAndNoTrailingSlash = ensureHttpsAndNoTrailingSlash;
exports.buildHeader = buildHeader;
exports.handleGeneralError = handleGeneralError;
exports.replacePromptKeywords = replacePromptKeywords;
