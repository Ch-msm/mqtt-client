/**
 * dataSimulator.js
 * 一个用于在字符串中替换模板表达式为动态数据的工具。
 * 
 * 支持的模板表达式：
 * 1. [当前时间戳-秒] - 返回当前的UNIX时间戳（秒）
 * 2. [当前时间戳-毫秒] - 返回当前的UNIX时间戳（毫秒）
 * 3. [随机数 min-max] - 返回指定范围内的随机整数，支持负数，例如: [随机数 -10-20]
 * 4. [随机浮点数 min-max precision] - 返回指定范围内的随机浮点数，precision为可选参数表示小数位数(默认2位)
 *    例如: [随机浮点数 0-1 3] 生成0到1之间带3位小数的随机数，如0.123
 *    例如: [随机浮点数 -5.5-10.8] 生成-5.5到10.8之间带2位小数的随机数，如2.34
 * 5. [日期格式 format] - 返回按指定格式格式化的当前日期，支持: YYYY, MM, DD, HH, mm, ss, SSS
 *    例如: [日期格式 YYYY-MM-DD HH:mm:ss]
 * 6. [自增ID 键名 起始值 步长] - 返回自增ID，可指定键名、起始值和步长
 *    例如: [自增ID user 100 1] 生成从100开始，步长为1的自增ID
 * 7. [累计值 起始值 最小步长-最大步长] - 返回累计值，每次增加一个随机步长
 *    例如: [累计值 100 1-5] 从100开始，每次增加1到5之间的随机值
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
        // 处理整数随机数
        if (expression.startsWith("随机数 ")) {
            const paramsString = expression.substring("随机数 ".length).trim();
            
            // 使用正则表达式匹配数字范围，支持负数
            // 格式为：数字1-数字2，其中数字1和数字2可以是负数
            const rangeMatch = paramsString.match(/^(-?\d+)-(-?\d+)$/);
            
            if (rangeMatch) {
                const num1 = parseInt(rangeMatch[1], 10);
                const num2 = parseInt(rangeMatch[2], 10);
                
                if (!isNaN(num1) && !isNaN(num2)) {
                    // 确保较小的值作为最小值，较大的值作为最大值
                    const min = Math.min(num1, num2);
                    const max = Math.max(num1, num2);
                    
                    return String(Math.floor(Math.random() * (max - min + 1)) + min);
                }
            }
            return null; // 格式不匹配或数字解析错误
        }

        // 处理浮点数随机数
        if (expression.startsWith("随机浮点数 ")) {
            try {
                const paramsString = expression.substring("随机浮点数 ".length).trim();
                
                // 匹配格式: "min-max [precision]"
                // 例如: "0-1 2" 表示0到1之间带2位小数的随机数
                const parts = paramsString.split(/\s+/);
                const rangeString = parts[0];
                const precision = parts.length > 1 ? parseInt(parts[1], 10) : 2; // 默认2位小数
                
                if (isNaN(precision) || precision < 0) {
                    console.warn("随机浮点数精度无效:", parts[1]);
                    return null; // 精度必须是非负整数
                }
                
                // 解析范围，支持浮点数和负数
                const rangeMatch = rangeString.match(/^(-?\d*\.?\d+)-(-?\d*\.?\d+)$/);
                if (rangeMatch) {
                    const num1 = parseFloat(rangeMatch[1]);
                    const num2 = parseFloat(rangeMatch[2]);
                    
                    if (!isNaN(num1) && !isNaN(num2)) {
                        // 确保较小的值作为最小值，较大的值作为最大值
                        const min = Math.min(num1, num2);
                        const max = Math.max(num1, num2);
                        
                        // 生成随机浮点数并根据指定的精度四舍五入
                        const randomValue = min + Math.random() * (max - min);
                        return randomValue.toFixed(precision);
                    } else {
                        console.warn("随机浮点数范围解析失败:", rangeString);
                    }
                } else {
                    console.warn("随机浮点数范围格式无效:", rangeString);
                }
            } catch (err) {
                console.error("随机浮点数处理错误:", err);
            }
            
            return null; // 如果有任何错误，返回null
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

    /**
     * 处理累计值生成。
     * @param {string} expression - 表达式字符串，例如 "累计值 100 1-5"。
     * @param {object} context - 用于存储累计值状态的共享上下文对象。
     * @returns {string|null} 生成的累计值字符串或无效时返回 null。
     */
    function _handleAccumulatedValue(expression, context) {
        if (!expression.startsWith("累计值 ")) return null;

        try {
            const paramsString = expression.substring("累计值 ".length).trim();
            const parts = paramsString.split(/\s+/);
            
            if (parts.length !== 2) return null; // 需要两个参数：起始值和步长范围
            
            const startValue = parseFloat(parts[0]);
            if (isNaN(startValue)) return null;
            
            // 解析步长范围 (minStep-maxStep)
            const stepRangeMatch = parts[1].match(/^(-?\d*\.?\d+)-(-?\d*\.?\d+)$/);
            if (!stepRangeMatch) return null;
            
            const minStep = parseFloat(stepRangeMatch[1]);
            const maxStep = parseFloat(stepRangeMatch[2]);
            
            if (isNaN(minStep) || isNaN(maxStep)) return null;
            
            // 确保min和max正确排序
            const actualMinStep = Math.min(minStep, maxStep);
            const actualMaxStep = Math.max(minStep, maxStep);
            
            // 初始化累计值存储
            if (!context.accumulatedValues) {
                context.accumulatedValues = {};
            }
            
            // 使用表达式参数作为键，以便同一模板中的多个累计值可以独立工作
            const key = `${startValue}_${actualMinStep}_${actualMaxStep}`;
            
            // 如果这是第一次使用此键，则初始化值
            if (context.accumulatedValues[key] === undefined) {
                context.accumulatedValues[key] = startValue;
            }
            
            // 生成随机步长
            const randomStep = actualMinStep + Math.random() * (actualMaxStep - actualMinStep);
            
            // 更新累计值
            context.accumulatedValues[key] += randomStep;
            
            // 返回当前累计值（四舍五入到两位小数）
            return context.accumulatedValues[key].toFixed(2);
        } catch (err) {
            console.error("处理累计值时出错:", err);
            return null;
        }
    }

    // --- 主处理函数 ---

    /**
     * 处理模板字符串并用动态数据替换表达式。
     * 支持的表达式:
     * 1. [当前时间戳-秒] - 当前UNIX时间戳(秒)
     * 2. [当前时间戳-毫秒] - 当前UNIX时间戳(毫秒)
     * 3. [随机数 min-max] - 指定范围内的随机整数，支持负数
     * 4. [随机浮点数 min-max precision] - 指定范围内的随机浮点数，precision为可选参数(默认2位小数)
     * 5. [日期格式 format] - 按指定格式的当前日期
     * 6. [自增ID 键名 起始值 步长] - 自增ID生成
     * 7. [累计值 起始值 最小步长-最大步长] - 累计值生成，每次增加随机步长
     * 
     * @param {string} templateString - 包含模板表达式的字符串。
     * @param {object} [context={}] - 可选的上下文对象，用于在调用之间维护状态（例如，自增 ID）。
     * @returns {string} 处理后的字符串，表达式已被替换。
     */
    function processTemplate(templateString, context = {}) {
        if (typeof templateString !== 'string') {
            console.warn("processTemplate: 输入不是字符串，原样返回。");
            return templateString;
        }

        // 添加调试日志
        console.log("处理模板字符串:", templateString);

        // 自增 ID 的缓存，以确保在此单次调用中的幂等性
        const singleCallAutoIncrementCache = {};

        const result = templateString.replace(/\[(.*?)\]/g, (match, expression) => {
            expression = expression.trim();
            console.log("处理表达式:", expression);
            
            let replacement = null;

            // 尝试时间戳处理
            replacement = _handleTimestamp(expression);
            if (replacement !== null) {
                console.log("时间戳替换:", replacement);
                return replacement;
            }

            // 尝试随机数处理
            replacement = _handleRandomNumber(expression);
            if (replacement !== null) {
                console.log("随机数替换:", replacement);
                return replacement;
            }

            // 尝试日期格式处理
            replacement = _handleDateFormat(expression);
            if (replacement !== null) {
                console.log("日期格式替换:", replacement);
                return replacement;
            }

            // 尝试自增 ID 处理
            replacement = _handleAutoIncrementId(expression, context, singleCallAutoIncrementCache);
            if (replacement !== null) {
                console.log("自增ID替换:", replacement);
                return replacement;
            }

            // 尝试累计值处理
            replacement = _handleAccumulatedValue(expression, context);
            if (replacement !== null) {
                console.log("累计值替换:", replacement);
                return replacement;
            }

            // 如果没有处理匹配，返回原始匹配
            console.log("无匹配，返回原始:", match);
            return match;
        });
        
        console.log("处理结果:", result);
        return result;
    }

    // --- 导出 ---
    // 包装processTemplate以增加错误处理
    function safeProcessTemplate(templateString, context = {}) {
        try {
            return processTemplate(templateString, context);
        } catch (error) {
            console.error("处理模板时发生错误:", error);
            // 出错时返回原始字符串，确保功能不会完全中断
            return templateString;
        }
    }
    
    // 使主函数在全局或模块系统中可用
    if (typeof define === 'function' && define.amd) { // AMD
        define('dataSimulator', [], function() {
            return { processTemplate: safeProcessTemplate };
        });
    } else if (typeof module === 'object' && module.exports) { // Node.js/CommonJS
        module.exports = { processTemplate: safeProcessTemplate };
    } else { // 浏览器全局
        global.dataSimulator = { processTemplate: safeProcessTemplate };
    }

}(typeof window !== 'undefined' ? window : this));