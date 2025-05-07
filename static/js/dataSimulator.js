/**
 * dataSimulator.js
 * 一个用于在字符串中替换模板表达式为动态数据的工具。
 */

(function(global) {
    'use strict';

    // --- 辅助函数 ---

    /**
     * 根据提供的格式将 Date 对象格式化为字符串。
     * 支持：YYYY, MM, DD, HH, mm, ss, SSS（毫秒）。
     * @param {Date} date - 要格式化的 Date 对象。
     * @param {string} format - 格式字符串。
     * @returns {string} 格式化后的日期字符串。
     */
    function _formatDateTime(date, format) {
        if (!(date instanceof Date) || isNaN(date)) {
            return format; // 如果日期无效，则返回格式字符串
        }
        const pad = (num, z = 2) => ('0'.repeat(z) + num).slice(-z);
        const SSS = ('000' + date.getMilliseconds()).slice(-3);

        return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (match) => {
            switch (match) {
                case 'YYYY': return String(date.getFullYear());
                case 'MM': return pad(date.getMonth() + 1);
                case 'DD': return pad(date.getDate());
                case 'HH': return pad(date.getHours());
                case 'mm': return pad(date.getMinutes());
                case 'ss': return pad(date.getSeconds());
                case 'SSS': return SSS;
                default: return match;
            }
        });
    }

    // --- 表达式处理函数 ---

    function _handleTimestamp(expression) {
        if (expression === "当前时间戳-秒") {
            return String(Math.floor(Date.now() / 1000));
        }
        if (expression === "当前时间戳-毫秒") {
            return String(Date.now());
        }
        return null; // 不是一个被识别的时间戳表达式
    }

    function _handleRandomNumber(expression) {
        if (expression.startsWith("随机数 ")) {
            const paramsString = expression.substring("随机数 ".length);
            const parts = paramsString.split("-");
            if (parts.length === 2) {
                const min = parseInt(parts[0].trim(), 10);
                const max = parseInt(parts[1].trim(), 10);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    return String(Math.floor(Math.random() * (max - min + 1)) + min);
                }
            }
        }
        return null; // 不是一个被识别的随机数表达式或参数无效
    }

    function _handleDateFormat(expression) {
        if (expression.startsWith("日期格式 ")) {
            const format = expression.substring("日期格式 ".length).trim();
            if (format) {
                return _formatDateTime(new Date(), format);
            }
        }
        return null; // 不是一个被识别的日期格式表达式或格式缺失
    }

    /**
     * 处理自增 ID 生成。
     * @param {string} expression - 表达式字符串，例如 "自增ID user 100 1"。
     * @param {object} context - 用于存储 ID 状态的共享上下文对象。
     * @param {object} singleCallCache - 当前 processTemplate 调用中的 ID 缓存。
     * @returns {string|null} 生成的 ID 字符串或无效时返回 null。
     */
    function _handleAutoIncrementId(expression, context, singleCallCache) {
        if (!expression.startsWith("自增ID ")) return null;

        const parts = expression.substring("自增ID ".length).trim().split(/\s+/);
        const key = parts[0];
        if (!key) return null; // 键是必需的

        const templateStart = parseInt(parts[1], 10) || 1;
        const templateStep = parseInt(parts[2], 10) || 1;

        if (isNaN(templateStart) || isNaN(templateStep)) return null; // 起始或步长无效

        // 缓存键以确保在单个 processTemplate 调用中的幂等性
        const cacheKey = `autoid-${key}-${templateStart}-${templateStep}`;
        if (singleCallCache[cacheKey] !== undefined) {
            return String(singleCallCache[cacheKey]);
        }

        if (!context.autoIncrementCounters) {
            context.autoIncrementCounters = {};
        }

        let idState = context.autoIncrementCounters[key];
        let idToReturn;

        if (!idState || idState.initialStartOfSequence !== templateStart) {
            // 为此键创建新序列，或使用新的 templateStart 重置
            idToReturn = templateStart;
            context.autoIncrementCounters[key] = {
                currentValue: templateStart, // 刚生成的值
                stepUsedForCurrent: templateStep, // 将用于从此值进行*下一个*增量的步长
                initialStartOfSequence: templateStart
            };
        } else {
            // 从上一个 processTemplate 调用继续现有序列
            // 状态中的 `currentValue` 是上次生成的值。
            // 状态中的 `stepUsedForCurrent` 是导致该 `currentValue` 的步长，如果它不是起始值，
            // 或者如果它是起始值，则是下一个要使用的步长。
            // 更准确地说，它是应该添加到 `currentValue` 的步长
            idToReturn = idState.currentValue + idState.stepUsedForCurrent;
            context.autoIncrementCounters[key] = {
                currentValue: idToReturn,
                stepUsedForCurrent: templateStep, // 使用当前模板的步长更新*下一个*增量
                initialStartOfSequence: templateStart // 这在序列中保持不变
            };
        }

        singleCallCache[cacheKey] = idToReturn;
        return String(idToReturn);
    }


    // --- 主处理函数 ---

    /**
     * 处理模板字符串并用动态数据替换表达式。
     * @param {string} templateString - 包含模板表达式的字符串。
     * @param {object} [context={}] - 可选的上下文对象，用于在调用之间维护状态（例如，自增 ID）。
     * @returns {string} 处理后的字符串，表达式已被替换。
     */
    function processTemplate(templateString, context = {}) {
        if (typeof templateString !== 'string') {
            console.warn("processTemplate: 输入不是字符串，原样返回。");
            return templateString;
        }

        // 自增 ID 的缓存，以确保在此单次调用中的幂等性
        const singleCallAutoIncrementCache = {};

        return templateString.replace(/\[(.*?)\]/g, (match, expression) => {
            expression = expression.trim();
            let replacement = null;

            // 尝试时间戳处理
            replacement = _handleTimestamp(expression);
            if (replacement !== null) return replacement;

            // 尝试随机数处理
            replacement = _handleRandomNumber(expression);
            if (replacement !== null) return replacement;

            // 尝试日期格式处理
            replacement = _handleDateFormat(expression);
            if (replacement !== null) return replacement;

            // 尝试自增 ID 处理
            replacement = _handleAutoIncrementId(expression, context, singleCallAutoIncrementCache);
            if (replacement !== null) return replacement;

            // 如果没有处理匹配，返回原始匹配
            return match;
        });
    }

    // --- 导出 ---
    // 使主函数在全局或模块系统中可用
    if (typeof define === 'function' && define.amd) { // AMD
        define('dataSimulator', [], function() {
            return { processTemplate: processTemplate };
        });
    } else if (typeof module === 'object' && module.exports) { // Node.js/CommonJS
        module.exports = { processTemplate: processTemplate };
    } else { // 浏览器全局
        global.dataSimulator = { processTemplate: processTemplate };
    }

}(typeof window !== 'undefined' ? window : this));