//@ts-check

var lang = require("./lang.js");
var SYSTEM_PROMPT = require("./const.js").SYSTEM_PROMPT;

var {
    ensureHttpsAndNoTrailingSlash,
    handleGeneralError,
    replacePromptKeywords,
    buildHeader,
} = require("./utils.js");


/**
 * @param {Bob.TranslateQuery} query
 * @returns {{
 *  generatedSystemPrompt: string,
 *  generatedUserPrompt: string
 * }}
 */
function generatePrompts(query) {
    let generatedSystemPrompt = SYSTEM_PROMPT;
    const { detectFrom, detectTo } = query;
    const sourceLang = lang.langMap.get(detectFrom) || detectFrom;
    const targetLang = lang.langMap.get(detectTo) || detectTo;
    let generatedUserPrompt = `translate from ${sourceLang} to ${targetLang}`;

    if (detectTo === "wyw" || detectTo === "yue") {
        generatedUserPrompt = `翻译成${targetLang}`;
    }

    if (
        detectFrom === "wyw" ||
        detectFrom === "zh-Hans" ||
        detectFrom === "zh-Hant"
    ) {
        if (detectTo === "zh-Hant") {
            generatedUserPrompt = "翻译成繁体白话文";
        } else if (detectTo === "zh-Hans") {
            generatedUserPrompt = "翻译成简体白话文";
        } else if (detectTo === "yue") {
            generatedUserPrompt = "翻译成粤语白话文";
        }
    }

    generatedUserPrompt = `${generatedUserPrompt}:\n\n${query.text}`

    return { generatedSystemPrompt, generatedUserPrompt };
}

/**
 * @param {string} model
 * @param {Bob.TranslateQuery} query
 * @returns {{
 *  model: string;
 *  options: {
 *      temperature: number; // 0.0 - 1.0
 *  };
 *  stream: boolean;
 *  messages?: {
 *    role: "system" | "user";
 *    content: string;
 *  }[];
 *  prompt?: string;
 * }}
 */
function buildRequestBody(model, query) {
    let { customSystemPrompt, customUserPrompt } = $option;
    const { generatedSystemPrompt, generatedUserPrompt } = generatePrompts(query);

    customSystemPrompt = replacePromptKeywords(customSystemPrompt, query);
    customUserPrompt = replacePromptKeywords(customUserPrompt, query);

    const systemPrompt = customSystemPrompt || generatedSystemPrompt;
    const userPrompt = customUserPrompt || generatedUserPrompt;

    const options = {
        temperature: 0,
        top_p: 1,
        frequency_penalty: 1,
        presence_penalty: 1,
    };

    return {
        options,
        model: model,
        stream: false,
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: userPrompt,
            },
        ],
    };
}

/**
 * @param {Bob.Completion} completion
 * @param {Bob.HttpResponse} result
 * @param {Bob.TranslateQuery} query
 * @returns {void}
 */
function handleGeneralResponse(completion, result, query) {
    const { message } = result.data;

    if (!message) {
        completion({
            error: {
                type: "api",
                message: "接口未返回结果",
                addition: JSON.stringify(result),
            },
        });
        return;
    }

    let targetText = message.content

    // 使用正则表达式删除字符串开头和结尾的特殊字符
    targetText = targetText.replace(/^(『|「|"|“)|(』|」|"|”)$/g, "");

    // 判断并删除字符串末尾的 `" =>`
    if (targetText.endsWith('" =>')) {
        targetText = targetText.slice(0, -4);
    }

    completion({
        result: {
            from: query.detectFrom,
            to: query.detectTo,
            toParagraphs: targetText.split("\n"),
        },
    });
}

/**
 * @type {Bob.Translate}
 */
function translate(query, completion) {
    if (!lang.langMap.get(query.detectTo)) {
        completion({
            error: {
                type: "unsupportLanguage",
                message: "不支持该语种",
                addition: "不支持该语种",
            },
        });
    }

    const {
        apiUrl,
        model,
        customModel, // 优先使用 customModel,如果 customModel 不存在则使用 model
    } = $option;

    const isCustomModelRequired = model === "custom";
    if (isCustomModelRequired && !customModel) {
        completion({
            error: {
                type: "param",
                message: "配置错误 - 请确保您在插件配置中填入了正确的自定义模型名称",
                addition: "请在插件配置中填写自定义模型名称",
            },
        });
        return;
    }

    let useModel = model;
    if (isCustomModelRequired) {
        useModel = customModel;
    }

    const body = buildRequestBody(useModel, query);
    const header = buildHeader();

    (async () => {
        const result = await $http.request({
            method: "POST",
            url: ensureHttpsAndNoTrailingSlash(apiUrl) + "/api/chat",
            body,
            header,
        });

        if (result.data.error) {
            handleGeneralError(completion, result);
        } else {
            handleGeneralResponse(completion, result, query);
        }
    })().catch((err) => {
        handleGeneralError(completion, err);
    });
}

function supportLanguages() {
    return lang.supportLanguages.map(([standardLang]) => standardLang);
}

exports.supportLanguages = supportLanguages;
exports.translate = translate;
